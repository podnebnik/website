/** @import * as Types "./types" */

import { STAGE_DATA_BASE_URL, STAGING_VREMENAR_API_URL } from "./constants";
import {  RequestStationData, StationsResponse } from '../types/api-raw.js';
import type { ProcessedStation, ProcessedTemperatureData } from '../types/models.js';

/** Figure out if we’re running the local dev site (including LAN IP access). */
function isDevLikeHost(h: string) {
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (h.endsWith(".local")) return true;
  return false;
}

const __hasWindow = typeof window !== "undefined";
const __host = __hasWindow ? window.location.hostname : "";
const __port = __hasWindow ? window.location.port : "";
const __devLike = __hasWindow && (isDevLikeHost(__host) || __port === "8080");

/** In dev we route via our proxy (same host, :8090). In prod we hit vremenar directly. */
const API_BASE = __devLike
  ? `http://${__host}:8090/api`
  : "https://podnebnik.vremenar.app";

/**
 * Returns a string representation of a number, prefixing it with a zero if it is less than 10.
 * @param number
 */
function zeroPrefix(number: number): string {
  if (number < 10) return `0${number}`;
  return `${number}`;
}

/**
 * Formats a JavaScript Date object into 'YYYY-MM-DD'.
 * @param date
 * @returns string in 'YYYY-MM-DD' format
 */
function formatDateForQuery(date: Date): string {
  let year = `${date.getFullYear()}`;
  let month = `${zeroPrefix(date.getMonth() + 1)}`;
  let day = `${zeroPrefix(date.getDate())}`;
  return `${year}-${month}-${day}`;
}

/**
 * Human readable "danes/včeraj ob HH:MM".
 * @param date
 * @param updated
 * @returns formatted time string
 *
 * @example
 * formatTime(new Date('2024-06-15T14:30:00'), new Date('2024-06-15T16:00:00')) // "danes ob 14:30"
 * formatTime(new Date('2024-06-14T14:30:00'), new Date('2024-06-15T16:00:00')) // "včeraj ob 14:30"
 */
function formatTime(date: Date, updated: Date): string {
  let day = date.getDate() == updated.getDate() ? "danes" : "včeraj";
  let time = `${zeroPrefix(date.getHours())}:${zeroPrefix(date.getMinutes())}`;
  return `${day} ob ${time}`;
}

