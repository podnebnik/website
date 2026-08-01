import type {
  TodayStatus, Last7, AnnualTrendRow, AnnualTrend, SiteMeta,
  SeasonHeatmapRow, RegressionResult, RegressionResponse, DailyWindowRow,
} from "./types.ts";
import type { SpeiData } from "./charts/SpeiHeatmap.tsx";
import type { SpeiStationData } from "./charts/SpeiTrendChart.tsx";
// T-5.3b (D-18 Half 2): the datasette column contract, codegen'd from
// data/climate-si/datapackage.yaml (code/ali-je-vroce-era5/generated/datasette-schema.ts).
// The `*Col` unions type-check the `_col=` projections below; `DsTropical` types the
// tropical read. A column renamed in datapackage regenerates that file and turns any
// stale name here into a compile error rather than a silent live-page break.
// T-5.13 extends the same unions to the URL FILTER column names (see the `*Col` filter
// helpers below): a filter-only column (e.g. annual_trend `variable`) would otherwise rename
// silently, because an unknown datasette filter column does NOT 400 — it becomes an
// always-false SQL comparison and returns an empty result (SQLite's double-quoted
// identifier→string-literal quirk; verified against datasette 0.65.2 / SQLite DQS=3).
import type {
  StationsCol, DailyCol, DailyWindowCol, SeasonHeatmapCol, SpeiCol, SpeiStationCol,
  AnnualTrendCol, DsTropical, TropicalCol, DsDailyWindow,
} from "./generated/datasette-schema.ts";
// The category palette lives with the percentile helpers salvaged from the
// deleted ARSO path (T-2.2 / D-2); see percentile.ts for why they were kept.
// `cdfPercentile` is the T-4.1 / D-6 honest percentile (CDF of the served KDE).
import { CAT_COLORS, cdfPercentile } from "./percentile.ts";
// T-4.5 (D-4): dateToDoy reads the calendar day in Europe/Ljubljana, the same day
// boundary clock.ts uses. This is a PURE date-parts read, not a system-clock read.
import { calendarDateIn, LJUBLJANA_TZ } from "./clock.ts";
// T-5.5 (D-8) — Slovenian catalogue + Slovenian number/date formatting.
import { t, fmtNum, fmtMonthDay } from "./i18n/format.ts";
// T-5.27 — nominative diacritic station display names (no datasette column has them).
import { displayNameFor } from "./i18n/station-names.ts";

// podnebnik.org datasette serves each DB at the root (no /datasette prefix),
// e.g. https://stage-data.podnebnik.org/climate-si — override with VITE_DATASETTE_URL for dev.
export const DS_BASE = (import.meta.env.VITE_DATASETTE_URL as string | undefined) ?? "https://stage-data.podnebnik.org";
// ERA5 historical + precomputed stats
const DS = `${DS_BASE}/climate-si`;

// Single anomaly reference period (D-3): the 1991-2020 WMO climatological normal,
// matching the Python pipeline's `baseline` key in si.yaml. This is the one source
// for every anomaly and period label on the frontend — no bare year literals. The
// SPEI drought index is a deliberate carve-out and keeps its own 1950-1980 window
// (labelled server-side), so it is not derived from this constant.
export const BASELINE_YEAR_MIN = 1991;
export const BASELINE_YEAR_MAX = 2020;
export const BASELINE_LABEL = `${BASELINE_YEAR_MIN}–${BASELINE_YEAR_MAX}`;

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

