import type {
  TodayStatus, Last7, AnnualTrendRow, AnnualTrend, SiteMeta,
  SeasonHeatmapRow, RegressionResult, RegressionResponse, DailyWindowRow,
} from "./types.ts";
import type { SpeiData } from "./charts/SpeiHeatmap.tsx";
import type { SpeiStationData } from "./charts/SpeiTrendChart.tsx";
// The category palette lives with the percentile helpers salvaged from the
// deleted ARSO path (T-2.2 / D-2); see percentile.ts for why they were kept.
import { CAT_COLORS } from "./percentile.ts";

// podnebnik.org datasette serves each DB at the root (no /datasette prefix),
// e.g. https://stage-data.podnebnik.org/climate-si — override with VITE_DATASETTE_URL for dev.
export const DS_BASE = (import.meta.env.VITE_DATASETTE_URL as string | undefined) ?? "https://stage-data.podnebnik.org";
// ERA5 historical + precomputed stats
const DS = `${DS_BASE}/climate-si`;

// era5_name → {lat, lon, elevation}; used for Open-Meteo live temps. Elevation is
// REQUIRED: the datasette climatology is lapse-corrected to the true station
// elevation, so Open-Meteo must be downscaled to the same elevation (otherwise
// high peaks like Kredarica read far too warm at Open-Meteo's grid elevation).
let era5Coords: Record<string, { lat: number; lon: number; elevation: number }> = {};

// Slovenia average across all ERA5 stations (no precomputed national row exists
// in climate-si, so it is averaged client-side from the per-station data).
export const ERA5_NATIONAL = "era5:national";

// The ARSO/Vremenar subsystem was deleted under D-2 (T-2.2). This predicate is
// all that remains of it in api.ts, and only because three live components still
// branch on it: Era5SeasonHeatmap.tsx:13, Era5TropicalChart.tsx:50 and
// TodayCard.tsx:35,165,168,195,222. Nothing can make it return true any more —
// fetchMeta builds every station name from `era5_name` with source "era5"
// (:191-198 below), so no loc can start with "arso:". Removing the component
// branches is component work and touches copy frozen by D-11; see PROGRESS.md.
export function isArsoLoc(loc: string): boolean {
  return loc.startsWith("arso:");
}

const VAR_LABELS: Record<string, string> = {
  temperature_max:  "Max temperature (°C)",
  temperature_min:  "Min temperature (°C)",
  temperature_mean: "Mean temperature (°C)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function dsGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${DS}/${path}`);
  if (!resp.ok) throw new Error(`Datasette ${resp.status}: ${path}`);
  return resp.json() as Promise<T>;
}


export function doyToMonthDay(doy: number): { month: number; day: number } {
  const d = new Date(Date.UTC(2001, 0, 1));
  d.setUTCDate(d.getUTCDate() + doy - 1);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Its ARSO-path callers were deleted in T-2.2; it survives as a named target of
// T-4.5 (the leap-year doy fix) and is cited by tests/snapshot/cases.json:115.
// EXPORTED for the T-3.4 doy unit tests (tests/unit/doy.test.ts), which pin the
// FIXED non-leap day table it reads — exactly the thing T-4.5 will change. The
// `@ts-expect-error TS6133` that previously guarded its unreferenced state is now
// obsolete (the test import references it) and was removed with the export.
export function monthDayToDoy(month: number, day: number): number {
  const DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return (DAYS[month - 1] ?? 0) + day;
}

// Generate approximate normal distribution from known percentile values.
// Temperature data is roughly normal; this gives DistributionChart a curve to draw.
function syntheticDistribution(p05: number, p50: number, p95: number): [number, number][] {
  const sigma = Math.max((p95 - p05) / 3.29, 0.5); // 90-pct span ÷ 3.29σ
  const mu    = p50;
  const lo    = mu - 4 * sigma;
  const hi    = mu + 4 * sigma;
  const norm  = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const x = lo + (hi - lo) * i / 60;
    const y = norm * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
    pts.push([parseFloat(x.toFixed(2)), parseFloat(y.toFixed(6))]);
  }
  return pts;
}

function dateToMonthDay(dateStr: string): { month: number; day: number } {
  const [, m, d] = dateStr.split("-");
  return { month: Number(m), day: Number(d) };
}

