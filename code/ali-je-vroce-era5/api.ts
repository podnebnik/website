import type {
  TodayStatus, Last7, AnnualTrendRow, AnnualTrend, SiteMeta,
  SeasonHeatmapRow, RegressionResult, RegressionResponse, DailyWindowRow,
} from "./types.ts";

// podnebnik.org datasette serves each DB at the root (no /datasette prefix),
// e.g. https://stage-data.podnebnik.org/climate-si — override with VITE_DATASETTE_URL for dev.
const DS_BASE = (import.meta.env.VITE_DATASETTE_URL as string | undefined) ?? "https://stage-data.podnebnik.org";
// ERA5 historical + precomputed stats
const DS = `${DS_BASE}/climate-si`;
// ARSO historical data (arso-si.db)
const SA = `${DS_BASE}/arso-si`;
// Vremenar live temps
const VR = `${(import.meta.env.VITE_VREMENAR_URL as string | undefined) ?? "https://podnebnik.vremenar.app"}/staging`;

// Populated during fetchMeta()
let vremenarIdMap: Record<string, number> = {};
// era5_name → {lat, lon}; used for Open-Meteo live temps (the ERA5 live source)
let era5Coords: Record<string, { lat: number; lon: number }> = {};
// All ARSO station IDs — used for national Vremenar average
let arsoStationIds: number[] = [];

export const ARSO_NATIONAL = "arso:national";
// Slovenia average across all ERA5 stations (no precomputed national row exists
// in climate-si, so it is averaged client-side from the per-station data).
export const ERA5_NATIONAL = "era5:national";

export function isArsoLoc(loc: string): boolean {
  return loc.startsWith("arso:");
}

function arsoStationId(loc: string): number {
  return Number(loc.replace("arso:", ""));
}

// ── ARSO local-datasette helper ────────────────────────────────────────────────

async function saGet(table: string, params: string): Promise<any> {
  const resp = await fetch(`${SA}/${table}.json?_shape=array&${params}`);
  if (!resp.ok) throw new Error(`arso-si datasette ${resp.status}: ${table}`);
  return resp.json();
}

// ── National ARSO average — pooled ±7-day window across all stations ──────────

async function computeArsoNationalPercentiles(month: number, day: number): Promise<ComputedPercentiles | null> {
  const allChunks = await Promise.all(arsoStationIds.map(id => fetchArsoAllDaily(id)));
  const flat = allChunks.flat();

  const targetDoy = monthDayToDoy(month, day);
  const inWindow  = flat.filter(r => {
    if (r.temperature_max_2m == null) return false;
    const doy  = monthDayToDoy(r.month, r.day);
    const diff = Math.abs(doy - targetDoy);
    return Math.min(diff, 365 - diff) <= 7;
  });
  if (inWindow.length < 10) return null;

  const sorted = inWindow.map(r => r.temperature_max_2m!).sort((a, b) => a - b);
  const years  = inWindow.map(r => r.year);
  return {
    p05: percentileOf(sorted, 0.05), p10: percentileOf(sorted, 0.10),
    p20: percentileOf(sorted, 0.20), p50: percentileOf(sorted, 0.50),
    p80: percentileOf(sorted, 0.80), p95: percentileOf(sorted, 0.95),
    n_samples: sorted.length,
    year_min:  Math.min(...years),
    year_max:  Math.max(...years),
    sorted,
  };
}


const CAT_COLORS: Record<string, string> = {
  hell:     "#962c1a",
  hot:      "#c25a2c",
  nope:     "#e7d9b8",
  cold:     "#6c8fb6",
  freezing: "#3a5a8a",
};

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