// T-5.5 — variable labels moved to the catalogue (reg.var_*); one source shared
// with RegressionPanel's picker. `et0_evapotranspiration` maps to reg.var_et0.
export function varLabel(v: string): string {
  const key = v === "et0_evapotranspiration" ? "reg.var_et0" : `reg.var_${v}`;
  const lbl = t(key);
  return lbl === key ? `${v} (°C)` : lbl;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function dsGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${DS}/${path}`);
  if (!resp.ok) throw new Error(`Datasette ${resp.status}: ${path}`);
  return resp.json() as Promise<T>;
}

// ── `_col=` column projections (T-5.3b / D-18) ──────────────────────────────────
//
// Each datasette query below that uses `_col=` selects a SUBSET of its table's
// columns. The subset and its ORDER are declared here as tuples type-checked against
// the generated column unions (StationsCol, DailyCol, …). A column renamed in
// datapackage.yaml regenerates those unions, and the now-invalid string literal below
// fails `yarn typecheck` — closing the pipeline→frontend seam D-18 opened.
//
// THE ORDER IS THE URL ORDER, NOT datapackage's field order. The 2,040 fixtures are
// keyed on the exact request URL (tests/fixtures/index.json; T-5.2 kept `_size`
// literal for the same reason), so `dsCols` must reproduce the recorded query string
// byte-for-byte. Where a call site's historical column order differs from
// datapackage's declaration order, THIS TUPLE PRESERVES THE URL — reordering to match
// datapackage would miss every fixture for no benefit.
const STATIONS_COLS       = ["era5_name", "name", "lat", "lon", "elevation", "station_id"] as const satisfies readonly StationsCol[];
const DAILY_TODAY_COLS    = ["temperature_max_2m"] as const satisfies readonly DailyCol[];
const DAILY_LAST7_COLS    = ["date", "temperature_max_2m", "month", "day"] as const satisfies readonly DailyCol[];
const SEASON_HEATMAP_COLS = ["x", "y", "season", "avg", "percentile", "cat", "rank", "total", "color", "n_days"] as const satisfies readonly SeasonHeatmapCol[];
const SPEI_COLS           = ["y", "spei", "balance", "cat", "rank", "total", "color", "season", "n_days"] as const satisfies readonly SpeiCol[];
const SPEI_STATION_COLS   = ["era5_name", "series", "years_json", "spei_json", "trend_json"] as const satisfies readonly SpeiStationCol[];
const CALENDAR_COLS       = ["month", "day", "trend10", "p_val"] as const satisfies readonly AnnualTrendCol[];

/** Render an ordered column tuple as a datasette `_col=a&_col=b&…` query fragment. */
function dsCols(cols: readonly string[]): string {
  return cols.map(c => `_col=${c}`).join("&");
}

// ── Filter column names (T-5.13 / D-18) ─────────────────────────────────────────
//
// The `?…&<col>__exact=<value>` filters below name their column as a bare literal.
// Unlike a `_col=` projection, a wrong filter column does NOT fail loudly: datasette
// emits `WHERE "<col>" = :p`, and with an unknown column SQLite (DQS=3, the default —
// confirmed on datasette 0.65.2) reads the double-quoted identifier as a STRING LITERAL,
// making the comparison always-false — so the query returns an EMPTY result (HTTP 200),
// not a 400. A filter-only column (annual_trend `variable`, tropical `kind`/`threshold`/
// `streak`, the era5_name filters read via no row field) could therefore rename silently
// and quietly blank a section. These identity helpers pin each filter column to its
// table's generated `*Col` union: a datapackage rename regenerates the union and turns
// the stale name into a `yarn typecheck` error. They return the name UNCHANGED, so every
// request URL stays byte-identical (the 2,040 fixtures are URL-keyed). No parallel list
// of column names is introduced — the names live only at the call sites, as before.
const dwCol = (c: DailyWindowCol):  DailyWindowCol  => c;
const dCol  = (c: DailyCol):        DailyCol        => c;
const shCol = (c: SeasonHeatmapCol): SeasonHeatmapCol => c;
const atCol = (c: AnnualTrendCol):  AnnualTrendCol  => c;
const trCol = (c: TropicalCol):     TropicalCol     => c;

// T-5.1: guard for the datasette `*_json` columns (distribution_json, scatter_json,
// years_json, counts_json, trend_json, spei_json). An unguarded JSON.parse throws a
// bare SyntaxError ("Unexpected token …") on malformed data that names neither the
// column nor the section. This wraps the parse so the failure is descriptive and,
// crucially, still an error — it propagates to the section's ErrorBoundary (T-5.1
// Part 1) and renders as a visible error state rather than blanking the section.
export function parseJsonColumn<T>(raw: string, column: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`Malformed JSON in datasette column ${column}: ${(err as Error).message}`);
  }
}

// T-5.2 — kill the silent `_size` truncation cliff on the national aggregates.
//
// datasette returns at most `_size` rows and drops the rest WITHOUT any signal —
// the same silent-failure class T-5.1 removed from the fetch/parse paths. The
// three national helpers below (daily_window / daily / annual_trend, each filtered
// to a single month-day or date) pool "one row per ERA5 station" and average them.
// The healthy result is ALL-OR-NOTHING: either the day has no rows at all (Feb 29
// has no pooled climatology row; a date beyond the reanalysis boundary has no
// observation) or exactly one row per station. A count that is neither 0 nor the
// station count is either a partial pool — a national mean silently computed over a
// subset, which D-7's "povprečje 18 postaj" would then mislabel — or a response
// truncated at the `_size` cap. Both are silent failures and must fail loudly; the
// throw reaches each section's ErrorBoundary and renders SectionError instead of a
// wrong number.
//
// The station count comes from `era5Coords`, populated by fetchMeta from
// `stations.json?…&_size=30`. That query is the SAME class of latent cliff and,
// being the SOURCE of this "expected", would truncate first and make every assert
// below validate against a wrong count — so fetchMeta guards it too (asserts it
// did not hit the `_size=30` cap; see the guard beside that query).
//
// The `_size=50` in the three query URLs is deliberately NOT removed: the offline
// fixture layer keys on the EXACT request URL (fixtures/install.ts index.routes),
// so changing it would miss every recorded response and force a network re-record
// for no data benefit. 50 is already a correct bound (> the 18-station count); this
// assert is the loud "you didn't hit the cap" guard layered on top of it.
function assertNationalStationRows(rows: readonly unknown[], table: string): void {
  const expected = Object.keys(era5Coords).length;
  if (expected === 0) {
    throw new Error(
      `[T-5.2] ${table}: station registry not loaded (fetchMeta must run before a ` +
        `national aggregate) — cannot validate the national row count`,
    );
  }
  if (rows.length !== 0 && rows.length !== expected) {
    throw new Error(
      `[T-5.2] ${table}: national aggregate expected 0 or ${expected} station rows, got ` +
        `${rows.length} — a partial pool would silently bias the national mean, and a count at ` +
        `the datasette \`_size\` cap means rows were truncated`,
    );
  }
}


