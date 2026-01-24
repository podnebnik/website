/** @import * as Types "./types" */

import { STAGE_DATA_BASE_URL, STAGING_VREMENAR_API_URL } from "./constants";
import { RequestStationData, StationsResponse } from '../types/api-raw.js';
import type { ProcessedStation, ProcessedTemperatureData } from '../types/models.js';

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
  options: {signal?: AbortSignal} = {}
): Promise<
  | { success: true; data: ProcessedTemperatureData }
  | { success: false; error: Error | string }
> {
  try {
    const resultAverage = await fetch(
      `${STAGING_VREMENAR_API_URL}/stations/details/METEO-${stationID}?country=si`,
      options.signal ? { signal: options?.signal } : undefined
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
         options.signal ? { signal: options?.signal } : undefined
      );
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

/**
 * Type guard that checks if a value is defined (not null or undefined).
 * 
 * @template T - The type of the value to check
 * @param x - The value to check for null or undefined
 * @returns True if the value is defined (not null or undefined), false otherwise
 * 
 * @example
 * ```typescript
 * const value: string | null = getValue();
 * if (isDefined(value)) {
 *   // TypeScript now knows that value is string, not string | null
 *   console.log(value.length);
 * }
 * ```
 */
function isDefined<T>(x: T | null | undefined): x is T {
  return x != null;
}

function isFiniteNumber(x: number | null | undefined): boolean {
  return Number.isFinite(x);
}

function isValidRecord(
  record: { year: number; tavg: number | null | undefined }
): record is { year: number; tavg: number } {
  return isFiniteNumber(record.year) && isFiniteNumber(record.tavg);
}

/**
 * Builds a window of dates centered around a given date, returning MM-DD formatted strings.
 * 
 * @param centerMMDD - The center date in "MM-DD" format (e.g., "03-15" for March 15th)
 * @param windowDays - The total number of days in the window (should be odd for symmetric results)
 * @returns An array of date strings in "MM-DD" format representing the date window
 * 
 * @throws {Error} When month or day are invalid or out of range
 * 
 * @example
 * ```typescript
 * buildWindow("03-15", 5); // Returns ["03-13", "03-14", "03-15", "03-16", "03-17"]
 * buildWindow("12-31", 3); // Returns ["12-30", "12-31", "01-01"] (crosses year boundary)
 * ```
 */
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

/**
 * Converts a value to a number or returns null if the conversion is not possible.
 * 
 * @param x - The value to convert to a number. Can be a string, number, null, or undefined.
 * @returns The converted number if the input is a valid finite number, otherwise null.
 * 
 * @example
 * ```typescript
 * numOrNull("123") // returns 123
 * numOrNull(456) // returns 456
 * numOrNull("abc") // returns null
 * numOrNull(null) // returns null
 * numOrNull(undefined) // returns null
 * numOrNull(Infinity) // returns null
 * ```
 */
function convertToNumberOrNull(x: string | number | null | undefined): number | null {
  if (x == null) return null;
  const y = Number(x);
  return Number.isFinite(y) ? y : null;
}

const DATASETTE_TABLE_PATH =
  "temperature/temperature~2Eslovenia_historical~2Edaily.json";

/**
 * Builds a URL for querying the Datasette API to retrieve temperature data for a specific station.
 * 
 * @param options - Configuration object for building the URL
 * @param options.sid - Station ID to filter results by
 * @param options.inList - Comma-separated list of date patterns (MM-DD format) to filter by
 * @param options.withCols - Whether to include specific column selection in the URL (defaults to true)
 * 
 * @returns A formatted Datasette API URL with query parameters for retrieving station temperature data
 * 
 * @example
 * ```typescript
 * const url = buildDatasetteUrl({
 *   sid: 123,
 *   inList: "'07-15','08-20'",
 *   withCols: true
 * });
 * // Returns URL with station filter, date range, and specific columns
 * ```
 */
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

/**
 * Represents a historical weather data row from the database.
 * Contains temperature measurements and metadata for a specific weather station on a given date.
 *
 * @interface HistoricalRowFromDatasette
 * @property {number} rowid - Unique identifier for the database row
 * @property {number} station_id - Identifier of the weather station that recorded the data
 * @property {string} date - Date when the temperature data was recorded (ISO date string format)
 * @property {number} [temperature_average_2m] - Optional average temperature at 2 meters height in Celsius
 * @property {number} [temperature_avg] - Optional average temperature measurement in Celsius
 * @property {number} [temperature_average] - Optional average temperature value in Celsius
 */
type HistoricalRowFromDatasette = {
  rowid: number;
  station_id: number;
  date: string;
  temperature_average_2m?: number;
  temperature_avg?: number;
  temperature_average?: number;
};

// Types for normalized temperature data
type NormalizedTemperatureRecord = {
  year: number;
  tavg: number;
  day_offset?: number;
};

/**
 * Extracts temperature value from various possible field names
 */
function extractTemperatureValue(record: {year?: number, tavg?:number | null}): number | null {
  const tempValue = convertToNumberOrNull(record.tavg);
  
  /** 
   * @deprecated Previous complex extraction logic replaced with simplified version above.
   */
  // const tempValue = 
  //   record.tavg ??
  //   record.temperature_average_2m ??
  //   record.temperature_avg ??
  //   record.temperature_average ??
  //   record.avg ??
  //   record.tempAvg ??
  //   record.temp_mean ??
  //   (record.tmin != null && record.tmax != null
  //     ? (Number(record.tmin) + Number(record.tmax)) / 2
  //     : null);
  
  return tempValue != null && Number.isFinite(Number(tempValue)) ? Number(tempValue) : null;
}

/**
 * Extracts year from record, handling different date formats
 */
function extractYear(record: { year?: number | string; date?: string | Date }): number | null {
  const year = Number(
    record.year ?? 
    (typeof record.date === "string" ? record.date.slice(0, 4) : undefined)
  );
  
  return Number.isFinite(year) ? year : null;
}

/**
 * Extract date from record, if it exists
 */
function extractDate(record: { year?: number | string; date?: Date }): Date | null {
  const date = record.date ?? null;
  return date
}

/**
 * Normalizes temperature records from different data sources
 */
function normalizeTemperatureRecords(
  rows: {year?: number, tavg?: number | null, date?: Date}[]): NormalizedTemperatureRecord[] {
  return rows
    .map((record) => {
      const year = extractYear(record);
      const tavg = extractTemperatureValue(record);
      const date = extractDate(record);
      
      if (year === null || tavg === null) return null;
      
      return {
        year,
        tavg,
        date,
      };
    })
    .filter(isDefined);
}

/**
 * Processes and filters Datasette response data
 */
function processDatasetteResponse(rows: HistoricalRowFromDatasette[], stationId: number): { year: number; tavg: number | null; date: Date }[] {
  const filtered = rows.filter((row) => String(row.station_id) === String(stationId));
  
  return filtered
    .map((row) => {
      const dateString = String(row.date);
      const date = new Date(dateString);
      const year = Number(dateString.slice(0, 4));
      const tavg =
        convertToNumberOrNull(row.temperature_average_2m) ??
        convertToNumberOrNull(row.temperature_avg) ??
        convertToNumberOrNull(row.temperature_average);
      return { year, tavg, date };
    })
    .filter(isValidRecord);
}

/**
 * Fetches data from Datasette with fallback for invalid columns
 */
async function fetchFromDatasette(
  sid: number, 
  inList: string, 
  timeoutMs: number = 10000
): Promise<HistoricalRowFromDatasette[]> {
  let url = buildDatasetteUrl({ sid, inList, withCols: true });
  let response = await fetchWithTimeout(url, { timeoutMs });
  
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 400 && /invalid columns/i.test(text)) {
      // Retry without column specification
      url = buildDatasetteUrl({ sid, inList, withCols: false });
      response = await fetchWithTimeout(url, { timeoutMs });
    }
    
    if (!response.ok) {
      throw new Error(`Datasette request failed with status ${response.status}`);
    }
  }

  const responseData = await response.json() as HistoricalRowFromDatasette[];
  if (!Array.isArray(responseData)) {
    throw new Error('Datasette response is not an array as expected');
  }

  return responseData;
}