function doyToMonthDay(doy: number): { month: number; day: number } {
  const d = new Date(Date.UTC(2001, 0, 1));
  d.setUTCDate(d.getUTCDate() + doy - 1);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function monthDayToDoy(month: number, day: number): number {
  const DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return DAYS[month - 1] + day;
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

interface ComputedPercentiles {
  p05: number; p10: number; p20: number; p50: number; p80: number; p95: number;
  n_samples: number; year_min: number; year_max: number;
  sorted: number[];
}

// Binary-search rank: fraction of sorted values strictly below `value`
function rankPercentile(sorted: number[], value: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}

async function computeArsoPercentiles(
  stationId: number, month: number, day: number,
): Promise<ComputedPercentiles | null> {
  const rows      = await fetchArsoAllDaily(stationId);
  const targetDoy = monthDayToDoy(month, day);

  const inWindow = rows.filter(r => {
    if (r.temperature_max_2m == null) return false;
    const doy  = monthDayToDoy(r.month, r.day);
    const diff = Math.abs(doy - targetDoy);
    return Math.min(diff, 365 - diff) <= 7;
  });
  if (inWindow.length < 10) return null;

  const sorted  = inWindow.map(r => r.temperature_max_2m!).sort((a, b) => a - b);
  const years   = inWindow.map(r => r.year);
  return {
    p05:       percentileOf(sorted, 0.05),
    p10:       percentileOf(sorted, 0.10),
    p20:       percentileOf(sorted, 0.20),
    p50:       percentileOf(sorted, 0.50),
    p80:       percentileOf(sorted, 0.80),
    p95:       percentileOf(sorted, 0.95),
    n_samples: sorted.length,
    year_min:  Math.min(...years),
    year_max:  Math.max(...years),
    sorted,
  };
}

function categorizeArso(temp: number, p: ComputedPercentiles): { category_key: string; percentile: number; color: string } {
  const category_key =
    temp >= p.p95 ? "hell"     :
    temp >= p.p80 ? "hot"      :
    temp >= p.p20 ? "nope"     :
    temp >= p.p05 ? "cold"     : "freezing";
  return { category_key, percentile: rankPercentile(p.sorted, temp), color: CAT_COLORS[category_key] };
}

async function fetchEra5WindowRow(era5Name: string, month: number, day: number): Promise<DailyWindowRow | null> {
  const rows = await dsGet<DailyWindowRow[]>(
    `daily_window.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&month__exact=${month}&day__exact=${day}`
  );
  return rows[0] ?? null;
}

// Slovenia national ±window climatology = mean of the 18 stations' daily_window
// rows for this month/day. Distribution is synthesised from the averaged
// p5/p50/p95 (same approach as the ARSO national curve).
async function fetchEra5NationalWindowRow(month: number, day: number): Promise<DailyWindowRow | null> {
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


async function vremenarTemp(stationId: number): Promise<number | null> {
  try {
    const resp = await fetch(`${VR}/stations/details/METEO-${stationId}?country=si`);
    if (!resp.ok) return null;
    const data = await resp.json() as { statistics?: { temperature_max_24h?: number } };
    return data?.statistics?.temperature_max_24h ?? null;
  } catch {
    return null;
  }
}

// ── Open-Meteo live (the ONLY correct live source for ERA5) ──────────────────
// ERA5-Land reanalysis lags ~5-10 days; the datasette stays authoritative for
// any date it has, and Open-Meteo fills only the recent gap (today/last days).
const OM = "https://api.open-meteo.com/v1/forecast";

async function openMeteoMax(lat: number, lon: number, date: string): Promise<number | null> {
  try {
    const resp = await fetch(`${OM}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max&timezone=UTC&start_date=${date}&end_date=${date}`);
    if (!resp.ok) return null;
    const d = await resp.json() as { daily?: { temperature_2m_max?: (number | null)[] } };
    return d?.daily?.temperature_2m_max?.[0] ?? null;
  } catch {
    return null;
  }
}

// National live = mean of the daily max across all ERA5 stations, in one call
// (Open-Meteo accepts comma-separated coordinate lists → array of results).
async function openMeteoNationalMax(date: string): Promise<number | null> {
  const coords = Object.values(era5Coords);
  if (coords.length === 0) return null;
  try {
    const lats = coords.map(c => c.lat).join(",");
    const lons = coords.map(c => c.lon).join(",");
    const resp = await fetch(`${OM}?latitude=${lats}&longitude=${lons}&daily=temperature_2m_max&timezone=UTC&start_date=${date}&end_date=${date}`);
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
  // ARSO measurements live in a separate database and a separate page, so they
  // are intentionally NOT fetched here.
  const era5Stations = await dsGet<Array<{
    era5_name: string; name: string; lat: number; lon: number;
    elevation: number; station_id: number | null;
  }>>("stations.json?_shape=array&_col=era5_name&_col=name&_col=lat&_col=lon&_col=elevation&_col=station_id&_size=30");

  // Build Vremenar live-data map from ERA5 stations
  vremenarIdMap = Object.fromEntries(
    era5Stations
      .filter(s => s.station_id != null)
      .map(s => [s.era5_name, s.station_id as number])
  );

  // Coordinates for Open-Meteo live temps (the ERA5 live source)
  era5Coords = Object.fromEntries(
    era5Stations.map(s => [s.era5_name, { lat: s.lat, lon: s.lon }])
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
    features: {
      regression_chart:      true,
      trend_calendar:        true,
      station_map:           true,
      hero_cards:            false,
      spei_heatmap:          false,
      drought_trend_chart:   false,
      tropical_days_chart:   false,
      tropical_nights_chart: false,
      sea_level_section:     false,
    },
    map:      { center_lat: 46.1, center_lon: 14.8, zoom: 7 },
    branding: { site_title: "Podnebnik · Ali je vroče?", domain: "podnebnik.kesma.wtf" },
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

  if (era5Name === ARSO_NATIONAL) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday  = date === todayStr;

    let todayTempPromise: Promise<number | null>;
    if (isToday) {
      // Average live Vremenar temps across all ARSO stations
      todayTempPromise = Promise.all(arsoStationIds.map(id => vremenarTemp(id))).then(temps => {
        const valid = temps.filter((t): t is number => t !== null);
        return valid.length > 0 ? valid.reduce((a, b) => a + b) / valid.length : null;
      });
    } else {
      // Historical national average — fetch all stations for this date, average client-side
      todayTempPromise = (saGet(
        "daily",
        `date__exact=${date}&_col=temperature_max_2m&_size=20`
      ) as Promise<Array<{ temperature_max_2m: number | null }>>).then(rows => {
        const valid = rows.filter(r => r.temperature_max_2m != null).map(r => r.temperature_max_2m!);
        return valid.length > 0 ? valid.reduce((a, b) => a + b) / valid.length : null;
      });
    }

    const [todayTemp, percs] = await Promise.all([
      todayTempPromise,
      computeArsoNationalPercentiles(month, day),
    ]);
    if (todayTemp == null || !percs) return { available: false };
    const cat = categorizeArso(todayTemp, percs);
    return {
      available: true, date,
      today_temp: parseFloat(todayTemp.toFixed(1)), is_preliminary: false,
      percentile: cat.percentile, category_key: cat.category_key, color: cat.color,
      n_samples: percs.n_samples, year_min: percs.year_min, year_max: percs.year_max,
      distribution: syntheticDistribution(percs.p05, percs.p50, percs.p95),
      cutoffs: { p5: percs.p05, p10: percs.p10, p20: percs.p20, p50: percs.p50, p80: percs.p80, p95: percs.p95 },
      day_label: dayLabel(month, day), month_num: month, day_num: day,
      rank_info: null, loc: ARSO_NATIONAL,
    };
  }

  if (isArsoLoc(era5Name)) {
    const stationId = arsoStationId(era5Name);
    const todayStr  = new Date().toISOString().slice(0, 10);
    const isToday   = date === todayStr;
    const year      = Number(date.slice(0, 4));

    // For today: Vremenar live max_24h. For past dates: look up from cached historical data.
    const tempPromise: Promise<number | null> = isToday
      ? vremenarTemp(stationId)
      : fetchArsoAllDaily(stationId).then(rows => {
          const row = rows.find(r => r.year === year && r.month === month && r.day === day);
          return row?.temperature_max_2m ?? null;
        });

    const [todayTemp, percs] = await Promise.all([
      tempPromise,
      computeArsoPercentiles(stationId, month, day),
    ]);
    if (todayTemp == null || !percs) return { available: false };
    const cat = categorizeArso(todayTemp, percs);
    return {
      available: true, date,
      today_temp: todayTemp, is_preliminary: false,
      percentile: cat.percentile, category_key: cat.category_key, color: cat.color,
      n_samples: percs.n_samples, year_min: percs.year_min, year_max: percs.year_max,
      distribution: syntheticDistribution(percs.p05, percs.p50, percs.p95),
      cutoffs: { p5: percs.p05, p10: percs.p10, p20: percs.p20, p50: percs.p50, p80: percs.p80, p95: percs.p95 },
      day_label: dayLabel(month, day), month_num: month, day_num: day,
      rank_info: null, loc: era5Name,
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
    // Beyond the reanalysis lag → live Open-Meteo forecast (preliminary)
    const coord = era5Coords[era5Name];
    if (coord) todayTemp = await openMeteoMax(coord.lat, coord.lon, date);
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

  if (era5Name === ARSO_NATIONAL) {
    // Use station 0 to get the 7 most recent dates, then average all stations per date
    const refId = arsoStationIds[0];
    if (!refId) return { available: false, days: [] };
    const rawDates = await saGet(
      "daily",
      `station_id__exact=${refId}&date__lte=${date}&_sort_desc=date&_size=7&_col=date&_col=month&_col=day`
    ) as Array<{ date: string; month: number; day: number }>;
    // Only include dates that are actually within the last 7 calendar days of `date`
    const selectedMs = new Date(date).getTime();
    const dateDates = rawDates.filter(d =>
      selectedMs - new Date(d.date).getTime() <= 7 * 86_400_000
    );
    if (!dateDates.length) return { available: false, days: [] };

    const dayResults = await Promise.all(
      dateDates.map(async ({ date: dateStr, month, day }) => {
        const [allTemps, percs] = await Promise.all([
          saGet("daily", `date__exact=${dateStr}&_col=temperature_max_2m&_size=20`) as Promise<Array<{ temperature_max_2m: number | null }>>,
          computeArsoNationalPercentiles(month, day),
        ]);
        const valid = allTemps.filter(r => r.temperature_max_2m != null).map(r => r.temperature_max_2m!);
        const avg = valid.length > 0 ? valid.reduce((a, b) => a + b) / valid.length : null;
        if (avg == null || !percs) return null;
        const cat = categorizeArso(avg, percs);
        return { date: dateStr, day_label: dayLabel(month, day), today_temp: parseFloat(avg.toFixed(1)), percentile: cat.percentile, category_key: cat.category_key, color: cat.color };
      })
    );
    const days = dayResults.filter(Boolean) as Last7["days"];
    return { available: days.length > 0, days };
  }

  if (isArsoLoc(era5Name)) {
    const stationId = arsoStationId(era5Name);
    const rows = await saGet(
      "daily",
      `station_id__exact=${stationId}&date__lte=${date}&_sort_desc=date&_size=7&_col=date&_col=temperature_max_2m&_col=month&_col=day`
    ) as Array<{ date: string; temperature_max_2m: number; month: number; day: number }>;

    const selectedMs2 = new Date(date).getTime();
    const recentRows = rows.filter(r =>
      selectedMs2 - new Date(r.date).getTime() <= 7 * 86_400_000
    );
    if (!Array.isArray(recentRows) || !recentRows.length) return { available: false, days: [] };

    const dayResults = await Promise.all(
      recentRows.map(async r => {
        const percs = await computeArsoPercentiles(stationId, r.month, r.day);
        if (!percs || r.temperature_max_2m == null) return null;
        const cat = categorizeArso(r.temperature_max_2m, percs);
        return { date: r.date, day_label: dayLabel(r.month, r.day), today_temp: r.temperature_max_2m, percentile: cat.percentile, category_key: cat.category_key, color: cat.color };
      })
    );
    const days = dayResults.filter(Boolean) as Last7["days"];
    return { available: days.length > 0, days };
  }

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

  if (loc === ARSO_NATIONAL) {
    const percs = await computeArsoNationalPercentiles(month, day);
    if (!percs) return [];
    return [{
      station: ARSO_NATIONAL, month, day,
      p5: percs.p05, p10: percs.p10, p20: percs.p20, p50: percs.p50, p80: percs.p80, p95: percs.p95,
      n_samples: percs.n_samples, year_min: percs.year_min, year_max: percs.year_max,
      distribution_json: "[]",
    }];
  }

  if (isArsoLoc(loc)) {
    const stationId = arsoStationId(loc);
    const percs = await computeArsoPercentiles(stationId, month, day);
    if (!percs) return [];
    return [{
      station: loc, month, day,
      p5: percs.p05, p10: percs.p10, p20: percs.p20, p50: percs.p50, p80: percs.p80, p95: percs.p95,
      n_samples: percs.n_samples, year_min: percs.year_min, year_max: percs.year_max,
      distribution_json: "[]",
    }];
  }

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
  if (isArsoLoc(era5Name)) return [];
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
  const era5Locs  = p.locs.filter(l => !isArsoLoc(l));
  const arsoLocs  = p.locs.filter(isArsoLoc);

  const [era5Results, arsoResults] = await Promise.all([
    Promise.all(era5Locs.map(loc => buildRegressionResult(loc, p.var, month, day))),
    Promise.all(arsoLocs.map(loc => _buildArsoRegressionResult(loc, p.var, p.doy, p.window))),
  ]);

  return {
    results:    [...era5Results, ...arsoResults].filter(Boolean) as RegressionResult[],
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

// ── fetchArsoTrend ─────────────────────────────────────────────────────────────

export interface ArsoTrend {
  dayLabel:  string;
  yearMin:   number;
  yearMax:   number;
  nYears:    number;
  scatter:   Array<{ x: number; y: number }>;
  trendLine: Array<[number, number]>;
  trend10:   number;
}

// ── Cached full station daily data ────────────────────────────────────────────
// Avoids re-fetching when multiple charts need the same station's data.

interface DailyRow {
  year: number; month: number; day: number;
  temperature_max_2m: number | null;
  temperature_min_2m: number | null;
}

const arsoAllDailyCache = new Map<number, Promise<DailyRow[]>>();

async function fetchArsoAllDaily(stationId: number): Promise<DailyRow[]> {
  if (arsoAllDailyCache.has(stationId)) return arsoAllDailyCache.get(stationId)!;
  const promise = (async () => {
    const chunks = await Promise.all([1,2,3,4,5,6,7,8,9,10,11,12].map(m =>
      saGet(
        "daily",
        `station_id__exact=${stationId}&month__exact=${m}` +
        `&_col=year&_col=month&_col=day&_col=temperature_max_2m&_col=temperature_min_2m&_sort=year&_size=5000`
      ) as Promise<DailyRow[]>
    ));
    return chunks.flat();
  })();
  arsoAllDailyCache.set(stationId, promise);
  return promise;
}

// ── Theil-Sen + Mann-Kendall engine (client-side) ─────────────────────────────

function _median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function _mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function _arsoVarValue(row: DailyRow, variable: string): number | null {
  if (variable === "temperature_max") return row.temperature_max_2m;
  if (variable === "temperature_min") return row.temperature_min_2m;
  if (variable === "temperature_mean") {
    const mx = row.temperature_max_2m, mn = row.temperature_min_2m;
    return mx != null && mn != null ? (mx + mn) / 2 : null;
  }
  return null;
}

interface TheilSenResult {
  slope:     number;
  intercept: number;
  pValue:    number;
  // CI bounds for the fitted line at each x in xArr
  ciLine: (xArr: number[]) => { y: number[]; upper: number[]; lower: number[] };
}

function _theilSen(xs: number[], ys: number[]): TheilSenResult | null {
  const n = xs.length;
  if (n < 5) return null;

  // All pairwise slopes
  const slopes: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = xs[j]! - xs[i]!;
      if (dx !== 0) slopes.push((ys[j]! - ys[i]!) / dx);
    }
  }
  slopes.sort((a, b) => a - b);
  const b = _median(slopes);
  const a = _median(ys) - b * _median(xs);

  // Mann-Kendall S statistic
  let S = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = ys[j]! - ys[i]!;
      if (d > 0) S++; else if (d < 0) S--;
    }
  }
  const varS  = n * (n - 1) * (2 * n + 5) / 18;
  const Z     = S === 0 ? 0 : (S - Math.sign(S)) / Math.sqrt(varS);
  const pValue = 2 * _normalCDF(-Math.abs(Z));

  // Residual-based CI on the fitted line (OLS variance — approximate but visual)
  const xMean   = _mean(xs);
  const sigma2  = ys.reduce((s, yi, i) => s + (yi - (a + b * xs[i]!)) ** 2, 0) / Math.max(n - 2, 1);
  const Sxx     = xs.reduce((s, xi) => s + (xi - xMean) ** 2, 0);

  function ciLine(xArr: number[]) {
    const y     = xArr.map(x => a + b * x);
    const upper = xArr.map((x, i) => y[i]! + 1.96 * Math.sqrt(sigma2 * (1 / n + (x - xMean) ** 2 / Sxx)));
    const lower = xArr.map((x, i) => y[i]! - 1.96 * Math.sqrt(sigma2 * (1 / n + (x - xMean) ** 2 / Sxx)));
    return { y, upper, lower };
  }

  return { slope: b, intercept: a, pValue, ciLine };
}

// ── ARSO scatter / regression result ─────────────────────────────────────────

async function _buildArsoRegressionResult(
  loc:      string,
  variable: string,
  doy:      number,
  window_:  number,
): Promise<RegressionResult | null> {
  const id   = arsoStationId(loc);
  const rows = await fetchArsoAllDaily(id);

  const inWindow = rows.filter(r => {
    const d    = monthDayToDoy(r.month, r.day);
    const diff = Math.abs(d - doy);
    return Math.min(diff, 365 - diff) <= window_;
  });

  const byYear = new Map<number, number[]>();
  for (const r of inWindow) {
    const v = _arsoVarValue(r, variable);
    if (v == null) continue;
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year)!.push(v);
  }

  const yearVals = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, vals]) => ({ year, val: _mean(vals) }));

  if (yearVals.length < 10) return null;

  const xs = yearVals.map(yv => yv.year);
  const ys = yearVals.map(yv => yv.val);
  const ts = _theilSen(xs, ys);
  if (!ts) return null;

  const xLine = xs; // one point per observed year
  const { y: yLine, upper, lower } = ts.ciLine(xLine);

  const baseYears = yearVals.filter(yv => yv.year >= 1961 && yv.year <= 1990);
  const baseline  = baseYears.length > 5 ? _mean(baseYears.map(yv => yv.val)) : _mean(ys);
  const trend10   = ts.slope * 10;

  return {
    loc,
    year_min: xs[0]!,
    year_max: xs[xs.length - 1]!,
    scatter: yearVals.map(yv => {
      const anomaly = yv.val - baseline;
      return { x: yv.year, y: yv.val, anomaly, color: anomaly >= 0 ? "#c25a2c" : "#3a5a8a" };
    }),
    line: { x: xLine, y: yLine, upper, lower },
    baseline,
    stats: {
      method:     "Theil-Sen + MK",
      trend10,
      metric:     trend10,
      metric_lbl: "trend / 10y",
      p_val:      ts.pValue,
      direction:  trend10 >= 0 ? "up" : "down",
      chg_str:    `${trend10 >= 0 ? "+" : ""}${trend10.toFixed(2)} °C/10y`,
      fit_desc:   ts.pValue < 0.001 ? "p < 0.001" : `p = ${ts.pValue.toFixed(3)}`,
      sig_label:  ts.pValue < 0.05  ? "p < 0.05"  : `p = ${ts.pValue.toFixed(3)}`,
      n_years:    yearVals.length,
      ar1:        null,
    },
  };
}