// T-5.28: day counts per month on the FIXED non-leap 2001 calendar the DOY helpers
// walk. February keeps 29 so the leap day is SELECTABLE in the calendar picker —
// monthDayToDoy(2,29) folds it to DOY 59 (28 Feb's slot, D-12). Lives here beside the
// DOY conversions so "the shape of the year" has one home and can be unit-tested
// without mounting the Solid island (tests/unit/doy.test.ts).
export const MONTH_LEN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

// T-5.32: YEAR-AWARE day count for the HERO date picker, which — unlike the yearless
// DOY control — selects a real dated day and must offer 29 February only in leap
// years. `new Date(year, month, 0)` rolls to the last day of `month` (1..12), so its
// `getDate()` is that month's length for THAT year: Feb → 29 in 2024, 28 in 2023.
// Pure arithmetic on explicit arguments, no clock read (see the clock.ts audit note),
// so it is unit-tested without mounting the Solid island (tests/unit/hero-date.test.ts).
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
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
  // D-12: 29 Feb folds into 28 Feb's slot (DOY 59). The year is 365 DOY slots, so
  // Feb 29 has no distinct bin; its observations pool into the Feb 28 window. Without
  // this fold monthDayToDoy(2,29) would collide with 1 March (both 60).
  if (month === 2 && day === 29) return 59;
  return (DAYS[month - 1] ?? 0) + day;
}

