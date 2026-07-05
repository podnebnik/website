import type { TodayStatus, Last7, AnnualTrendRow, AnnualTrend, SiteMeta, SeasonHeatmapRow, RegressionResult, RegressionResponse, DailyWindowRow } from "./types.ts";

// In dev: empty string = same-origin proxy (Vite config or dev-proxy)
// In prod: set VITE_ERA5_SIDECAR_URL at build time (e.g. https://era5.podnebnik.org)
const SIDECAR = (import.meta.env.VITE_ERA5_SIDECAR_URL as string | undefined) ?? "";

async function get<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  return resp.json() as Promise<T>;
}

export function fetchMeta(): Promise<SiteMeta> {
  return get(`${SIDECAR}/api/live/meta`);
}

export function fetchTodayStatus(date: string, loc: string | null): Promise<TodayStatus> {
  const params = new URLSearchParams({ date });
  if (loc) params.set("loc", loc);
  return get(`${SIDECAR}/api/live/today_status?${params}`);
}

export function fetchLast7(date: string, loc: string | null): Promise<Last7> {
  const params = new URLSearchParams({ date });
  if (loc) params.set("loc", loc);
  return get(`${SIDECAR}/api/live/today_status/last7?${params}`);
}

export function fetchDailyWindow(station: string | null, month: number, day: number): Promise<DailyWindowRow[]> {
  const s = station ?? "Ljubljana";
  const params = new URLSearchParams({ station: s, month: String(month), day: String(day) });
  return get<DailyWindowRow[]>(`${SIDECAR}/api/live/daily_window?${params}`);
}

export async function fetchPageData(
  date: string,
  loc: string | null,
): Promise<{ status: TodayStatus; last7: Last7 }> {
  const [status, last7] = await Promise.all([
    fetchTodayStatus(date, loc),
    fetchLast7(date, loc),
  ]);
  return { status, last7 };
}

export async function fetchSeasonHeatmap(): Promise<SeasonHeatmapRow[]> {
  const result = await get<{ available: boolean; data: SeasonHeatmapRow[] }>(`${SIDECAR}/api/live/season_heatmap`);
  return result.available ? result.data : [];
}

export interface RegressionParams {
  locs:   string[];
  var:    string;
  doy:    number;
  window: number;
  corr:   "raw" | "corr";
  method: "theilsen" | "ols";
}

export function fetchRegression(p: RegressionParams): Promise<RegressionResponse> {
  const params = new URLSearchParams({ var: p.var, doy: String(p.doy), window: String(p.window), corr: p.corr, method: p.method });
  p.locs.forEach(l => params.append("loc", l));
  return get<RegressionResponse>(`${SIDECAR}/api/live/regression?${params}`);
}

export function fetchSpeiHeatmap(): Promise<any> {
  return get(`${SIDECAR}/api/live/spei_heatmap`);
}

export function fetchSpeiStationSeasonal(): Promise<any> {
  return fetch(`${SIDECAR}/api/live/spei_station_seasonal`).then(r => {
    if (r.status === 204) return null;
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

export interface CalendarRow {
  month:   number;
  day:     number;
  trend10: number;
  p_val:   number;
}

export interface CalendarData {
  loc:          string;
  var:          string;
  unit:         string;
  method_label: string;
  rows:         CalendarRow[];
}

export function fetchCalendar(
  loc: string, variable: string, window_: number,
  corr: "raw" | "corr", method: "theilsen" | "ols"
): Promise<CalendarData> {
  const params = new URLSearchParams({
    loc, var: variable, window: String(window_), corr, method,
  });
  return get<CalendarData>(`${SIDECAR}/api/live/calendar?${params}`);
}

export async function fetchAnnualTrend(month: number, day: number, loc?: string | null): Promise<AnnualTrend> {
  const params = new URLSearchParams({ month: String(month), day: String(day) });
  if (loc) params.set("loc", loc);
  const url = `${SIDECAR}/api/live/annual_trend?${params}`;
  const rows = await get<AnnualTrendRow[]>(url);
  if (!rows.length) throw new Error("No annual trend row");
  const r = rows[0]!;
  return {
    dayLabel:  r.day_label,
    monthNum:  r.month,
    dayNum:    r.day,
    yearMin:   r.year_min,
    yearMax:   r.year_max,
    trend10:   r.trend10,
    pVal:      r.p_val,
    tau:       r.tau,
    nYears:    r.n_years,
    scatter:   JSON.parse(r.scatter_json) as Array<{ x: number; y: number }>,
    histLine: {
      x:     JSON.parse(r.hist_x_json) as number[],
      y:     JSON.parse(r.hist_y_json) as number[],
      upper: JSON.parse(r.hist_upper_json) as number[],
      lower: JSON.parse(r.hist_lower_json) as number[],
    },
    projLine: {
      x:     JSON.parse(r.proj_x_json) as number[],
      y:     JSON.parse(r.proj_y_json) as number[],
      upper: JSON.parse(r.proj_upper_json) as number[],
      lower: JSON.parse(r.proj_lower_json) as number[],
    },
  };
}