// ── ARSO year-round calendar trend ───────────────────────────────────────────

async function _buildArsoCalendar(
  loc:      string,
  variable: string,
  window_:  number,
): Promise<CalendarData> {
  const id   = arsoStationId(loc);
  const rows = await fetchArsoAllDaily(id);

  // Pre-index all valid values by doy
  const byDoy = new Map<number, Array<{ year: number; val: number }>>();
  for (const r of rows) {
    const v = _arsoVarValue(r, variable);
    if (v == null) continue;
    const doy = monthDayToDoy(r.month, r.day);
    if (!byDoy.has(doy)) byDoy.set(doy, []);
    byDoy.get(doy)!.push({ year: r.year, val: v });
  }

  const calRows: CalendarRow[] = [];

  for (let doy = 1; doy <= 365; doy++) {
    const yearMap = new Map<number, number[]>();
    for (let delta = -window_; delta <= window_; delta++) {
      let d = doy + delta;
      if (d < 1) d += 365;
      if (d > 365) d -= 365;
      for (const pt of byDoy.get(d) ?? []) {
        if (!yearMap.has(pt.year)) yearMap.set(pt.year, []);
        yearMap.get(pt.year)!.push(pt.val);
      }
    }

    const yearVals = [...yearMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, vals]) => ({ year, val: _mean(vals) }));

    if (yearVals.length < 10) continue;

    const xs = yearVals.map(yv => yv.year);
    const ys = yearVals.map(yv => yv.val);
    const ts = _theilSen(xs, ys);
    if (!ts) continue;

    const { month, day } = doyToMonthDay(doy);
    calRows.push({ month, day, trend10: ts.slope * 10, p_val: ts.pValue });
  }

  return { loc, var: variable, unit: "°C", method_label: "Theil-Sen + MK", rows: calRows };
}

