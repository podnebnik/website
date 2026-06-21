import { CACHE_KEY_PREFIX, DEFAULT_STATION } from "../constants.ts";
import type { ProcessedStation, ProcessedTemperatureData } from "../../types/models.ts";
import type { RequestStationData, StationsResponse } from "../../types/api-raw.ts";

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StationPreference {
  readonly value: number;
  readonly label: string;
  readonly prefix: string;
}

export interface CurrentHotnessDisplayFields {
  result: string;
  resultTemperature: string;
  tempMin: number | string;
  timeMin: string;
  tempMax: number | string;
  timeMax: string;
  tempAvg: number | string;
  timeUpdated: string;
}

export interface ReadModelState
  extends Omit<CurrentHotnessDisplayFields, "tempMin" | "tempMax" | "tempAvg"> {
  tempMin?: number | string;
  tempMax?: number | string;
  tempAvg?: number | string;
  selectedStation: StationPreference | null;
  stationPrefix: string;
}

export interface CurrentHotnessPercentileResponse {
  columns: string[];
  rows: Array<Array<number | string>>;
}

const stationPreferenceKey = "selectedStation";
export const stationPreferenceStorageKey = `${CACHE_KEY_PREFIX}-${stationPreferenceKey}`;

const legacyStationPreferenceStorageKeys = [stationPreferenceKey] as const;

function isStationPreference(value: unknown): value is StationPreference {
  if (!value || typeof value !== "object") return false;

  const station = value as Partial<StationPreference>;
  return (
    typeof station.value === "number" &&
    Number.isFinite(station.value) &&
    typeof station.label === "string" &&
    station.label.trim().length > 0 &&
    typeof station.prefix === "string" &&
    station.prefix.trim().length > 0
  );
}

function parseStationPreference(value: string | null): StationPreference | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isStationPreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredStationPreference(
  storage: PreferenceStorage,
  key: string,
): StationPreference | null {
  try {
    return parseStationPreference(storage.getItem(key));
  } catch (error) {
    console.warn("Error reading selected station preference:", error);
    return null;
  }
}

function removeStoredStationPreference(
  storage: PreferenceStorage,
  key: string,
): void {
  try {
    storage.removeItem(key);
  } catch (error) {
    console.warn("Error removing selected station preference:", error);
  }
}

function zeroPrefix(number: number): string {
  if (number < 10) return `0${number}`;
  return `${number}`;
}

function formatDateForQuery(date: Date): string {
  const year = `${date.getFullYear()}`;
  const month = `${zeroPrefix(date.getMonth() + 1)}`;
  const day = `${zeroPrefix(date.getDate())}`;
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date, updated: Date): string {
  const day = date.getDate() === updated.getDate() ? "danes" : "včeraj";
  const time = `${zeroPrefix(date.getHours())}:${zeroPrefix(date.getMinutes())}`;
  return `${day} ob ${time}`;
}

