/** ERA5 sidecar /api/live/today_status response */
export interface TodayStatus {
  available:    boolean;
  date?:        string;
  today_temp?:  number;
  percentile?:  number;
  category_key?: string;
  color?:       string;
  n_samples?:   number;
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

/** ERA5 sidecar /api/live/today_status/last7 response */
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

/** Datasette si_annual_trend row */
export interface AnnualTrendRow {
  month:           number;
  day:             number;
  day_label:       string;
  year_min:        number;
  year_max:        number;
  trend10:         number;
  p_val:           number;
  tau:             number;
  n_years:         number;
  scatter_json:    string;
  hist_x_json:     string;
  hist_y_json:     string;
  hist_upper_json: string;
  hist_lower_json: string;
  proj_x_json:     string;
  proj_y_json:     string;
  proj_upper_json: string;
  proj_lower_json: string;
}

/** Datasette si_daily_window row */
export interface DailyWindowRow {
  station:           string;
  month:             number;
  day:               number;
  p5:                number;
  p10:               number;
  p20:               number;
  p50:               number;
  p80:               number;
  p95:               number;
  n_samples:         number;
  year_min:          number;
  year_max:          number;
  distribution_json: string;
}

/** ERA5 sidecar /api/live/meta response */
export interface SiteMeta {
  country:          string;
  name:             string;
  default_location: string;
  languages:        string[];
  default_language: string;
  features:         Record<string, boolean>;
  map:              { center_lat: number; center_lon: number; zoom: number };
  branding:         { site_title: string; domain: string };
  stations: Array<{ name: string; lat: number; lon: number; elevation: number }>;
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

/** ERA5 sidecar /api/live/regression — single location result */
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

/** ERA5 sidecar /api/live/regression response */
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