// ── Season heatmap for ARSO ───────────────────────────────────────────────────

function arsoSeason(month: number): "Winter" | "Spring" | "Summer" | "Autumn" {
  if (month >= 3 && month <= 5) return "Spring";
  if (month >= 6 && month <= 8) return "Summer";
  if (month >= 9 && month <= 11) return "Autumn";
  return "Winter";
}

function percentileOf(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx]!;
}

export async function fetchArsoSeasonHeatmap(stationId: number): Promise<SeasonHeatmapRow[]> {
  const rows = await fetchArsoAllDaily(stationId);
  const valid = rows.filter(r => r.temperature_max_2m != null);
  if (!valid.length) return [];

  // Accumulate (year, season) → temps.  December → next year's winter.
  const bySY = new Map<string, { year: number; season: string; temps: number[] }>();
  for (const r of valid) {
    const season = arsoSeason(r.month);
    const year   = season === "Winter" && r.month === 12 ? r.year + 1 : r.year;
    const key    = `${year}|${season}`;
    if (!bySY.has(key)) bySY.set(key, { year, season, temps: [] });
    bySY.get(key)!.temps.push(r.temperature_max_2m!);
  }

  const entries = [...bySY.values()]
    .filter(e => e.temps.length >= 30)
    .map(e => ({ ...e, avg: e.temps.reduce((a, t) => a + t, 0) / e.temps.length }));

  // Baseline: use 1961-1990 if data starts ≤ 1965, otherwise 1980-2010
  const yearMin = Math.min(...entries.map(e => e.year));
  const [blStart, blEnd] = yearMin <= 1965 ? [1961, 1990] : [1980, 2010];

  // Compute per-season baseline percentile thresholds
  const SEASONS = ["Winter", "Spring", "Summer", "Autumn"] as const;
  const thresholds = new Map<string, { p10: number; p20: number; p80: number; p95: number }>();
  for (const s of SEASONS) {
    const bl = entries.filter(e => e.season === s && e.year >= blStart && e.year <= blEnd)
                      .map(e => e.avg).sort((a, b) => a - b);
    if (bl.length < 5) continue;
    thresholds.set(s, {
      p10: percentileOf(bl, 0.10),
      p20: percentileOf(bl, 0.20),
      p80: percentileOf(bl, 0.80),
      p95: percentileOf(bl, 0.95),
    });
  }

  const CAT_COLORS: Record<string, string> = {
    cold: "#3a5a8a", cool: "#6c8fb6", normal: "#e7d9b8", hot: "#c25a2c", extreme: "#962c1a",
  };

  const result: SeasonHeatmapRow[] = [];
  for (const e of entries) {
    const th = thresholds.get(e.season);
    if (!th) continue;
    const cat =
      e.avg >= th.p95 ? "extreme" :
      e.avg >= th.p80 ? "hot" :
      e.avg >= th.p20 ? "normal" :
      e.avg >= th.p10 ? "cool" : "cold";

    const seasonEntries = entries.filter(x => x.season === e.season).sort((a, b) => b.avg - a.avg);
    const rank  = seasonEntries.findIndex(x => x.year === e.year) + 1;
    const total = seasonEntries.length;

    result.push({
      x:          SEASONS.indexOf(e.season as any),
      y:          e.year,
      season:     e.season as any,
      avg:        parseFloat(e.avg.toFixed(2)),
      percentile: ((total - rank) / total) * 100,
      cat,
      rank,
      total,
      color:      CAT_COLORS[cat]!,
      n_days:     e.temps.length,
    });
  }
  return result;
}

