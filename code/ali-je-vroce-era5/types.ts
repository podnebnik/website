import type { DsAnnualTrend, DsDailyWindow } from "./generated/datasette-schema.ts";

/** Today's status for one location — assembled in api.ts:218 from datasette rows
 *  plus the Open-Meteo live max. Never a sidecar payload (T-2.3, D-1). */
export interface TodayStatus {
  available:    boolean;
  date?:        string;
  today_temp?:  number;
  percentile?:  number;
  category_key?: string;
  color?:       string;
  n_samples?:   number;
  // National aggregate: how many stations were pooled (for the national view `n_samples`
  // is the SUM across stations); 1 on a single station. Used to recover per-station
  // day-counts in the distribution tooltip (T-5.22). Absent → treat as 1.
  station_count?: number;
  year_min?:    number;
  year_max?:    number;
  distribution?: [number, number][];
  cutoffs?: {
    p5: number; p10: number; p20: number;
    p50: number; p80: number; p95: number;
  };
  day_label?:   string;
  month_num?:   number;
  day_num?:     number;
  rank_info?:      RankInfo | null;
  loc?:            string | null;
  is_preliminary?: boolean;
}

export interface RankInfo {
  rank:      number;
  total:     number;
  direction: "hot" | "cold";
  top5:      Array<{ year: number; date: string; temp: number; is_today?: boolean }>;
}

/** Last seven days — assembled in api.ts:291 from the same datasette rows. */
export interface Last7 {
  available: boolean;
  days: Array<{
    date:         string;
    day_label:    string;
    today_temp:   number;
    percentile:   number;
    category_key: string;
    color:        string;
  }>;
}

/** Datasette climate-si annual_trend row (slim projection: line params, not point
 *  arrays). Columns are Pick'd from the generated datapackage contract (T-5.3b, D-18)
 *  so a column renamed in datapackage.yaml — regenerating datasette-schema.ts —
 *  becomes a compile error here. The declared `station_id` and `variable` columns are
 *  intentionally NOT picked: the frontend reads neither as a row field (`variable` is
 *  only ever a URL filter value), so renaming them cannot break a read. */
export type AnnualTrendRow = Pick<
  DsAnnualTrend,
  | "era5_name" | "month" | "day" | "day_label" | "year_min" | "year_max"
  | "trend10" | "p_val" | "tau" | "n_years" | "proj_end_year" | "scatter_json"
  // fitted line parameters — central + upper/lower CI (y = slope·x + intercept)
  | "slope" | "intercept" | "slope_hi" | "intercept_hi" | "slope_lo" | "intercept_lo"
>;

/** Datasette climate-si daily_window row. The p5..p95 cutoffs and metadata are Pick'd
 *  from the generated datapackage contract (T-5.3b) so a rename breaks compilation.
 *  `station` is synthesized client-side from the era5_name column (api.ts
 *  fetchDailyWindow / fetchEra5NationalWindowRow) and is NOT a datasette column. */
export interface DailyWindowRow extends Pick<
  DsDailyWindow,
  | "month" | "day"
  | "p5" | "p10" | "p20" | "p50" | "p80" | "p95"
  | "n_samples" | "year_min" | "year_max" | "distribution_json"
> {
  station: string;
  // National synthetic row only: number of stations pooled into this aggregate
  // (`n_samples` is their SUM). Undefined on real per-station datasette rows. T-5.22.
  station_count?: number;
}

/** Site metadata — built client-side in api.ts:173 from the datasette stations
 *  table plus literals defined in that function. */
export interface SiteMeta {
  country:          string;
  name:             string;
  default_location: string;
  languages:        string[];
  default_language: string;
  map:              { center_lat: number; center_lon: number; zoom: number };
  branding:         { site_title: string };
  stations: Array<{ name: string; label: string; source: "era5" | "arso"; lat: number; lon: number; elevation: number }>;
  strings:          { explain_reg: string; explain_cal: string };
}

/** Datasette si_season_heatmap row */
export interface SeasonHeatmapRow {
  x:          number;
  y:          number;
  season:     "Winter" | "Spring" | "Summer" | "Autumn";
  avg:        number;
  percentile: number;
  cat:        "cold" | "cool" | "normal" | "hot" | "extreme";
  rank:       number;
  total:      number;
  color:      string;
  n_days:     number;
}

/** Regression result for one location — built from an
 *  annual_trend row (buildRegressionResult, api.ts:376). */
export interface RegressionResult {
  loc:      string;
  year_min: number;
  year_max: number;
  color?:   string;
  scatter:  Array<{ x: number; y: number; color: string; anomaly: number }>;
  line: { x: number[]; y: number[]; upper: number[]; lower: number[] };
  baseline: number;
  stats: {
    method:     string;
    trend10:    number;
    metric:     number;
    metric_lbl: string;
    p_val:      number;
    direction:  string;
    chg_str:    string;
    fit_desc:   string;
    sig_label:  string;
    n_years:    number;
    ar1:        number | null;
  };
}

/** Regression response — assembled in api.ts:361 over the selected locations. */
export interface RegressionResponse {
  results:    RegressionResult[];
  date_label: string;
  ylabel:     string;
  unit:       string;
}

/** Parsed annual trend with arrays decoded from JSON columns */
export interface AnnualTrend {
  dayLabel:  string;
  monthNum:  number;
  dayNum:    number;
  yearMin:   number;
  yearMax:   number;
  trend10:   number;
  pVal:      number;
  tau:       number;
  nYears:    number;
  scatter:   Array<{ x: number; y: number }>;
  histLine:  { x: number[]; y: number[]; upper: number[]; lower: number[] };
  projLine:  { x: number[]; y: number[]; upper: number[]; lower: number[] };
}
