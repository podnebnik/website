/**
 * Raw API shapes: Datasette and Vremenar responses and raw rows.
 * These types represent the data as returned by external services and
 * should be validated at runtime (guards live against these shapes).
 */

// raw API shapes do not currently reference common primitives directly here

// =============================================================================
// DATASETTE API TYPES (raw)
// =============================================================================

export interface DatasetteQuery {
  sql: string;
  params: Record<string, any>;
}

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

export type TemperatureStationRow = [
  number,
  string,
  string,
  string,
  number,
  string,
  number,
  number,
  number
];

export type TemperaturePercentileRow = [
  number,
  number,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type StationRow = [number, number, string, string];

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
// VREMENAR (weather) API RAW TYPES
// =============================================================================

export interface VremenarCoordinate {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface VremenarStation {
  id: string;
  name: string;
  coordinate: VremenarCoordinate;
  zoom_level: number;
  forecast_only: boolean;
  alerts_area: string;
}

export interface VremenarCondition {
  observation: string;
  timestamp: string;
  icon: string;
  temperature: number;
}

export interface VremenarStatistics {
  timestamp: string;
  temperature_average_24h: number;
  temperature_average_48h: number;
  temperature_min_24h: number;
  temperature_max_24h: number;
  timestamp_temperature_min_24h: string;
  timestamp_temperature_max_24h: string;
}

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

// Backwards-compatible legacy export name
export type RequestStationData = VremenarStationDetailsResponse;