function dayLabel(month: number, day: number): string {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[month - 1]} ${day}`;
}

function categorizeEra5(temp: number, w: DailyWindowRow): { category_key: string; percentile: number; color: string } {
  if (temp >= w.p95) return { category_key: "hell",     percentile: 97.5, color: CAT_COLORS.hell     };
  if (temp >= w.p80) return { category_key: "hot",      percentile: 87.5, color: CAT_COLORS.hot      };
  if (temp >= w.p20) return { category_key: "nope",     percentile: 50,   color: CAT_COLORS.nope     };
  if (temp >= w.p10) return { category_key: "cold",     percentile: 15,   color: CAT_COLORS.cold     };
  return                    { category_key: "freezing", percentile:  5,   color: CAT_COLORS.freezing };
}

async function fetchEra5WindowRow(era5Name: string, month: number, day: number): Promise<DailyWindowRow | null> {
  const rows = await dsGet<DailyWindowRow[]>(
    `daily_window.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&month__exact=${month}&day__exact=${day}`
  );
  return rows[0] ?? null;
}

// Slovenia national ±window climatology = mean of the 18 stations' daily_window
// rows for this month/day. Distribution is synthesised from the averaged
// p5/p50/p95 (syntheticDistribution, not the empirical curve the per-station
// daily_window rows carry — see T-4.7).
export async function fetchEra5NationalWindowRow(month: number, day: number): Promise<DailyWindowRow | null> {
  const rows = await dsGet<DailyWindowRow[]>(
    `daily_window.json?_shape=array&month__exact=${month}&day__exact=${day}&_size=50`
  );
  if (rows.length === 0) return null;
  const avg = (f: (r: DailyWindowRow) => number) =>
    rows.reduce((s, r) => s + (f(r) ?? 0), 0) / rows.length;
  const p5  = avg(r => r.p5),  p10 = avg(r => r.p10), p20 = avg(r => r.p20);
  const p50 = avg(r => r.p50), p80 = avg(r => r.p80), p95 = avg(r => r.p95);
  return {
    station: ERA5_NATIONAL,
    month, day,
    p5, p10, p20, p50, p80, p95,
    n_samples: rows.reduce((s, r) => s + (r.n_samples ?? 0), 0),
    year_min:  Math.min(...rows.map(r => r.year_min)),
    year_max:  Math.max(...rows.map(r => r.year_max)),
    distribution_json: JSON.stringify(syntheticDistribution(p5, p50, p95)),
  } as DailyWindowRow;
}

// ── Open-Meteo live (the ONLY correct live source for ERA5) ──────────────────
// ERA5-Land reanalysis lags ~5-10 days; the datasette stays authoritative for
// any date it has, and Open-Meteo fills only the recent gap (today/last days).
const OM = "https://api.open-meteo.com/v1/forecast";

async function openMeteoMax(lat: number, lon: number, elevation: number, date: string): Promise<number | null> {
  try {
    const resp = await fetch(`${OM}?latitude=${lat}&longitude=${lon}&elevation=${Math.round(elevation)}&daily=temperature_2m_max&timezone=UTC&start_date=${date}&end_date=${date}`);
    if (!resp.ok) return null;
    const d = await resp.json() as { daily?: { temperature_2m_max?: (number | null)[] } };
    return d?.daily?.temperature_2m_max?.[0] ?? null;
  } catch {
    return null;
  }
}

// National live = mean of the daily max across all ERA5 stations, in one call
// (Open-Meteo accepts comma-separated coordinate + elevation lists → array).
async function openMeteoNationalMax(date: string): Promise<number | null> {
  const coords = Object.values(era5Coords);
  if (coords.length === 0) return null;
  try {
    const lats  = coords.map(c => c.lat).join(",");
    const lons  = coords.map(c => c.lon).join(",");
    const elevs = coords.map(c => Math.round(c.elevation)).join(",");
    const resp = await fetch(`${OM}?latitude=${lats}&longitude=${lons}&elevation=${elevs}&daily=temperature_2m_max&timezone=UTC&start_date=${date}&end_date=${date}`);
    if (!resp.ok) return null;
    const d = await resp.json();
    const arr = Array.isArray(d) ? d : [d];
    const vals = arr
      .map((x: any) => x?.daily?.temperature_2m_max?.[0])
      .filter((v: any): v is number => v != null);
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
  } catch {
    return null;
  }
}

// ── fetchMeta ──────────────────────────────────────────────────────────────────

export async function fetchMeta(): Promise<SiteMeta> {
  // ERA5-only page: history/stats come entirely from the climate-si datasette.
  //
  // `_col=station_id` is now unused — it fed the Vremenar id map deleted with the
  // ARSO path (T-2.2 / D-2). It stays in the query because the T-1.2 fixture layer
  // keys on the EXACT request URL (`fixtures/install.ts`, index.routes[raw]), so
  // dropping the column would turn every offline run into a fixture miss. Drop it
  // when the fixtures are next re-recorded (the D-4/D-5 regeneration, Phase 4).
  const era5Stations = await dsGet<Array<{
    era5_name: string; name: string; lat: number; lon: number;
    elevation: number; station_id: number | null;
  }>>("stations.json?_shape=array&_col=era5_name&_col=name&_col=lat&_col=lon&_col=elevation&_col=station_id&_size=30");

  // Coordinates + true elevation for Open-Meteo live temps (elevation-corrected)
  era5Coords = Object.fromEntries(
    era5Stations.map(s => [s.era5_name, { lat: s.lat, lon: s.lon, elevation: s.elevation }])
  );

  const stations = era5Stations.map(s => ({
    name:      s.era5_name,
    label:     s.name,
    source:    "era5" as const,
    lat:       s.lat,
    lon:       s.lon,
    elevation: s.elevation,
  }));

  return {
    country:          "si",
    name:             "Slovenija",
    default_location: "Ljubljana",
    languages:        ["en"],
    default_language: "en",
    map:      { center_lat: 46.1, center_lon: 14.8, zoom: 7 },
    branding: { site_title: "Podnebnik · Ali je vroče?" },
    stations,
    strings: {
      explain_reg: "Theil-Sen regresija + Yue-Wang TFPW Mann-Kendall test · ERA5-Land · nadmorska korekcija",
      explain_cal: "Trend na desetletje za vsak dan v letu · rdeča = ogrevanje · modra = ohlajanje · prosojnost = statistična značilnost",
    },
  };
}

// ── fetchTodayStatus ───────────────────────────────────────────────────────────

export async function fetchTodayStatus(date: string, loc: string | null): Promise<TodayStatus> {
  const era5Name = loc ?? "Ljubljana";
  const { month, day } = dateToMonthDay(date);

  if (era5Name === ERA5_NATIONAL) {
    // ERA5-Land datasette is authoritative; Open-Meteo fills only the recent gap.
    const w = await fetchEra5NationalWindowRow(month, day);
    if (!w) return { available: false };

    const dsRows = await dsGet<Array<{ temperature_max_2m: number | null }>>(
      `daily.json?_shape=array&date__exact=${date}&_col=temperature_max_2m&_size=50`
    );
    const dsVals = dsRows.filter(r => r.temperature_max_2m != null).map(r => r.temperature_max_2m!);
    let todayTemp: number | null = dsVals.length > 0
      ? dsVals.reduce((a, b) => a + b) / dsVals.length
      : null;
    let isPreliminary = false;
    if (todayTemp == null) {
      // Beyond the reanalysis → live Open-Meteo national average (preliminary)
      todayTemp = await openMeteoNationalMax(date);
      isPreliminary = true;
    }
    if (todayTemp == null) return { available: false };

    const cat = categorizeEra5(todayTemp, w);
    return {
      available: true, date,
      today_temp: parseFloat(todayTemp.toFixed(1)), is_preliminary: isPreliminary,
      percentile: cat.percentile, category_key: cat.category_key, color: cat.color,
      n_samples: w.n_samples, year_min: w.year_min, year_max: w.year_max,
      distribution: JSON.parse(w.distribution_json) as [number, number][],
      cutoffs: { p5: w.p5, p10: w.p10, p20: w.p20, p50: w.p50, p80: w.p80, p95: w.p95 },
      day_label: dayLabel(month, day), month_num: month, day_num: day,
      rank_info: null, loc: ERA5_NATIONAL,
    };
  }

  // ERA5 path — datasette reanalysis is authoritative; Open-Meteo fills the gap.
  let todayTemp: number | null = null;
  let isPreliminary = false;

  const rows = await dsGet<Array<{ temperature_max_2m: number }>>(
    `daily.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&date__exact=${date}&_col=temperature_max_2m&_size=1`
  );
  if (rows[0]?.temperature_max_2m != null) {
    todayTemp = rows[0].temperature_max_2m;
  } else {
    // Beyond the reanalysis lag → live Open-Meteo forecast (preliminary),
    // downscaled to the station's true elevation to match the climatology.
    const coord = era5Coords[era5Name];
    if (coord) todayTemp = await openMeteoMax(coord.lat, coord.lon, coord.elevation, date);
    isPreliminary = true;
  }
  if (todayTemp == null) return { available: false };

  const w = await fetchEra5WindowRow(era5Name, month, day);
  if (!w) return { available: false };

  const cat = categorizeEra5(todayTemp, w);
  return {
    available: true, date,
    today_temp: todayTemp, is_preliminary: isPreliminary,
    percentile: cat.percentile, category_key: cat.category_key, color: cat.color,
    n_samples: w.n_samples, year_min: w.year_min, year_max: w.year_max,
    distribution: JSON.parse(w.distribution_json) as [number, number][],
    cutoffs: { p5: w.p5, p10: w.p10, p20: w.p20, p50: w.p50, p80: w.p80, p95: w.p95 },
    day_label: dayLabel(month, day), month_num: month, day_num: day,
    rank_info: null, loc: era5Name,
  };
}

// ── fetchLast7 ─────────────────────────────────────────────────────────────────

export async function fetchLast7(date: string, loc: string | null): Promise<Last7> {
  const era5Name = loc ?? "Ljubljana";

  // National ERA5 average has no per-day last-7 strip; the mini-chart is hidden.
  if (era5Name === ERA5_NATIONAL) return { available: false, days: [] };

  // ERA5 path
  const rows = await dsGet<Array<{
    date: string; temperature_max_2m: number; month: number; day: number;
  }>>(
    `daily.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&date__lte=${date}&_sort_desc=date&_size=7&_col=date&_col=temperature_max_2m&_col=month&_col=day`
  );
  if (!rows.length) return { available: false, days: [] };

  const dayResults = await Promise.all(
    rows.map(async r => {
      const w = await fetchEra5WindowRow(era5Name, r.month, r.day);
      if (!w || r.temperature_max_2m == null) return null;
      const cat = categorizeEra5(r.temperature_max_2m, w);
      return { date: r.date, day_label: dayLabel(r.month, r.day), today_temp: r.temperature_max_2m, percentile: cat.percentile, category_key: cat.category_key, color: cat.color };
    })
  );
  const days = dayResults.filter(Boolean) as Last7["days"];
  return { available: days.length > 0, days };
}

// ── fetchDailyWindow ───────────────────────────────────────────────────────────

export async function fetchDailyWindow(station: string | null, month: number, day: number): Promise<DailyWindowRow[]> {
  const loc = station ?? "Ljubljana";

  const rows = await dsGet<DailyWindowRow[]>(
    `daily_window.json?_shape=array&era5_name__exact=${encodeURIComponent(loc)}&month__exact=${month}&day__exact=${day}`
  );
  return rows.map(r => ({ ...r, station: (r as any).era5_name ?? loc }));
}

// ── fetchPageData ──────────────────────────────────────────────────────────────

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

// ── fetchSeasonHeatmap ─────────────────────────────────────────────────────────

export async function fetchSeasonHeatmap(loc?: string | null): Promise<SeasonHeatmapRow[]> {
  const era5Name = loc ?? "Ljubljana";
  return dsGet<SeasonHeatmapRow[]>(
    `season_heatmap.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&_col=x&_col=y&_col=season&_col=avg&_col=percentile&_col=cat&_col=rank&_col=total&_col=color&_col=n_days&_size=500`
  );
}

// ── fetchRegression ────────────────────────────────────────────────────────────

export interface RegressionParams {
  locs:   string[];
  var:    string;
  doy:    number;
  window: number;
  corr:   "raw" | "corr";
  method: "theilsen" | "ols";
}

export async function fetchRegression(p: RegressionParams): Promise<RegressionResponse> {
  const { month, day } = doyToMonthDay(p.doy);

  const era5Results = await Promise.all(
    p.locs.map(loc => buildRegressionResult(loc, p.var, month, day))
  );

  return {
    results:    era5Results.filter(Boolean) as RegressionResult[],
    date_label: dayLabel(month, day),
    ylabel:     VAR_LABELS[p.var] ?? `${p.var} (°C)`,
    unit:       "°C",
  };
}

async function buildRegressionResult(
  era5Name: string, variable: string, month: number, day: number
): Promise<RegressionResult | null> {
  const rows = await dsGet<AnnualTrendRow[]>(
    `annual_trend.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&variable__exact=${encodeURIComponent(variable)}&month__exact=${month}&day__exact=${day}&_size=1`
  );
  const r = rows[0];
  if (!r) return null;

  const scatter = JSON.parse(r.scatter_json) as Array<{ x: number; y: number }>;
  const baselineYears = scatter.filter(pt => pt.x >= 1961 && pt.x <= 1990);
  const baseline = baselineYears.length > 5
    ? baselineYears.reduce((s, pt) => s + pt.y, 0) / baselineYears.length
    : scatter.reduce((s, pt) => s + pt.y, 0) / scatter.length;

  return {
    loc: era5Name,
    year_min: r.year_min, year_max: r.year_max,
    scatter: scatter.map(pt => {
      const anomaly = pt.y - baseline;
      return { x: pt.x, y: pt.y, anomaly, color: anomaly >= 0 ? "#c25a2c" : "#3a5a8a" };
    }),
    // annual_trend stores the fit as line parameters (slope/intercept per central
    // + CI bounds); the fitted line and band are straight, so two endpoints over
    // [year_min, year_max] reproduce them exactly.
    line: {
      x:     [r.year_min, r.year_max],
      y:     [r.slope    * r.year_min + r.intercept,    r.slope    * r.year_max + r.intercept],
      upper: [r.slope_hi * r.year_min + r.intercept_hi, r.slope_hi * r.year_max + r.intercept_hi],
      lower: [r.slope_lo * r.year_min + r.intercept_lo, r.slope_lo * r.year_max + r.intercept_lo],
    },
    baseline,
    stats: {
      method: "Theil-Sen + TFPW MK", trend10: r.trend10, metric: r.trend10,
      metric_lbl: "trend / 10y", p_val: r.p_val,
      direction: r.trend10 >= 0 ? "up" : "down",
      chg_str: `${r.trend10 >= 0 ? "+" : ""}${r.trend10.toFixed(2)} °C/10y`,
      fit_desc: `τ = ${r.tau.toFixed(2)}`,
      sig_label: r.p_val < 0.05 ? "p < 0.05" : `p = ${r.p_val.toFixed(3)}`,
      n_years: r.n_years, ar1: null,
    },
  };
}

// ── Tropical days / nights ───────────────────────────────────────────────────

// Matches TropStation from TropicalChart.tsx so TropHighchart can be reused directly
export interface ArsoTropicalData {
  years:         number[];
  counts:        number[];
  nonzero_count: number;
  trend: {
    model_used:      "nb" | false;
    rate_per_year:   number;
    days_per_decade: number;
    p_value:         number;
    x_line:          number[];
    y_line:          number[];
    ci_low:          number[];
    ci_high:         number[];
    fit_year_max:    number;
    aic:             number;
    alpha:           number;
  };
}

// ERA5 tropical days/nights — read straight from the precomputed datasette
// `tropical` table (counts + NB-GLM trend per station × threshold × streak).
export async function fetchEra5Tropical(
  loc:       string,
  kind:      "days" | "nights",
  threshold: number,
  streak:    number = 1,
): Promise<ArsoTropicalData | null> {
  if (loc === ERA5_NATIONAL) return null;
  let rows: Array<{ years_json: string; counts_json: string; nonzero_count: number; trend_json: string }>;
  try {
    rows = await dsGet(
      `tropical.json?_shape=array&era5_name__exact=${encodeURIComponent(loc)}` +
      `&kind__exact=${kind}&threshold__exact=${threshold}&streak__exact=${streak}&_size=1`
    );
  } catch {
    // tropical table not yet published on this datasette
    return null;
  }
  const r = rows[0];
  if (!r) return null;
  const years  = JSON.parse(r.years_json)  as number[];
  const counts = JSON.parse(r.counts_json) as number[];
  const t = JSON.parse(r.trend_json) as ArsoTropicalData["trend"] | Record<string, never>;
  const trend = (t && (t as any).model_used) ? (t as ArsoTropicalData["trend"]) : {
    model_used: false as const, rate_per_year: 0, days_per_decade: 0, p_value: 1,
    x_line: [], y_line: [], ci_low: [], ci_high: [],
    fit_year_max: years[years.length - 1] ?? 0, aic: 0, alpha: 0,
  };
  return { years, counts, nonzero_count: r.nonzero_count, trend };
}

// ── SPEI stubs (no precipitation data) ────────────────────────────────────────

// SPEI national heatmap — read the precomputed climate-si `spei` table.
export async function fetchSpeiHeatmap(): Promise<SpeiData> {
  const empty: SpeiData = { available: false, data: [], year_min: 0, year_max: 0, baseline: null, era5_last: "" };
  try {
    const rows = await dsGet<Array<{
      y: number; spei: number; balance: number; cat: string; rank: number;
      total: number; color: string; season: string; n_days: number;
    }>>(
      `spei.json?_shape=array&_col=y&_col=spei&_col=balance&_col=cat&_col=rank&_col=total&_col=color&_col=season&_col=n_days&_size=2000`
    );
    if (!rows.length) return empty;
    const years = rows.map(r => r.y);
    return {
      available: true,
      data: rows.map(r => ({
        season: r.season, y: r.y, spei: r.spei, cat: r.cat, color: r.color,
        balance: r.balance, n_days: r.n_days, rank: r.rank, total: r.total,
      })),
      year_min: Math.min(...years), year_max: Math.max(...years),
      baseline: "1950–1980", era5_last: "",
    };
  } catch {
    return empty;
  }
}

// SPEI per-station SPEI-3/SPEI-30 series — read the `spei_station` table.
export async function fetchSpeiStationSeasonal(): Promise<SpeiStationData> {
  const empty: SpeiStationData = { available: false, stations: {}, era5_last: "", baseline: "", year_min: 0, year_max: 0 };
  try {
    const rows = await dsGet<Array<{
      era5_name: string; series: string; years_json: string; spei_json: string; trend_json: string;
    }>>(
      `spei_station.json?_shape=array&_col=era5_name&_col=series&_col=years_json&_col=spei_json&_col=trend_json&_size=1000`
    );
    if (!rows.length) return empty;
    const stations: SpeiStationData["stations"] = {};
    let ymin = Infinity, ymax = -Infinity;
    for (const r of rows) {
      const years = JSON.parse(r.years_json) as number[];
      const spei  = JSON.parse(r.spei_json)  as number[];
      const trend = JSON.parse(r.trend_json);
      (stations[r.era5_name] ??= {})[r.series] = { years, spei, trend };
      if (years.length) { ymin = Math.min(ymin, years[0]!); ymax = Math.max(ymax, years[years.length - 1]!); }
    }
    return {
      available: true, stations, era5_last: "", baseline: "1950–1980",
      year_min: ymin === Infinity ? 0 : ymin, year_max: ymax === -Infinity ? 0 : ymax,
    };
  } catch {
    return empty;
  }
}

// ── fetchCalendar ──────────────────────────────────────────────────────────────

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

export async function fetchCalendar(
  loc: string, variable: string, _window: number,
  _corr: "raw" | "corr", _method: "theilsen" | "ols"
): Promise<CalendarData> {
  const rows = await dsGet<CalendarRow[]>(
    `annual_trend.json?_shape=array&era5_name__exact=${encodeURIComponent(loc)}&variable__exact=${encodeURIComponent(variable)}&_col=month&_col=day&_col=trend10&_col=p_val&_size=400`
  );
  return { loc, var: variable, unit: "°C", method_label: "Theil-Sen + TFPW MK", rows };
}

// ── fetchAnnualTrend ───────────────────────────────────────────────────────────

// National annual trend = mean of the 18 stations' temperature_max rows for this
// day: scatter averaged per year, line params averaged. (Interim client-side
// pooling; the precompute will eventually bake an era5:national row.)
async function fetchNationalAnnualTrendRow(month: number, day: number): Promise<AnnualTrendRow | undefined> {
  const rows = await dsGet<AnnualTrendRow[]>(
    `annual_trend.json?_shape=array&variable__exact=temperature_max&month__exact=${month}&day__exact=${day}&_size=50`
  );
  if (!rows.length) return undefined;
  const avg = (f: (r: AnnualTrendRow) => number) => rows.reduce((s, r) => s + (f(r) ?? 0), 0) / rows.length;

  // Average scatter y per year across stations
  const perYear = new Map<number, { sum: number; n: number }>();
  for (const r of rows) {
    for (const pt of JSON.parse(r.scatter_json) as Array<{ x: number; y: number }>) {
      const e = perYear.get(pt.x) ?? { sum: 0, n: 0 };
      e.sum += pt.y; e.n += 1; perYear.set(pt.x, e);
    }
  }
  const scatter = [...perYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([x, e]) => ({ x, y: +(e.sum / e.n).toFixed(2) }));

  const base = rows[0]!;
  return {
    ...base,
    era5_name: ERA5_NATIONAL,
    trend10: +avg(r => r.trend10).toFixed(3),
    p_val: avg(r => r.p_val), tau: +avg(r => r.tau).toFixed(3),
    year_min: Math.min(...rows.map(r => r.year_min)),
    year_max: Math.max(...rows.map(r => r.year_max)),
    n_years: Math.max(...rows.map(r => r.n_years)),
    slope: avg(r => r.slope), intercept: avg(r => r.intercept),
    slope_hi: avg(r => r.slope_hi), intercept_hi: avg(r => r.intercept_hi),
    slope_lo: avg(r => r.slope_lo), intercept_lo: avg(r => r.intercept_lo),
    scatter_json: JSON.stringify(scatter),
  };
}

export async function fetchAnnualTrend(month: number, day: number, loc?: string | null): Promise<AnnualTrend> {
  const era5Name = loc ?? "Ljubljana";
  const r = era5Name === ERA5_NATIONAL
    ? await fetchNationalAnnualTrendRow(month, day)
    : (await dsGet<AnnualTrendRow[]>(
        `annual_trend.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&variable__exact=temperature_mean&month__exact=${month}&day__exact=${day}&_size=1`
      ))[0];
  if (!r) throw new Error("No annual trend row");
  return {
    dayLabel: r.day_label, monthNum: r.month, dayNum: r.day,
    yearMin: r.year_min, yearMax: r.year_max,
    trend10: r.trend10, pVal: r.p_val, tau: r.tau, nYears: r.n_years,
    scatter: JSON.parse(r.scatter_json) as Array<{ x: number; y: number }>,
    // Reconstruct the straight hist/proj lines + CI bands from the stored line
    // parameters (slope/intercept per central + CI bounds). Two endpoints each,
    // since the lines are straight — visually identical to the old point arrays.
    histLine: {
      x:     [r.year_min, r.year_max],
      y:     [r.slope    * r.year_min + r.intercept,    r.slope    * r.year_max + r.intercept],
      upper: [r.slope_hi * r.year_min + r.intercept_hi, r.slope_hi * r.year_max + r.intercept_hi],
      lower: [r.slope_lo * r.year_min + r.intercept_lo, r.slope_lo * r.year_max + r.intercept_lo],
    },
    projLine: {
      x:     [r.year_max, r.proj_end_year],
      y:     [r.slope    * r.year_max + r.intercept,    r.slope    * r.proj_end_year + r.intercept],
      upper: [r.slope_hi * r.year_max + r.intercept_hi, r.slope_hi * r.proj_end_year + r.intercept_hi],
      lower: [r.slope_lo * r.year_max + r.intercept_lo, r.slope_lo * r.proj_end_year + r.intercept_lo],
    },
  };
}
