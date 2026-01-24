// code/ali-je-vroce/helpers.mjs
import { BASE_URL } from "./constants.mjs";

/** Figure out if we’re running the local dev site (including LAN IP access). */
function isDevLikeHost(h) {
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

export const API_BASE = __devLike
  ? `http://${__host}:8090/api`
  : "https://podnebnik.vremenar.app";

function zeroPrefix(number) {
  if (number < 10) return `0${number}`;
  return `${number}`;
}

function formatDateForQuery(date) {
  let year = `${date.getFullYear()}`;
  let month = `${zeroPrefix(date.getMonth() + 1)}`;
  let day = `${zeroPrefix(date.getDate())}`;
  return `${year}-${month}-${day}`;
}

function formatTime(date, updated) {
  let day = date.getDate() == updated.getDate() ? "danes" : "včeraj";
  let time = `${zeroPrefix(date.getHours())}:${zeroPrefix(date.getMinutes())}`;
  return `${day} ob ${time}`;
}

/** Small fetch helper with abort timeout. */
async function fetchWithTimeout(url, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Keep: stations + station details logic (unchanged) */
export async function loadStations() {
  const resultStations = await fetch(
    `${BASE_URL}/temperature/temperature~2Eslovenia_stations.json?&_col=station_id&_col=name&_col=name_locative&_sort=name`
  );

  if (resultStations.ok) {
    try {
      let stationsList = [];
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

export async function requestData(stationID) {
  try {
    const resultAverage = await fetch(
      `${API_BASE}/staging/stations/details/METEO-${stationID}?country=si`
    );

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

      const resultPercentile = await fetch(
        `${BASE_URL}/temperature/temperature~2Eslovenia_historical~2Edaily~2Eaverage_percentiles.json?date__exact=${date}&station_id__exact=${stationID}&_col=p05&_col=p20&_col=p40&_col=p60&_col=p80&_col=p95`
      );

      if (resultPercentile.ok) {
        const dataPercentile = await resultPercentile.json();

        let columns = dataPercentile["columns"];
        let values = dataPercentile["rows"][0];
        if (!values) throw new Error("Percentiles not found");

        // first column is rowid
        columns.shift();
        values.shift();

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
    console.error(`Error fetching data for station ${stationID}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  console.error(`Failed to load data for station ${stationID}`);
  return {
    success: false,
    error: "Failed to load data for station " + stationID,
  };
}

/* -------------------- Historical window (dev → Datasette; prod → API then fallback) -------------------- */

function buildWindow(centerMMDD, windowDays) {
  const half = Math.floor(windowDays / 2);
  const [mm, dd] = centerMMDD.split("-").map((s) => Number(s));
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

function numOrNull(x) {
  if (x == null) return null;
  const y = Number(x);
  return Number.isFinite(y) ? y : null;
}

const DATASETTE_TABLE_PATH =
  "temperature/temperature~2Eslovenia_historical~2Edaily.json";

function buildDatasetteUrl({ sid, inList, withCols = true }) {
  const baseUrl = `${BASE_URL}/${DATASETTE_TABLE_PATH}`;
  const common =
    `${baseUrl}` +
    `?_shape=array&_size=max` +
    `&station_id__exact=${encodeURIComponent(String(sid))}` +
    `&_where=${encodeURIComponent(`substr(date,6,5) IN (${inList})`)}` +
    `&_order_by=date`;

  return withCols ? common + `&_col=station_id&_col=date&_col=temperature_average_2m` : common;
}

export async function requestHistoricalWindow({ station_id, center_mmdd, window_days }) {
  const sid = Number(station_id);
  const mmddList = buildWindow(center_mmdd, window_days);
  const inList = mmddList.map((d) => `'${d}'`).join(", ");

  // Normalizer works for both API and Datasette shapes
  const normalize = (rows) =>
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
      .filter(Boolean);

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
    const rows = await r.json();
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
    const rows = await viaApi.json();
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
    const rows = await r.json();
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