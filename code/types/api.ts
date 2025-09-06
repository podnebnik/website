/**
 * Compatibility wrapper: re-export raw API shapes from `api-raw.ts` and
 * UI models from `models.ts`. This keeps older imports working while
 * encouraging consumers to import directly from `api-raw` or `models`.
 */

export * from './api-raw.js';
export * from './models.js';

// Legacy type aliases (type-only re-exports)
// Aliases removed: types are re-exported via export *; keep imports targeting `api` working.
/**
 * API response types for external services used by the Podnebnik website
 * These types are based on actual API response analysis and should be validated at runtime
 * 
 * See: code/types/api-analysis.md for detailed comparison with previous JSDoc types
 */

import { ISODateString } from './common.js';

// =============================================================================
// DATASETTE API TYPES (Climate Data Service)
// =============================================================================

/**
 * Information about the executed SQL query
 */
export interface DatasetteQuery {
  sql: string;
  params: Record<string, any>;
}

/**
 * Generic Datasette API response wrapper
 * All Datasette endpoints return this structure
 */
export interface DatasetteResponse<T = any[]> {
  database: string;
  table: string;
  is_view: boolean;
  human_description_en: string;
  rows: T[];
  truncated: boolean;
  filtered_table_rows_count: number;
  expanded_columns: string[];
  expandable_columns: string[];
  columns: string[];
  primary_keys: string[];
  units: Record<string, any>;
  query: DatasetteQuery;
  facet_results: Record<string, any>;
  suggested_facets: Array<{
    name: string;
    type?: string;
    toggle_url: string;
  }>;
  next: string | null;
  next_url: string | null;
  private: boolean;
  allow_execute_sql: boolean;
  query_ms: number;
}

// =============================================================================
// TEMPERATURE STATION TYPES (Based on actual Datasette responses)
// =============================================================================

/**
 * Raw temperature station row from Datasette API
 * Based on actual response: [rowid, official_name, name, name_locative, station_id, xml_id, elevation, longitude, latitude]
 */
export type TemperatureStationRow = [
  number,    // rowid
  string,    // official_name
  string,    // name  
  string,    // name_locative
  number,    // station_id
  string,    // xml_id
  number,    // elevation
  number,    // longitude
  number     // latitude
];

/**
 * Processed station data for UI components (extracted from name_locative)
 */
export interface ProcessedStation {
  station_id: number;      // From API row[4]
  name_locative: string;   // Processed locative name (without prefix)
  prefix: string;          // Extracted prefix (e.g., "v", "na")
}

// =============================================================================
// TEMPERATURE PERCENTILE TYPES 
// =============================================================================

/**
 * Raw percentile data row from Datasette API
 * Based on actual response: [rowid, station_id, date, p00, p05, p20, p40, p50, p60, p80, p95, p100]
 */
export type TemperaturePercentileRow = [
  number,    // rowid
  number,    // station_id
  string,    // date (ISO date string)
  number,    // p00 - 0th percentile
  number,    // p05 - 5th percentile
  number,    // p20 - 20th percentile 
  number,    // p40 - 40th percentile
  number,    // p50 - 50th percentile (median)
  number,    // p60 - 60th percentile
  number,    // p80 - 80th percentile
  number,    // p95 - 95th percentile
  number     // p100 - 100th percentile (max)
];

/**
 * Processed percentile data for easier access
 */
export interface TemperaturePercentiles {
  stationId: number;
  date: ISODateString;
  percentiles: {
    p00: number;
    p05: number;
    p20: number;
    p40: number;
    p50: number; // median
    p60: number;
    p80: number;
    p95: number;
    p100: number;
  };
}

// =============================================================================
// VREMENAR API TYPES (Weather Service)
// =============================================================================

/**
 * Complete station data response from Vremenar API
 * Based on actual API response analysis
 */