// T-4.5: forward calendar-date → day-of-year. Moved here from AliJeVroceERA5.tsx so
// all three DOY conversions live together and cannot drift apart again — they had:
// this used to count real days from 31 Dec, i.e. it was LEAP-AWARE (1 March = doy 61
// in 2024), while monthDayToDoy / doyToMonthDay walk a FIXED non-leap 2001 calendar
// (1 March = 60). The panel fed this leap-aware doy straight into doyToMonthDay's
// non-leap inverse, so 2024-03-01 was analysed as 2 March (T-1.1 witness). Now it
// derives month/day in Europe/Ljubljana (D-4) and folds to the non-leap slot via
// monthDayToDoy, so the round-trip is exact and 29 Feb lands on DOY 59 (D-12).
export function dateToDoy(dateStr: string): number {
  // calendarDateIn returns "YYYY-MM-DD" (fixed offsets, so no split/undefined).
  const local = calendarDateIn(new Date(dateStr + "T12:00:00Z"), LJUBLJANA_TZ);
  return monthDayToDoy(Number(local.slice(5, 7)), Number(local.slice(8, 10)));
}

// Linear interpolation of one sorted [x, density] KDE curve; 0 outside its
// support (the stored KDE tails already decay to ~0 at the padded grid edges).
function interpDensity(curve: [number, number][], x: number): number {
  const n = curve.length;
  if (n === 0 || x <= curve[0]![0] || x >= curve[n - 1]![0]) return 0;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (curve[mid]![0] <= x) lo = mid; else hi = mid;
  }
  const [x0, y0] = curve[lo]!;
  const [x1, y1] = curve[hi]!;
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

// National ±window distribution curve (D-15 / T-4.7): the UNWEIGHTED MEAN of the
// 18 stations' empirical KDE densities — NOT a synthetic Gaussian. Each station's
// daily_window row already carries a scipy gaussian_kde curve in `distribution_json`
// (built once in precompute_datasette.py:284); we resample all of them onto one
// common grid spanning the union range and average — reusing the existing KDE, not
// computing a second one. This keeps the per-station and national curves the same
// KIND of curve (real, possibly skewed) rather than imposing a symmetric bell that
// misrepresents the tails where "how extreme is today" is judged. The averaging is
// unweighted, matching D-7's one-station-one-vote treatment of the national series;
// percentiles are averaged separately (see fetchEra5NationalWindowRow), so the
// cutoffs/category are unchanged — only the curve shape moves.
function averageDistributions(curves: [number, number][][]): [number, number][] {
  const valid = curves.filter(c => c.length >= 2);
  if (valid.length === 0) return [];
  const xmin = Math.min(...valid.map(c => c[0]![0]));
  const xmax = Math.max(...valid.map(c => c[c.length - 1]![0]));
  const N   = 200;                                    // matches the per-station grid
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const x = xmin + (xmax - xmin) * i / (N - 1);
    let sum = 0;
    for (const c of valid) sum += interpDensity(c, x);
    pts.push([parseFloat(x.toFixed(3)), parseFloat((sum / valid.length).toFixed(6))]);
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
    `daily_window.json?_shape=array&${dwCol("era5_name")}__exact=${encodeURIComponent(era5Name)}&${dwCol("month")}__exact=${month}&${dwCol("day")}__exact=${day}`
  );
  return rows[0] ?? null;
}

// Slovenia national ±window climatology = mean of the 18 stations' daily_window
// rows for this month/day. Percentiles are the unweighted mean of the per-station
// p5..p95; the distribution curve is the unweighted mean of the per-station
// empirical KDE curves (averageDistributions, D-15 / T-4.7) — the fitted-Gaussian
// synthesis was removed. Percentiles are unchanged from before, so cutoffs and the
// today-card category do not move; only the curve shape does.
export async function fetchEra5NationalWindowRow(month: number, day: number): Promise<DailyWindowRow | null> {
  const rows = await dsGet<DailyWindowRow[]>(
    `daily_window.json?_shape=array&${dwCol("month")}__exact=${month}&${dwCol("day")}__exact=${day}&_size=50`
  );
  assertNationalStationRows(rows, "daily_window");
  if (rows.length === 0) return null;
  const avg = (f: (r: DailyWindowRow) => number) =>
    rows.reduce((s, r) => s + (f(r) ?? 0), 0) / rows.length;
  const p5  = avg(r => r.p5),  p10 = avg(r => r.p10), p20 = avg(r => r.p20);
  const p50 = avg(r => r.p50), p80 = avg(r => r.p80), p95 = avg(r => r.p95);
  const curves = rows
    .filter(r => r.distribution_json)
    .map(r => parseJsonColumn<[number, number][]>(r.distribution_json, "daily_window.distribution_json"));
  return {
    station: ERA5_NATIONAL,
    month, day,
    p5, p10, p20, p50, p80, p95,
    n_samples: rows.reduce((s, r) => s + (r.n_samples ?? 0), 0),
    station_count: rows.length,
    year_min:  Math.min(...rows.map(r => r.year_min)),
    year_max:  Math.max(...rows.map(r => r.year_max)),
    distribution_json: JSON.stringify(averageDistributions(curves)),
  } as DailyWindowRow;
}

