// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Source of truth: data/climate-si/datapackage.yaml (D-18, T-5.3a/b).
// Regenerate with:
//   uv run --project data/climate-si/sources python data/climate-si/sources/generate_frontend_schema.py
// Generator: data/climate-si/sources/generate_frontend_schema.py
//
// Per datasette table this file declares a row interface (Ds<Table>), a
// column tuple (<TABLE>_COLUMNS, `as const`) and a column union (<Table>Col).
// api.ts / types.ts consume these so a datapackage column rename that is not
// mirrored into the frontend becomes a `yarn typecheck` error, not a live
// page break. A pytest freshness gate keeps this file in sync with datapackage.
//
// `daily_percentiles` is declared in datapackage but fetched zero times, so it
// is intentionally excluded here (exclusion from the generator, NOT removal from
// the datasette — D-18).

export interface DsAnnualTrend {
  era5_name: string;
  station_id: number;
  variable: string;
  month: number;
  day: number;
  day_label: string;
  year_min: number;
  year_max: number;
  trend10: number;
  p_val: number;
  tau: number;
  n_years: number;
  proj_end_year: number;
  slope: number;
  intercept: number;
  slope_hi: number;
  intercept_hi: number;
  slope_lo: number;
  intercept_lo: number;
  scatter_json: string;
}

export const ANNUAL_TREND_COLUMNS = [
  "era5_name",
  "station_id",
  "variable",
  "month",
  "day",
  "day_label",
  "year_min",
  "year_max",
  "trend10",
  "p_val",
  "tau",
  "n_years",
  "proj_end_year",
  "slope",
  "intercept",
  "slope_hi",
  "intercept_hi",
  "slope_lo",
  "intercept_lo",
  "scatter_json",
] as const;
export type AnnualTrendCol = (typeof ANNUAL_TREND_COLUMNS)[number];

export interface DsDaily {
  station_id: number;
  era5_name: string;
  date: string;
  year: number;
  month: number;
  day: number;
  temperature_max_2m: number;
  temperature_average_2m: number;
  temperature_min_2m: number;
}

export const DAILY_COLUMNS = [
  "station_id",
  "era5_name",
  "date",
  "year",
  "month",
  "day",
  "temperature_max_2m",
  "temperature_average_2m",
  "temperature_min_2m",
] as const;
export type DailyCol = (typeof DAILY_COLUMNS)[number];

export interface DsDailyWindow {
  era5_name: string;
  station_id: number;
  month: number;
  day: number;
  p5: number;
  p10: number;
  p20: number;
  p50: number;
  p80: number;
  p95: number;
  n_samples: number;
  year_min: number;
  year_max: number;
  distribution_json: string;
}

export const DAILY_WINDOW_COLUMNS = [
  "era5_name",
  "station_id",
  "month",
  "day",
  "p5",
  "p10",
  "p20",
  "p50",
  "p80",
  "p95",
  "n_samples",
  "year_min",
  "year_max",
  "distribution_json",
] as const;
export type DailyWindowCol = (typeof DAILY_WINDOW_COLUMNS)[number];

export interface DsSeasonHeatmap {
  era5_name: string;
  station_id: number;
  x: number;
  y: number;
  season: string;
  avg: number;
  percentile: number;
  cat: string;
  rank: number;
  total: number;
  color: string;
  n_days: number;
}

export const SEASON_HEATMAP_COLUMNS = [
  "era5_name",
  "station_id",
  "x",
  "y",
  "season",
  "avg",
  "percentile",
  "cat",
  "rank",
  "total",
  "color",
  "n_days",
] as const;
export type SeasonHeatmapCol = (typeof SEASON_HEATMAP_COLUMNS)[number];

export interface DsStations {
  era5_name: string;
  name: string;
  official_name: string;
  name_locative: string;
  station_id: number;
  xml_id: string;
  lat: number;
  lon: number;
  elevation: number;
  elevation_era5_m: number;
}

export const STATIONS_COLUMNS = [
  "era5_name",
  "name",
  "official_name",
  "name_locative",
  "station_id",
  "xml_id",
  "lat",
  "lon",
  "elevation",
  "elevation_era5_m",
] as const;
export type StationsCol = (typeof STATIONS_COLUMNS)[number];

export interface DsTropical {
  era5_name: string;
  station_id: number;
  kind: string;
  threshold: number;
  streak: number;
  years_json: string;
  counts_json: string;
  nonzero_count: number;
  trend_json: string;
}

export const TROPICAL_COLUMNS = [
  "era5_name",
  "station_id",
  "kind",
  "threshold",
  "streak",
  "years_json",
  "counts_json",
  "nonzero_count",
  "trend_json",
] as const;
export type TropicalCol = (typeof TROPICAL_COLUMNS)[number];

export interface DsSpei {
  x: number;
  y: number;
  spei: number;
  balance: number;
  cat: string;
  rank: number;
  total: number;
  color: string;
  season: string;
  n_days: number;
}

export const SPEI_COLUMNS = [
  "x",
  "y",
  "spei",
  "balance",
  "cat",
  "rank",
  "total",
  "color",
  "season",
  "n_days",
] as const;
export type SpeiCol = (typeof SPEI_COLUMNS)[number];

export interface DsSpeiStation {
  era5_name: string;
  station_id: number;
  series: string;
  years_json: string;
  spei_json: string;
  trend_json: string;
}

export const SPEI_STATION_COLUMNS = [
  "era5_name",
  "station_id",
  "series",
  "years_json",
  "spei_json",
  "trend_json",
] as const;
export type SpeiStationCol = (typeof SPEI_STATION_COLUMNS)[number];