/**
 * Requests historical temperature data for a specific weather station within a time window.
 * 
 * This function retrieves historical temperature data for a given station, centered around
 * a specific date (MM-DD format) with a configurable window of days. It attempts to fetch
 * data from an API first (in production), then falls back to a Datasette source if the API fails.
 * In development, it goes directly to Datasette to avoid API timeout issues.
 * 
 * The function normalizes data from different sources, handling various temperature field
 * names and formats. It filters out invalid data points and returns standardized temperature
 * records with year, average temperature, and optional day offset.
 * 
 * @param params - Configuration object for the historical data request
 * @param params.station_id - The weather station identifier (string or number)
 * @param params.center_mmdd - Center date in MM-DD format (e.g., "07-15" for July 15th)
 * @param params.window_days - Number of days to include in the window around the center date
 * 
 * @returns Promise that resolves to an array of normalized temperature records containing
 *          year, average temperature, and optional day offset
 * 
 * @throws {Error} When both API and Datasette sources fail to provide valid data
 * 
 * @example
 * ```typescript
 * const data = await requestHistoricalWindow({
 *   station_id: "12345",
 *   center_mmdd: "07-15",
 *   window_days: 30
 * });
 * ```
 */
export async function requestHistoricalWindow({ 
  station_id, 
  center_mmdd, 
  window_days 
}: {
  station_id: string | number;
  center_mmdd: string;
  window_days: number;
}): Promise<NormalizedTemperatureRecord[]> {
  const sid = Number(station_id);
  const mmddList = buildWindow(center_mmdd, window_days);
  const inList = mmddList.map((d) => `'${d}'`).join(", ");

  try {
    const rows = await fetchFromDatasette(sid, inList);
    const processedData = processDatasetteResponse(rows, sid);
    return normalizeTemperatureRecords(processedData);
  } catch (error) {
    throw new Error(`Development datasette request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