// ── Open-Meteo live (the ONLY correct live source for ERA5) ──────────────────
// ERA5-Land reanalysis lags ~5-10 days; the datasette stays authoritative for
// any date it has, and Open-Meteo fills only the recent gap (today/last days).
const OM = "https://api.open-meteo.com/v1/forecast";

async function openMeteoMax(lat: number, lon: number, elevation: number, date: string): Promise<number | null> {
  try {
    const resp = await fetch(`${OM}?latitude=${lat}&longitude=${lon}&elevation=${Math.round(elevation)}&daily=temperature_2m_max&timezone=Europe%2FLjubljana&start_date=${date}&end_date=${date}`);
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
    const resp = await fetch(`${OM}?latitude=${lats}&longitude=${lons}&elevation=${elevs}&daily=temperature_2m_max&timezone=Europe%2FLjubljana&start_date=${date}&end_date=${date}`);
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
  }>>(`stations.json?_shape=array&${dsCols(STATIONS_COLS)}&_size=30`);

  // T-5.2 — the station registry is the SOURCE of the station count that the three
  // national-aggregate asserts (assertNationalStationRows) trust, so a silent
  // truncation HERE would corrupt every one of them. This query is capped at
  // `_size=30` (18 stations today, margin 12); a full page means rows were dropped.
  // We cannot assert against a station count — this IS that source — so assert we
  // did not hit the cap. `_size=30` is kept literal (the offline fixture layer keys
  // on the exact URL); the throw surfaces via the section ErrorBoundary.
  if (era5Stations.length >= 30) {
    throw new Error(
      `[T-5.2] stations.json: got ${era5Stations.length} rows at the \`_size=30\` cap — the ` +
        `station registry was truncated, so every national aggregate would validate against a ` +
        `wrong station count. Raise the cap and re-record the fixtures.`,
    );
  }

  // Coordinates + true elevation for Open-Meteo live temps (elevation-corrected)
  era5Coords = Object.fromEntries(
    era5Stations.map(s => [s.era5_name, { lat: s.lat, lon: s.lon, elevation: s.elevation }])
  );

  // T-5.27 — `label` is the nominative DIACRITIC display name, authored in
  // i18n/station-names.ts. The datasette `name` column is ASCII (era5_name with
  // underscores→spaces), `official_name` is the ARSO station identity (a different
  // place for six towns), and `name_locative` is the locative case — none is the
  // display name (see that file). `s.name` is now unused for display but stays in
  // STATIONS_COLS: the fixture layer keys on the exact request URL, so dropping the
  // column would turn every offline run into a miss (same reason `station_id` stays).
  const stations = era5Stations.map(s => ({
    name:      s.era5_name,
    label:     displayNameFor(s.era5_name),
    source:    "era5" as const,
    lat:       s.lat,
    lon:       s.lon,
    elevation: s.elevation,
  }));

  return {
    country:          "si",
    name:             t("meta.name"),
    default_location: "Ljubljana",
    // D-8 — Slovenian only for v1 (was ["en"]/"en", contradicting the whole page).
    languages:        ["sl"],
    default_language: "sl",
    map:      { center_lat: 46.1, center_lon: 14.8, zoom: 7 },
    branding: { site_title: t("meta.site_title") },
    stations,
    strings: {
      explain_reg: t("reg.explain_reg"),
      explain_cal: t("reg.explain_cal"),
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
      `daily.json?_shape=array&${dCol("date")}__exact=${date}&${dsCols(DAILY_TODAY_COLS)}&_size=50`
    );
    assertNationalStationRows(dsRows, "daily");
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

    // Band/category/color still come from the p5..p95 cutoffs (categorizeEra5);
    // only the DISPLAYED percentile becomes the honest CDF of the served KDE
    // (T-4.1 / D-6). Reuse the parsed curve for both the percentile and the chart.
    const cat  = categorizeEra5(todayTemp, w);
    const dist = parseJsonColumn<[number, number][]>(w.distribution_json, "daily_window.distribution_json");
    return {
      available: true, date,
      today_temp: parseFloat(todayTemp.toFixed(1)), is_preliminary: isPreliminary,
      percentile: cdfPercentile(dist, todayTemp), category_key: cat.category_key, color: cat.color,
      // Always set by fetchEra5NationalWindowRow (= pooled station count); `?? 1` only
      // satisfies the optional type — a fallback of 1 would (correctly) trip the
      // tooltip's per-station guard, since n_samples is the SUM across stations.
      n_samples: w.n_samples, station_count: w.station_count ?? 1,
      year_min: w.year_min, year_max: w.year_max,
      distribution: dist,
      cutoffs: { p5: w.p5, p10: w.p10, p20: w.p20, p50: w.p50, p80: w.p80, p95: w.p95 },
      day_label: dayLabel(month, day), month_num: month, day_num: day,
      rank_info: null, loc: ERA5_NATIONAL,
    };
  }

  // ERA5 path — datasette reanalysis is authoritative; Open-Meteo fills the gap.
  let todayTemp: number | null = null;
  let isPreliminary = false;

  const rows = await dsGet<Array<{ temperature_max_2m: number }>>(
    `daily.json?_shape=array&${dCol("era5_name")}__exact=${encodeURIComponent(era5Name)}&${dCol("date")}__exact=${date}&${dsCols(DAILY_TODAY_COLS)}&_size=1`
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

  // Band/category/color from the p5..p95 cutoffs (categorizeEra5); the DISPLAYED
  // percentile is the honest CDF of the served KDE at today's value (T-4.1 / D-6).
  const cat  = categorizeEra5(todayTemp, w);
  const dist = parseJsonColumn<[number, number][]>(w.distribution_json, "daily_window.distribution_json");
  return {
    available: true, date,
    today_temp: todayTemp, is_preliminary: isPreliminary,
    percentile: cdfPercentile(dist, todayTemp), category_key: cat.category_key, color: cat.color,
    n_samples: w.n_samples, station_count: 1,
    year_min: w.year_min, year_max: w.year_max,
    distribution: dist,
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
    `daily.json?_shape=array&${dCol("era5_name")}__exact=${encodeURIComponent(era5Name)}&${dCol("date")}__lte=${date}&_sort_desc=date&_size=7&${dsCols(DAILY_LAST7_COLS)}`
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

  // The full-fetch response carries every daily_window column, including era5_name,
  // which DailyWindowRow deliberately does not Pick (station is synthesized from it).
  // Type the read as DailyWindowRow plus that one column, from the generated contract,
  // so `r.era5_name` is typed (no `as any`) AND a rename of era5_name is a compile
  // error here — the field is read nowhere else, so this is its only guard. (T-5.13)
  const rows = await dsGet<Array<DailyWindowRow & Pick<DsDailyWindow, "era5_name">>>(
    `daily_window.json?_shape=array&${dwCol("era5_name")}__exact=${encodeURIComponent(loc)}&${dwCol("month")}__exact=${month}&${dwCol("day")}__exact=${day}`
  );
  return rows.map(r => ({ ...r, station: r.era5_name ?? loc }));
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
    `season_heatmap.json?_shape=array&${shCol("era5_name")}__exact=${encodeURIComponent(era5Name)}&${dsCols(SEASON_HEATMAP_COLS)}&_size=500`
  );
}

// ── fetchRegression ────────────────────────────────────────────────────────────

export interface RegressionParams {
  locs:   string[];
  var:    string;
  doy:    number;
}

export async function fetchRegression(p: RegressionParams): Promise<RegressionResponse> {
  const { month, day } = doyToMonthDay(p.doy);

  const era5Results = await Promise.all(
    p.locs.map(loc => buildRegressionResult(loc, p.var, month, day))
  );

  return {
    results:    era5Results.filter(Boolean) as RegressionResult[],
    date_label: fmtMonthDay(month, day),
    ylabel:     varLabel(p.var),
    unit:       "°C",
  };
}

async function buildRegressionResult(
  era5Name: string, variable: string, month: number, day: number
): Promise<RegressionResult | null> {
  const rows = await dsGet<AnnualTrendRow[]>(
    `annual_trend.json?_shape=array&${atCol("era5_name")}__exact=${encodeURIComponent(era5Name)}&${atCol("variable")}__exact=${encodeURIComponent(variable)}&${atCol("month")}__exact=${month}&${atCol("day")}__exact=${day}&_size=1`
  );
  const r = rows[0];
  if (!r) return null;

  const scatter = parseJsonColumn<Array<{ x: number; y: number }>>(r.scatter_json, "annual_trend.scatter_json");
  const baselineYears = scatter.filter(pt => pt.x >= BASELINE_YEAR_MIN && pt.x <= BASELINE_YEAR_MAX);
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
      metric_lbl: "trend / 10 let", p_val: r.p_val,
      direction: r.trend10 >= 0 ? "up" : "down",
      chg_str: `${r.trend10 >= 0 ? "+" : ""}${r.trend10.toFixed(2)} °C/10y`,
      fit_desc: `τ = ${fmtNum(r.tau, 2)}`,
      sig_label: r.p_val < 0.05 ? "p < 0,05" : `p = ${fmtNum(r.p_val, 3)}`,
      n_years: r.n_years, ar1: null,
    },
  };
}