// ── Tropical days / nights for ARSO ──────────────────────────────────────────

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

const arsoAllDailyMinCache = new Map<number, Promise<Array<{ year: number; temperature_min_2m: number | null }>>>();

async function fetchArsoAllDailyMin(stationId: number) {
  if (arsoAllDailyMinCache.has(stationId)) return arsoAllDailyMinCache.get(stationId)!;
  const promise = (async () => {
    const chunks = await Promise.all([1,2,3,4,5,6,7,8,9,10,11,12].map(m =>
      saGet(
        "daily",
        `station_id__exact=${stationId}&month__exact=${m}` +
        `&_col=year&_col=temperature_min_2m&_sort=year&_size=5000`
      ) as Promise<Array<{ year: number; temperature_min_2m: number | null }>>
    ));
    return chunks.flat();
  })();
  arsoAllDailyMinCache.set(stationId, promise);
  return promise;
}

// Abramowitz & Stegun normal CDF approximation (error < 7.5e-8)
function _normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

// Lanczos approximation of log-gamma (g=7, accurate to ~15 sig. digits)
function _lgamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - _lgamma(1 - x);
  let xm = x - 1, a = c[0]!;
  const t = xm + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (xm + i);
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}

// Negative Binomial GLM via IRLS (log link). Returns null when too few data points.
function _fitNBGLM(years: number[], counts: number[]) {
  const n = years.length;
  if (n < 10) return null;

  // Initialise with log of clamped mean count
  const yBar0 = Math.max(0.1, counts.reduce((s, c) => s + c, 0) / n);
  let a = Math.log(yBar0), b = 0, alpha = 0.1;

  // Helper: 2×2 weighted least-squares for [1, x] design matrix
  function wls(W: number[], z: number[], x: number[]) {
    let A00 = 0, A01 = 0, A11 = 0, r0 = 0, r1 = 0;
    for (let i = 0; i < n; i++) {
      A00 += W[i]!; A01 += W[i]! * x[i]!; A11 += W[i]! * x[i]! * x[i]!;
      r0  += W[i]! * z[i]!; r1 += W[i]! * x[i]! * z[i]!;
    }
    const det = A00 * A11 - A01 * A01;
    if (Math.abs(det) < 1e-12) return null;
    return { a: (A11 * r0 - A01 * r1) / det, b: (A00 * r1 - A01 * r0) / det, A00, A01, A11, det };
  }

  // Outer loop: alternate IRLS and alpha moment update
  for (let outer = 0; outer < 8; outer++) {
    // Inner IRLS
    for (let inner = 0; inner < 12; inner++) {
      const mu = years.map(x => Math.max(1e-9, Math.exp(a + b * x)));
      const W  = mu.map(m => m / (1 + alpha * m));                          // NB working weight
      const z  = years.map((x, i) => Math.log(mu[i]!) + (counts[i]! - mu[i]!) / mu[i]!);
      const fit = wls(W, z, years);
      if (!fit) break;
      const da = Math.abs(fit.a - a), db = Math.abs(fit.b - b);
      a = fit.a; b = fit.b;
      if (da < 1e-8 && db < 1e-10) break;
    }
    // Moment update for alpha using Poisson Pearson chi-squared
    const mu = years.map(x => Math.max(1e-9, Math.exp(a + b * x)));
    const meanMu = mu.reduce((s, m) => s + m, 0) / n;
    const chi2 = counts.reduce((s, y, i) => s + Math.pow(y - mu[i]!, 2) / mu[i]!, 0);
    const newAlpha = Math.max(0, (chi2 / (n - 2) - 1) / meanMu);
    if (Math.abs(newAlpha - alpha) < 1e-4) { alpha = newAlpha; break; }
    alpha = newAlpha;
  }

  const mu = years.map(x => Math.max(1e-9, Math.exp(a + b * x)));
  const W  = mu.map(m => m / (1 + alpha * m));

  // Fisher information for SE(b)
  let A00 = 0, A01 = 0, A11 = 0;
  for (let i = 0; i < n; i++) {
    A00 += W[i]!; A01 += W[i]! * years[i]!; A11 += W[i]! * years[i]! * years[i]!;
  }
  const det  = A00 * A11 - A01 * A01;
  const seB  = Math.sqrt(Math.abs(A00 / det));
  const pVal = 2 * _normalCDF(-Math.abs(b / seB));

  // CI band on the log scale, then exponentiated (delta method)
  const x_line = Array.from({ length: 80 }, (_, i) =>
    years[0]! + (i / 79) * (years[n - 1]! - years[0]!));
  const y_line  = x_line.map(x => Math.exp(a + b * x));
  const ci_low  = x_line.map((x, i) => {
    const varEta = (A11 - 2 * A01 * x + A00 * x * x) / det;
    return Math.max(0, Math.exp(Math.log(y_line[i]!) - 1.96 * Math.sqrt(Math.abs(varEta))));
  });
  const ci_high = x_line.map((x, i) => {
    const varEta = (A11 - 2 * A01 * x + A00 * x * x) / det;
    return Math.exp(Math.log(y_line[i]!) + 1.96 * Math.sqrt(Math.abs(varEta)));
  });

  const fitYearMax = years[n - 1]!;
  const days_per_decade = Math.exp(a + b * fitYearMax) - Math.exp(a + b * (fitYearMax - 10));
  const rate_per_year   = (Math.exp(b) - 1) * 100;

  // NB log-likelihood for AIC (size r = 1/alpha; fall back to Poisson if alpha ≈ 0)
  let LL = 0;
  const r = alpha > 1e-6 ? 1 / alpha : null;
  for (let i = 0; i < n; i++) {
    const y = counts[i]!, m = mu[i]!;
    if (r !== null) {
      LL += _lgamma(y + r) - _lgamma(r) - _lgamma(y + 1)
          + r * Math.log(r / (r + m)) + y * Math.log(m / (r + m));
    } else {
      LL += y * Math.log(m) - m - _lgamma(y + 1);  // Poisson
    }
  }
  const aic = -2 * LL + 2 * (r !== null ? 3 : 2);

  return {
    model_used:      "nb" as const,
    rate_per_year:   parseFloat(rate_per_year.toFixed(2)),
    days_per_decade: parseFloat(days_per_decade.toFixed(1)),
    p_value:         parseFloat(pVal.toFixed(4)),
    x_line, y_line, ci_low, ci_high,
    fit_year_max: fitYearMax,
    aic:          parseFloat(aic.toFixed(0)),
    alpha:        parseFloat(alpha.toFixed(3)),
  };
}

