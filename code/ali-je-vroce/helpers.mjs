/** @import * as Types "./types" */

import { BASE_URL, STAGING_VREMENAR_API_URL } from "./constants.mjs"

/** Figure out if we’re running the local dev site (including LAN IP access). */
function isDevLikeHost(h) {
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  // Private IPv4 ranges: 10/8, 172.16–31/12, 192.168/16
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  // Common mDNS names
  if (h.endsWith(".local")) return true;
  return false;
}

/** Decide local vs prod API base for the vremenar host (proxied in dev). */
const __hasWindow = typeof window !== "undefined";
const __host = __hasWindow ? window.location.hostname : "";
const __port = __hasWindow ? window.location.port : "";
const __devLike = __hasWindow && (isDevLikeHost(__host) || __port === "8080");

/** In dev we route via our proxy (same host, :8090). In prod we hit vremenar directly. */
export const API_BASE = __devLike
  ? `http://${__host}:8090/api`
  : "https://podnebnik.vremenar.app";

/**
 * Returns a string representation of a number, prefixing it with a zero if it is less than 10.
 * @param {number} number
 * @returns {string}
 */
function zeroPrefix(number) {
  if (number < 10) return `0${number}`;
  return `${number}`;
}

/**
 * Formats a JavaScript Date object into 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
function formatDateForQuery(date) {
  let year = `${date.getFullYear()}`;
  let month = `${zeroPrefix(date.getMonth() + 1)}`;
  let day = `${zeroPrefix(date.getDate())}`;
  return `${year}-${month}-${day}`;
}

/**
 * Human readable "danes/včeraj ob HH:MM".
 * @param {Date} date
 * @param {Date} updated
 * @returns {string}
 */
function formatTime(date, updated) {
  let day = date.getDate() == updated.getDate() ? "danes" : "včeraj";
  let time = `${zeroPrefix(date.getHours())}:${zeroPrefix(date.getMinutes())}`;
  return `${day} ob ${time}`;
}

/**
 * Asynchronously loads a list of temperature stations from a remote JSON endpoint.
 * Load stations list from Datasette (already CORS-friendly).
 *
 * Fetches station data, processes each station row, and returns an array of station objects.
 * Each object contains the station's ID, the locative name (excluding the prefix), and the prefix itself.
 *
 * @async
 * @function loadStations
 * @returns {Promise<{ success: true, stations: Array<Types.ProcessedStation> } | { success: false, error: Error | string }>}
 *   Resolves to an array of station objects, or an empty array if the fetch fails.
 * 
 */