// ── Tropical days / nights ───────────────────────────────────────────────────

// Matches TropStation from TropicalChart.tsx so TropHighchart can be reused directly
export interface Era5TropicalData {
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
): Promise<Era5TropicalData | null> {
  if (loc === ERA5_NATIONAL) return null;
  // T-5.1: a fetch failure (HTTP error, missing `tropical` table) now propagates so
  // the section's ErrorBoundary can show a visible error, instead of being swallowed
  // into `null` and rendering as an empty section. A genuinely empty result set
  // (no matching row) still returns null — that is legitimate "no data", not a fault.
  const rows = await dsGet<Array<Pick<DsTropical, "years_json" | "counts_json" | "nonzero_count" | "trend_json">>>(
    `tropical.json?_shape=array&${trCol("era5_name")}__exact=${encodeURIComponent(loc)}` +
    `&${trCol("kind")}__exact=${kind}&${trCol("threshold")}__exact=${threshold}&${trCol("streak")}__exact=${streak}&_size=1`
  );
  const r = rows[0];
  if (!r) return null;
  const years  = parseJsonColumn<number[]>(r.years_json,  "tropical.years_json");
  const counts = parseJsonColumn<number[]>(r.counts_json, "tropical.counts_json");
  const t = parseJsonColumn<Era5TropicalData["trend"] | Record<string, never>>(r.trend_json, "tropical.trend_json");
  const trend = (t && (t as any).model_used) ? (t as Era5TropicalData["trend"]) : {
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
  // T-5.1: no try/catch — a fetch/parse failure propagates to the section's
  // ErrorBoundary (visible error) instead of being swallowed into `available:false`,
  // which the page renders as a silently absent section. An empty result set still
  // returns `empty` — that is legitimate "no data", not a fault.
  const rows = await dsGet<Array<{
    y: number; spei: number; balance: number; cat: string; rank: number;
    total: number; color: string; season: string; n_days: number;
  }>>(
    `spei.json?_shape=array&${dsCols(SPEI_COLS)}&_size=2000`
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
}

// SPEI per-station SPEI-3/SPEI-30 series — read the `spei_station` table.
export async function fetchSpeiStationSeasonal(): Promise<SpeiStationData> {
  const empty: SpeiStationData = { available: false, stations: {}, era5_last: "", baseline: "", year_min: 0, year_max: 0 };
  // T-5.1: no try/catch — a fetch/parse failure propagates to the section's
  // ErrorBoundary (visible error) instead of being swallowed into `available:false`.
  // A previously-swallowed malformed *_json row was the worst case: it silently
  // blanked the whole SPEI-trend section. An empty result set still returns `empty`.
  const rows = await dsGet<Array<{
    era5_name: string; series: string; years_json: string; spei_json: string; trend_json: string;
  }>>(
    `spei_station.json?_shape=array&${dsCols(SPEI_STATION_COLS)}&_size=1000`
  );
  if (!rows.length) return empty;
  const stations: SpeiStationData["stations"] = {};
  let ymin = Infinity, ymax = -Infinity;
  for (const r of rows) {
    const years = parseJsonColumn<number[]>(r.years_json, "spei_station.years_json");
    const spei  = parseJsonColumn<number[]>(r.spei_json,  "spei_station.spei_json");
    const trend = parseJsonColumn<SpeiStationData["stations"][string][string]["trend"]>(
      r.trend_json, "spei_station.trend_json");
    (stations[r.era5_name] ??= {})[r.series] = { years, spei, trend };
    if (years.length) { ymin = Math.min(ymin, years[0]!); ymax = Math.max(ymax, years[years.length - 1]!); }
  }
  return {
    available: true, stations, era5_last: "", baseline: "1950–1980",
    year_min: ymin === Infinity ? 0 : ymin, year_max: ymax === -Infinity ? 0 : ymax,
  };
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
  loc: string, variable: string
): Promise<CalendarData> {
  const rows = await dsGet<CalendarRow[]>(
    `annual_trend.json?_shape=array&${atCol("era5_name")}__exact=${encodeURIComponent(loc)}&${atCol("variable")}__exact=${encodeURIComponent(variable)}&${dsCols(CALENDAR_COLS)}&_size=400`
  );
  return { loc, var: variable, unit: "°C", method_label: "Theil-Sen + TFPW MK", rows };
}

// ── fetchAnnualTrend ───────────────────────────────────────────────────────────

// National annual trend = mean of the 18 stations' temperature_max rows for this
// day: scatter averaged per year, line params averaged. (Interim client-side
// pooling; the precompute will eventually bake an era5:national row.)
async function fetchNationalAnnualTrendRow(month: number, day: number): Promise<AnnualTrendRow | undefined> {
  const rows = await dsGet<AnnualTrendRow[]>(
    `annual_trend.json?_shape=array&${atCol("variable")}__exact=temperature_max&${atCol("month")}__exact=${month}&${atCol("day")}__exact=${day}&_size=50`
  );
  assertNationalStationRows(rows, "annual_trend");
  if (!rows.length) return undefined;
  const avg = (f: (r: AnnualTrendRow) => number) => rows.reduce((s, r) => s + (f(r) ?? 0), 0) / rows.length;

  // Average scatter y per year across stations
  const perYear = new Map<number, { sum: number; n: number }>();
  for (const r of rows) {
    for (const pt of parseJsonColumn<Array<{ x: number; y: number }>>(r.scatter_json, "annual_trend.scatter_json")) {
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
  // Tmax is the default headline variable everywhere (D-14 / T-4.8): the today
  // card, the national trend above, and this per-station trend all lead with
  // temperature_max, so the chart's "najvišje temperature" label is honest and
  // the page never leads with the urban-heat-island-biased Tmin/Tmean. Tmean/Tmin
  // stay reachable via the RegressionPanel selector, they are just no longer the
  // default. Do not flip back to temperature_mean.
  const r = era5Name === ERA5_NATIONAL
    ? await fetchNationalAnnualTrendRow(month, day)
    : (await dsGet<AnnualTrendRow[]>(
        `annual_trend.json?_shape=array&${atCol("era5_name")}__exact=${encodeURIComponent(era5Name)}&${atCol("variable")}__exact=temperature_max&${atCol("month")}__exact=${month}&${atCol("day")}__exact=${day}&_size=1`
      ))[0];
  if (!r) throw new Error("No annual trend row");
  return {
    dayLabel: r.day_label, monthNum: r.month, dayNum: r.day,
    yearMin: r.year_min, yearMax: r.year_max,
    trend10: r.trend10, pVal: r.p_val, tau: r.tau, nYears: r.n_years,
    scatter: parseJsonColumn<Array<{ x: number; y: number }>>(r.scatter_json, "annual_trend.scatter_json"),
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