export async function fetchArsoTropical(
  stationId: number,
  kind:      "days" | "nights",
  threshold: number,
): Promise<ArsoTropicalData | null> {
  const rows = kind === "days"
    ? await fetchArsoAllDaily(stationId)
    : await fetchArsoAllDailyMin(stationId);
  const field = kind === "days" ? "temperature_max_2m" : "temperature_min_2m";

  const byYear = new Map<number, number>();
  for (const r of rows) {
    const val = (r as any)[field] as number | null;
    if (val == null) continue;
    if (!byYear.has(r.year)) byYear.set(r.year, 0);
    if (val > threshold) byYear.set(r.year, byYear.get(r.year)! + 1);
  }
  if (!byYear.size) return null;

  const years  = [...byYear.keys()].sort((a, b) => a - b);
  const counts = years.map(y => byYear.get(y)!);

  const trend = _fitNBGLM(years, counts) ?? { model_used: false as const,
    rate_per_year: 0, days_per_decade: 0, p_value: 1,
    x_line: [], y_line: [], ci_low: [], ci_high: [],
    fit_year_max: years[years.length - 1]!, aic: 0, alpha: 0 };

  return {
    years, counts,
    nonzero_count: counts.filter(c => c > 0).length,
    trend,
  };
}

export async function fetchArsoTrend(stationId: number, month: number, day: number): Promise<ArsoTrend | null> {
  // Fetch adjacent months to cover the ±7-day window near month boundaries
  const months = [...new Set([Math.max(1, month - 1), month, Math.min(12, month + 1)])];
  const rows   = await fetchArsoAllDaily(stationId);
  const allRows = rows.filter(r => months.includes(r.month) && r.temperature_max_2m != null) as
    Array<{ year: number; month: number; day: number; temperature_max_2m: number }>;
  if (!allRows.length) return null;

  const targetDoy = monthDayToDoy(month, day);
  const inWindow = allRows.filter(r => {
    const doy  = monthDayToDoy(r.month, r.day);
    const diff = Math.abs(doy - targetDoy);
    return Math.min(diff, 365 - diff) <= 7;
  });
  if (!inWindow.length) return null;

  // Group by year, take mean of daily max temperatures in the window
  const byYear = new Map<number, number[]>();
  for (const r of inWindow) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year)!.push(r.temperature_max_2m);
  }
  const scatter = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, temps]) => ({
      x: year,
      y: parseFloat((temps.reduce((s, t) => s + t, 0) / temps.length).toFixed(2)),
    }));

  if (scatter.length < 3) return null;

  // OLS linear regression
  const n     = scatter.length;
  const sumX  = scatter.reduce((s, p) => s + p.x, 0);
  const sumY  = scatter.reduce((s, p) => s + p.y, 0);
  const sumXY = scatter.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = scatter.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const yearMin = scatter[0].x;
  const yearMax = scatter[scatter.length - 1].x;
  return {
    dayLabel:  dayLabel(month, day),
    yearMin, yearMax,
    nYears:    scatter.length,
    scatter,
    trendLine: [
      [yearMin, parseFloat((slope * yearMin + intercept).toFixed(2))],
      [yearMax, parseFloat((slope * yearMax + intercept).toFixed(2))],
    ],
    trend10: parseFloat((slope * 10).toFixed(3)),
  };
}