export interface RequestStationData {
  station: {
    id: string;
    name: string;
    coordinate: {
      latitude: number;
      longitude: number;
      altitude: number;
    };
    zoom_level: number;
    forecast_only: boolean;
    alerts_area: string;
  };
  condition: {
    observation: string;
    timestamp: string;
    icon: string;
    temperature: number;
  };
  statistics: {
    timestamp: string;
    temperature_average_24h: number;
    temperature_average_48h: number;
    temperature_min_24h: number;
    temperature_max_24h: number;
    timestamp_temperature_min_24h: string;
    timestamp_temperature_max_24h: string;
  };
}

/**
 * Station coordinate information from Vremenar API
 */
export interface VremenarCoordinate {
  latitude: number;
  longitude: number;
  altitude: number;
}

/**
 * Station information from Vremenar API
 */
export interface VremenarStation {
  id: string;                // e.g., "METEO-1495"
  name: string;              // e.g., "Ljubljana"
  coordinate: VremenarCoordinate;
  zoom_level: number;
  forecast_only: boolean;
  alerts_area: string;       // e.g., "SI009"
}

/**
 * Current weather condition from Vremenar API
 */
export interface VremenarCondition {
  observation: string;       // e.g., "recent"
  timestamp: string;         // Unix timestamp as string
  icon: string;             // Weather icon identifier
  temperature: number;      // Current temperature
}

/**
 * Weather statistics from Vremenar API (24h and 48h data)
 */
export interface VremenarStatistics {
  timestamp: string;         // Unix timestamp as string
  temperature_average_24h: number;
  temperature_average_48h: number;
  temperature_min_24h: number;
  temperature_max_24h: number;
  timestamp_temperature_min_24h: string;  // Unix timestamp as string
  timestamp_temperature_max_24h: string;  // Unix timestamp as string
}

/**
 * Complete Vremenar station details response
 * Based on actual API response analysis
 */
export interface VremenarStationDetailsResponse {
  station: VremenarStation;
  condition: VremenarCondition;
  statistics: VremenarStatistics;
}

export interface HistoricalWindowResponseJson {
  year: number;
  tavg?: number;
  temperature_average?: number;
  avg?: number;
  tempAvg?: number;
  temp_mean?: number;
  tmin?: number;
  tmax?: number;
  day_offset?: number;
}

// =============================================================================
// PROCESSED DATA TYPES (for application logic)
// =============================================================================

/**
 * Temperature data processed for UI display
 * Based on actual processing in helpers.mjs
 */
export interface ProcessedTemperatureData {
  resultValue: string;           // Percentile bucket (e.g., "p20", "p40")
  resultTemperatureValue: number; // Temperature value for the percentile
  tempMin: number;              // 24h minimum temperature
  timeMin: string;              // Formatted time of minimum
  tempMax: number;              // 24h maximum temperature
  timeMax: string;              // Formatted time of maximum
  tempAvg: number;              // 24h average temperature
  timeUpdated: string;          // Formatted last update time
}

// =============================================================================
// API ERROR TYPES
// =============================================================================

// =============================================================================
// STATIONS API TYPES (Specific to stations endpoint)
// =============================================================================

/**
 * Raw station row from Datasette API
 * Based on actual response: [rowid, station_id, name, name_locative]
 */
export type StationRow = [number, number, string, string];

/**
 * Stations API response from Datasette
 * Based on actual API response analysis
 */
export interface StationsResponse {
    database: string;
    table: string;
    is_view: boolean;
    human_description_en: string;
    rows: StationRow[];
    truncated: boolean;
    filtered_table_rows_count: number;
    expanded_columns: string[];
    expandable_columns: string[];
    columns: string[];
    primary_keys: string[];
    units: Record<string, string>;
    query: {
        sql: string;
        params: Record<string, unknown>;
    };
    facet_results: Record<string, unknown>;
    suggested_facets: Record<string, unknown>[];
    next: null | string;
    next_url: null | string;
    private: boolean;
    allow_execute_sql: boolean;
    query_ms: number;
}

// =============================================================================
// QUERY PARAMETER TYPES
// =============================================================================