/** Small fetch helper with abort timeout. */
async function fetchWithTimeout(url: string, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
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
export async function loadStations(): Promise<
  | { success: true; stations: Array<ProcessedStation> }
  | { success: false; error: Error | string }
> {
  // Fetch stations from Datasette (CORS-friendly)
  const resultStations = await fetch(
    `${STAGE_DATA_BASE_URL}/temperature/temperature~2Eslovenia_stations.json?&_col=station_id&_col=name&_col=name_locative&_sort=name`
  );

  if (resultStations.ok) {
    try {
      let stationsList: ProcessedStation[] = [];
      const dataStations = (await resultStations.json()) as StationsResponse;
      for (let row of dataStations["rows"]) {
        let name_list = row[3].split(" ");
        stationsList.push({
          station_id: row[1],
          name_locative: name_list.slice(1).join(" "),
          prefix: name_list[0] ?? "",
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
 * @param stationID - The ID of the weather station to fetch data for.
 * @param options - Additional options for the request
 * @param options.signal - AbortController signal for request cancellation
 * @returns An object containing temperature statistics and percentile results. If the request fails, returns an error object.
 */
export async function requestData(
  stationID: string,
  options: { signal?: AbortSignal } = {}
): Promise<
  | { success: true; data: ProcessedTemperatureData }
  | { success: false; error: Error | string }
> {
  try {
    const resultAverage = await fetch(
      `${STAGING_VREMENAR_API_URL}/stations/details/METEO-${stationID}?country=si`,
      {
        signal: options?.signal,
      }
    );
    if (resultAverage.ok) {
      const dataAverage = (await resultAverage.json()) as RequestStationData;
      const averageTemperature = dataAverage.statistics.temperature_average_24h;

      let timeUpdated = new Date(Number(dataAverage.statistics.timestamp));
      const date = formatDateForQuery(timeUpdated);

      let timeMinDate = new Date(
        Number(dataAverage.statistics.timestamp_temperature_min_24h)
      );
      let timeMaxDate = new Date(
        Number(dataAverage.statistics.timestamp_temperature_max_24h)
      );

      const resultPercentile = await fetch(
        `${STAGE_DATA_BASE_URL}/temperature/temperature~2Eslovenia_historical~2Edaily~2Eaverage_percentiles.json?date__exact=${date}&station_id__exact=${stationID}&_col=p05&_col=p20&_col=p40&_col=p60&_col=p80&_col=p95`,
        {
          signal: options.signal,
        }
      );

      if (resultPercentile.ok) {
        const dataPercentile = await resultPercentile.json();

        let columns = dataPercentile["columns"];
        let values = dataPercentile["rows"][0];
        if (!values) throw new Error("Percentiles not found");

        // first column is rowid
        columns.shift();
        values.shift();

        // find bucket of current average
        let resultValue: string = "-1";
        let resultTemperatureValue = -1;

        if (averageTemperature < values[0]) {
          resultValue = "p00";
          resultTemperatureValue = values[0];
        } else {
          for (let i = 0; i < values.length; i++) {
            if (i == values.length - 1) {
              resultValue = "p95";
              resultTemperatureValue = values[i];
            } else if (
              averageTemperature >= values[i] &&
              averageTemperature < values[i + 1]
            ) {
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
            timeUpdated: new Intl.DateTimeFormat("sl-SI", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(timeUpdated),
          },
        };
      }
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      console.error("Unknown error type:", error);
      return {
        success: false,
        error: "An unknown error occurred",
      };
    }
    // If the request was aborted, propagate the abort error
    if (error.name === "AbortError") {
      throw error;
    }

    console.error(`Error fetching data for station ${stationID}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  console.error(`Failed to load data for station ${stationID}`);
  return {
    success: false,
    error: `Failed to load data for station ${stationID}`,
  };
}

/* -------------------- Historical window (dev → Datasette; prod → API then fallback) -------------------- */

function isDefined<T>(x: T | null | undefined): x is T {
  return x != null;
}

function buildWindow(centerMMDD: string, windowDays: number): string[] {
  const half = Math.floor(windowDays / 2);
  const [mm, dd] = centerMMDD.split("-").map((s) => Number(s));
  if (!mm) throw new Error("Invalid month");
  if (!dd) throw new Error("Invalid day");
  if (mm < 1 || mm > 12) throw new Error("Month out of range");
  if (dd < 1 || dd > 31) throw new Error("Day out of range");

  const base = new Date(Date.UTC(2001, mm - 1, dd)); // non-leap baseline
  const out = [];
  for (let k = -half; k <= half; k++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + k);
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${m}-${day}`);
  }
  return out;
}

function numOrNull(x: string | number | null | undefined): number | null {
  if (x == null) return null;
  const y = Number(x);
  return Number.isFinite(y) ? y : null;
}

const DATASETTE_TABLE_PATH =
  "temperature/temperature~2Eslovenia_historical~2Edaily.json";

function buildDatasetteUrl({ sid, inList, withCols = true }: {
  sid: number;
  inList: string;
  withCols?: boolean;
}): string {
  const BASE_URL = STAGE_DATA_BASE_URL;
  const baseUrl = `${BASE_URL}/${DATASETTE_TABLE_PATH}`;
  const common =
    `${baseUrl}` +
    `?_shape=array&_size=max` +
    `&station_id__exact=${encodeURIComponent(String(sid))}` +
    `&_where=${encodeURIComponent(`substr(date,6,5) IN (${inList})`)}` +
    `&_order_by=date`;

  return withCols ? common + `&_col=station_id&_col=date&_col=temperature_average_2m` : common;
}

type HistoricalRow = {
  rowid: number;
  station_id: number;
  date: string;
  temperature_average_2m?: number;
  temperature_avg?: number;
  temperature_average?: number;
};

export async function requestHistoricalWindow({ station_id, center_mmdd, window_days }: {
  station_id: string | number;
  center_mmdd: string;
  window_days: number;
}) {
  const sid = Number(station_id);
  const mmddList = buildWindow(center_mmdd, window_days);
  const inList = mmddList.map((d) => `'${d}'`).join(", ");

  // Normalizer works for both API and Datasette shapes
  const normalize = (rows: any[]) =>
    rows
      .map((r) => {
        const y = Number(
          r.year ??
            (typeof r.date === "string" ? r.date.slice(0, 4) : undefined)
        );
        const avg =
          r.tavg ??
          r.temperature_average_2m ??
          r.temperature_avg ??
          r.temperature_average ??
          r.avg ??
          r.tempAvg ??
          r.temp_mean ??
          (r.tmin != null && r.tmax != null
            ? (Number(r.tmin) + Number(r.tmax)) / 2
            : null);
        if (!Number.isFinite(y) || !Number.isFinite(Number(avg))) return null;
        return {
          year: y,
          tavg: Number(avg),
          day_offset: r.day_offset != null ? Number(r.day_offset) : undefined,
        };
      })
      .filter(isDefined); // Boolean function doesn’t narrow types (typescript quirk)

  // DEV: go straight to Datasette (avoid 504 noise)
  if (__devLike) {
    let url = buildDatasetteUrl({ sid, inList, withCols: true });
    let r = await fetchWithTimeout(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      if (r.status === 400 && /invalid columns/i.test(text)) {
        url = buildDatasetteUrl({ sid, inList, withCols: false });
        r = await fetchWithTimeout(url);
      } else {
        throw new Error(`Datasette failed (${r.status})`);
      }
    }
    const rows = await r.json() as HistoricalRow[];
    const filtered = rows.filter((row) => String(row.station_id) === String(sid));
    const mapped = filtered
      .map((row) => {
        const date = String(row.date);
        const year = Number(date.slice(0, 4));
        const tavg =
          numOrNull(row.temperature_average_2m) ??
          numOrNull(row.temperature_avg) ??
          numOrNull(row.temperature_average);
        return { year, tavg };
      })
      .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.tavg));
    return normalize(mapped);
  }

  // PROD: try API → fallback to Datasette
  const apiUrl = `${API_BASE}/staging/ali-je-vroce/historical_window?station_id=${encodeURIComponent(
    station_id
  )}&center_mmdd=${encodeURIComponent(center_mmdd)}&window_days=${encodeURIComponent(window_days)}`;

  try {
    const viaApi = await fetchWithTimeout(apiUrl, { timeoutMs: 8000 });
    if (!viaApi.ok) throw new Error(`HTTP ${viaApi.status}`);
    const rows = await viaApi.json() as HistoricalRow[];
    return normalize(rows);
  } catch {
    let url = buildDatasetteUrl({ sid, inList, withCols: true });
    let r = await fetchWithTimeout(url, { timeoutMs: 8000 });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      if (r.status === 400 && /invalid columns/i.test(text)) {
        url = buildDatasetteUrl({ sid, inList, withCols: false });
        r = await fetchWithTimeout(url, { timeoutMs: 8000 });
      } else {
        throw new Error(`Datasette failed (${r.status})`);
      }
    }
    const rows = await r.json() as HistoricalRow[];
    const filtered = rows.filter((row) => String(row.station_id) === String(sid));
    const mapped = filtered
      .map((row) => {
        const date = String(row.date);
        const year = Number(date.slice(0, 4));
        const tavg =
          numOrNull(row.temperature_average_2m) ??
          numOrNull(row.temperature_avg) ??
          numOrNull(row.temperature_average);
        return { year, tavg };
      })
      .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.tavg));
    return normalize(mapped);
  }
}