function toNumber(value: number | string | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Expected finite number, got ${String(value)}`);
  }
  return numeric;
}

function findCurrentHotnessBucket(
  averageTemperature: number,
  columns: string[],
  values: number[],
): Pick<ProcessedTemperatureData, "resultValue" | "resultTemperatureValue"> {
  const firstValue = values[0];
  if (firstValue === undefined) {
    throw new Error("Percentiles not found");
  }

  if (averageTemperature < firstValue) {
    return {
      resultValue: "p00",
      resultTemperatureValue: firstValue,
    };
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined) continue;

    const column = columns[index] ?? "p95";
    const nextValue = values[index + 1];
    if (nextValue === undefined) {
      return {
        resultValue: column,
        resultTemperatureValue: value,
      };
    }

    if (averageTemperature >= value && averageTemperature < nextValue) {
      return {
        resultValue: column,
        resultTemperatureValue: value,
      };
    }
  }

  throw new Error("Percentiles not found");
}

/**
 * Stores the selected station preference using the current read-model storage key.
 */
export function writeSelectedStationPreference(
  storage: PreferenceStorage,
  preference: StationPreference,
): void {
  try {
    storage.setItem(stationPreferenceStorageKey, JSON.stringify(preference));
  } catch (error) {
    console.warn("Error saving selected station preference:", error);
  }
}

/**
 * Reads the selected station preference, migrating legacy keys when possible.
 *
 * Falls back to the supplied default station when storage is unavailable,
 * empty, invalid, or contains an older malformed value.
 */
export function readSelectedStationPreference(
  storage: PreferenceStorage,
  defaultStation: StationPreference = DEFAULT_STATION,
): StationPreference {
  const currentPreference = readStoredStationPreference(
    storage,
    stationPreferenceStorageKey,
  );
  if (currentPreference) return currentPreference;

  for (const legacyKey of legacyStationPreferenceStorageKeys) {
    const legacyPreference = readStoredStationPreference(storage, legacyKey);
    if (legacyPreference) {
      writeSelectedStationPreference(storage, legacyPreference);
      removeStoredStationPreference(storage, legacyKey);
      return legacyPreference;
    }
  }

  return defaultStation;
}

/**
 * Creates the initial Ali je vroce read-model state from persisted station choice.
 */
export function createInitialReadModelState(
  storage: PreferenceStorage,
  defaultStation: StationPreference = DEFAULT_STATION,
): ReadModelState {
  const selectedStation = readSelectedStationPreference(storage, defaultStation);

  return {
    selectedStation,
    stationPrefix: selectedStation.prefix,
    result: "",
    resultTemperature: "C",
    timeMin: "",
    timeMax: "",
    timeUpdated: "",
  };
}

/**
 * Converts the Datasette stations payload into station models used by the UI.
 */
export function toProcessedStations(
  stationsResponse: Pick<StationsResponse, "rows">,
): ProcessedStation[] {
  return stationsResponse.rows.map((row) => {
    const nameParts = row[3].split(" ");
    return {
      station_id: row[1],
      name_locative: nameParts.slice(1).join(" "),
      prefix: nameParts[0] ?? "",
    };
  });
}

/**
 * Converts the UI-facing processed station shape into the persisted preference shape.
 */
export function toStationPreference(station: ProcessedStation): StationPreference {
  return {
    value: station.station_id,
    label: station.name_locative,
    prefix: station.prefix,
  };
}

/**
 * Converts a persisted station preference back into the processed station shape
 * expected by existing UI modules.
 */
export function toProcessedStation(
  preference: StationPreference | null,
): ProcessedStation | null {
  if (!preference) return null;

  return {
    station_id: preference.value,
    name_locative: preference.label,
    prefix: preference.prefix,
  };
}

/**
 * Maps loaded current-hotness data into the display fields consumed by the UI adapter.
 */
export function toDisplayFields(
  data: ProcessedTemperatureData,
): CurrentHotnessDisplayFields {
  return {
    result: data.resultValue,
    resultTemperature: `${data.resultTemperatureValue} °C`,
    tempMin: data.tempMin,
    timeMin: data.timeMin,
    tempMax: data.tempMax,
    timeMax: data.timeMax,
    tempAvg: data.tempAvg,
    timeUpdated: data.timeUpdated,
  };
}

/**
 * Returns the date used to load historical percentile thresholds for current hotness.
 */
export function dateForCurrentHotnessPercentiles(
  stationData: RequestStationData,
): string {
  return formatDateForQuery(new Date(Number(stationData.statistics.timestamp)));
}

/**
 * Combines Vremenar station statistics and Datasette percentile thresholds into
 * the current-hotness model used by the page.
 */
export function toProcessedCurrentHotness(
  stationData: RequestStationData,
  percentileResponse: CurrentHotnessPercentileResponse,
): ProcessedTemperatureData {
  const statistics = stationData.statistics;
  const averageTemperature = statistics.temperature_average_24h;
  const timeUpdated = new Date(Number(statistics.timestamp));
  const timeMinDate = new Date(Number(statistics.timestamp_temperature_min_24h));
  const timeMaxDate = new Date(Number(statistics.timestamp_temperature_max_24h));

  const rawValues = percentileResponse.rows[0];
  if (!rawValues) throw new Error("Percentiles not found");

  const columns = percentileResponse.columns.slice(1);
  const values = rawValues.slice(1).map(toNumber);
  const bucket = findCurrentHotnessBucket(
    averageTemperature,
    columns,
    values,
  );

  return {
    ...bucket,
    tempMin: statistics.temperature_min_24h,
    timeMin: formatTime(timeMinDate, timeUpdated),
    tempMax: statistics.temperature_max_24h,
    timeMax: formatTime(timeMaxDate, timeUpdated),
    tempAvg: averageTemperature,
    timeUpdated: new Intl.DateTimeFormat("sl-SI", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(timeUpdated),
  };
}

/**
 * Builds the temporary current-hotness display shown while a station change reloads.
 *
 * Cached station data wins and is marked as refreshing. If there is no cached
 * station data but the page has previous data, a neutral loading placeholder is
 * returned. Without either source, there is no optimistic display.
 */
export function createOptimisticDisplayFields(
  cachedData: ProcessedTemperatureData | null | undefined,
  previousData: ProcessedTemperatureData | null | undefined,
): CurrentHotnessDisplayFields | null {
  if (cachedData) {
    return {
      ...toDisplayFields(cachedData),
      timeUpdated: `${cachedData.timeUpdated} (osvežujem...)`,
    };
  }

  if (!previousData) return null;

  return {
    result: "p40",
    resultTemperature: "...",
    tempMin: "...",
    timeMin: "...",
    tempMax: "...",
    timeMax: "...",
    tempAvg: "...",
    timeUpdated: "Nalagam sveže podatke...",
  };
}