// ── SPEI stubs (no precipitation data) ────────────────────────────────────────

export function fetchSpeiHeatmap(): Promise<{ available: boolean }> {
  return Promise.resolve({ available: false });
}

export function fetchSpeiStationSeasonal(): Promise<null> {
  return Promise.resolve(null);
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
  loc: string, variable: string, window_: number,
  _corr: "raw" | "corr", _method: "theilsen" | "ols"
): Promise<CalendarData> {
  if (isArsoLoc(loc)) return _buildArsoCalendar(loc, variable, window_);
  const rows = await dsGet<CalendarRow[]>(
    `annual_trend.json?_shape=array&era5_name__exact=${encodeURIComponent(loc)}&variable__exact=${encodeURIComponent(variable)}&_col=month&_col=day&_col=trend10&_col=p_val&_size=400`
  );
  return { loc, var: variable, unit: "°C", method_label: "Theil-Sen + TFPW MK", rows };
}

// ── fetchAnnualTrend ───────────────────────────────────────────────────────────

export async function fetchAnnualTrend(month: number, day: number, loc?: string | null): Promise<AnnualTrend> {
  const era5Name = loc ?? "Ljubljana";
  if (isArsoLoc(era5Name)) throw new Error("Annual trend not available for ARSO stations");
  const rows = await dsGet<AnnualTrendRow[]>(
    `annual_trend.json?_shape=array&era5_name__exact=${encodeURIComponent(era5Name)}&variable__exact=temperature_mean&month__exact=${month}&day__exact=${day}&_size=1`
  );
  if (!rows.length) throw new Error("No annual trend row");
  const r = rows[0]!;
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