export async function loadStations() {
  const resultStations = await fetch(
    `${BASE_URL}/temperature/temperature~2Eslovenia_stations.json?&_col=station_id&_col=name&_col=name_locative&_sort=name`
  );

  if (resultStations.ok) {
    try {

            /** @type {Array<Types.ProcessedStation>} */
      let stationsList = [];
            /** @type {Types.StationsResponse} */
      const dataStations = await resultStations.json();
      for (let row of dataStations["rows"]) {
        let name_list = row[3].split(" ");
        stationsList.push({
          station_id: row[1],
          name_locative: name_list.slice(1).join(" "),
          prefix: name_list[0],
        });
      }
      return { success: true, stations: stationsList };
    } catch (error) {
      console.error("Error processing station data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  console.error("Failed to load stations");
  return { success: false, error: "Failed to load stations" };
}

/**
 * Fetches and processes temperature data for a given weather station.
 *
 * Retrieves the latest average, minimum, and maximum temperatures, as well as historical percentile data,
 * for the specified station. Determines the percentile bucket for the current average temperature.
 *
 * @async
 * @param {string} stationID - The ID of the weather station to fetch data for.
 * @param {Object} options - Additional options for the request
 * @param {AbortSignal} options.signal - AbortController signal for request cancellation
 * @returns {Promise<Types.RequestStationData | {success: false, error: Error | string}>} An object containing temperature statistics and percentile results. If the request fails, returns an error object.
 */
export async function requestData(stationID, options = {}) {
    try {
        const resultAverage = await fetch(`${STAGING_VREMENAR_API_URL}/stations/details/METEO-${stationID}?country=si`, {
            signal: options.signal
        });
        if (resultAverage.ok) {
            const dataAverage = await resultAverage.json();
            const averageTemperature = dataAverage.statistics.temperature_average_24h;

      let timeUpdated = new Date(Number(dataAverage.statistics.timestamp));
      const date = formatDateForQuery(timeUpdated);

      let timeMinDate = new Date(
        Number(dataAverage.statistics.timestamp_temperature_min_24h)
      );
      let timeMaxDate = new Date(
        Number(dataAverage.statistics.timestamp_temperature_max_24h)
      );

      // Historical percentiles from Datasette
      const resultPercentile = await fetch(
        `${BASE_URL}/temperature/temperature~2Eslovenia_historical~2Edaily~2Eaverage_percentiles.json?date__exact=${date}&station_id__exact=${stationID}&_col=p05&_col=p20&_col=p40&_col=p60&_col=p80&_col=p95`, {
                signal: options.signal
            }
      );

      if (resultPercentile.ok) {
        const dataPercentile = await resultPercentile.json();

        let columns = dataPercentile["columns"];
        let values = dataPercentile["rows"][0];
        if (!values) {
          throw new Error("Percentiles not found");
        }

        // first column is rowid
        columns.shift();
        values.shift();

        // find bucket of current average
        let resultValue = -1;
        let resultTemperatureValue = -1;

        if (averageTemperature < values[0]) {
          resultValue = "p00";
          resultTemperatureValue = values[0];
        } else {
          for (let i = 0; i < values.length; i++) {
            if (i == values.length - 1) {
              resultValue = "p95";
              resultTemperatureValue = values[i];
            } else if (averageTemperature >= values[i] && averageTemperature < values[i + 1]) {
              resultValue = columns[i];
              resultTemperatureValue = values[i];
              break;
            }
          }
        }

                return {
                    success: true,
                    data: {
                        resultValue,
                        resultTemperatureValue,
                        tempMin: dataAverage.statistics.temperature_min_24h,
                        timeMin: formatTime(timeMinDate, timeUpdated),
                        tempMax: dataAverage.statistics.temperature_max_24h,
                        timeMax: formatTime(timeMaxDate, timeUpdated),
                        tempAvg: averageTemperature,
                        timeUpdated: new Intl.DateTimeFormat('sl-SI', {
                            dateStyle: 'long',
                            timeStyle: 'short',
                        }).format(timeUpdated),
                    }
                }
            }
        }
    } catch (error) {
        // If the request was aborted, propagate the abort error
        if (error.name === 'AbortError') {
            throw error;
        }

        console.error(`Error fetching data for station ${stationID}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

  console.error(`Failed to load data for station ${stationID}`);
  return {
    success: false,
    error: "Failed to load data for station " + stationID,
  };
}

/**
 * Historical window (±7 days → 15 days total) normalized to `{year, tavg, day_offset?}`.
 * Uses proxy in dev; real origin in prod.
 * @param {{station_id:string|number, center_mmdd:string, window_days:number}} params
 * @returns {Promise<Array<{year:number, tavg:number, day_offset?:number}>>}
 */
export async function requestHistoricalWindow({ station_id, center_mmdd, window_days }) {
  const url = `${API_BASE}/staging/ali-je-vroce/historical_window?station_id=${encodeURIComponent(
    station_id
  )}&center_mmdd=${encodeURIComponent(center_mmdd)}&window_days=${encodeURIComponent(
    window_days
  )}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("[requestHistoricalWindow]", resp.status, url);
      throw new Error(`HTTP ${resp.status} for historical_window`);
    }

    const rows = await resp.json();

    // Normalize to "average" temperature
    const data = rows
      .map((r) => {
        const y = Number(r.year);
        const avg =
          r.tavg ??
          r.temperature_average ??
          r.avg ??
          r.tempAvg ??
          r.temp_mean ??
          (r.tmin != null && r.tmax != null ? (Number(r.tmin) + Number(r.tmax)) / 2 : null);

        if (!Number.isFinite(y) || !Number.isFinite(Number(avg))) return null;

        return {
          year: y,
          tavg: Number(avg),
          day_offset: r.day_offset != null ? Number(r.day_offset) : undefined,
        };
      })
      .filter(Boolean);

    return data;
  } catch (err) {
    console.error("[requestHistoricalWindow]", err);
    throw err;
  }
}