// T-1.1 — output snapshot harness.
//
// Captures every number the ERA5 page displays, for a fixed set of
// (station, date) pairs, and returns it as a plain object that
// scripts/snapshot/main.mjs writes to tests/fixtures/snapshot.json.
//
// ── How this runs ─────────────────────────────────────────────────────────────
//
// Bundled by tests/snapshot/vite.config.mjs into a single ESM file and executed
// by Node against jsdom, with `highcharts` aliased to a recording stub. The
// network is disabled by the APP'S OWN fixture shim
// (code/ali-je-vroce-era5/fixtures/install.ts) — not a copy of it — so all three
// of its preconditions (no failed recordings, pinned date matches, datasette base
// matches) guard this run too, and `window.__FIXTURE_MISSES__` is literally the
// same array the browser sees.
//
// ── Why it does not mount AliJeVroceERA5 ──────────────────────────────────────
//
// The selected date and the two station signals are internal to Dashboard
// (AliJeVroceERA5.tsx:44-64) with no external entry point: the only date control
// is prev/next-day buttons (TodayCard.tsx:90-110), so reaching 1985-01-07 from
// the pinned 2026-07-21 would take ~15 000 clicks. The harness therefore mirrors
// the page's composition with date and station as parameters.
//
// That mirror can drift, so it is checked rather than trusted:
// tests/snapshot/sections.json classifies every capitalised JSX tag in
// AliJeVroceERA5.tsx, and scripts/snapshot/main.mjs FAILS THE RUN on any tag it
// does not know about. Adding a section to the page cannot silently escape the
// snapshot.
//
// The page also renders displayed numbers ITSELF, in bare <div>/<p> that no
// component owns and no tag assertion can see (:99-112 and :137-145). Those are
// mirrored below by TodayChartCopy and MapPanelHeader, and main.mjs
// assertMirroredCopy requires each mirrored template to still appear verbatim in
// the page.
//
// ── What is NOT captured ──────────────────────────────────────────────────────
//
// SeaLevelWidget. Its numbers come from /data/flood-stats.json and the
// unattributed 20.77 ha / 14.13 buildings factors, none of which are in the
// T-1.2 fixture set, and D-10c currently blocks the widget from launching at all.
// Full reasoning and the re-entry condition are in sections.json `excluded`.

import { render } from "solid-js/web";
import type { JSX } from "solid-js";

import {
  fetchMeta,
  fetchPageData,
  fetchAnnualTrend,
  fetchSeasonHeatmap,
  fetchEra5Tropical,
  fetchSpeiHeatmap,
  fetchSpeiStationSeasonal,
  fetchCalendar,
  ERA5_NATIONAL,
} from "../../code/ali-je-vroce-era5/api.ts";
import { installFixtures, misses } from "../../code/ali-je-vroce-era5/fixtures/install.ts";
import { today as todayIso, todayYear } from "../../code/ali-je-vroce-era5/clock.ts";
import type { SiteMeta, TodayStatus, Last7 } from "../../code/ali-je-vroce-era5/types.ts";

import { TodayCard } from "../../code/ali-je-vroce-era5/components/TodayCard.tsx";
import { DistributionChart } from "../../code/ali-je-vroce-era5/charts/DistributionChart.tsx";
import { TodayTrendChart } from "../../code/ali-je-vroce-era5/components/TodayTrendChart.tsx";
import { HeroCards } from "../../code/ali-je-vroce-era5/components/HeroCards.tsx";
import { StationMap } from "../../code/ali-je-vroce-era5/components/StationMap.tsx";
import { Era5SeasonHeatmap } from "../../code/ali-je-vroce-era5/charts/Era5SeasonHeatmap.tsx";
import { Era5TropicalChart } from "../../code/ali-je-vroce-era5/charts/Era5TropicalChart.tsx";
import { SpeiHeatmap } from "../../code/ali-je-vroce-era5/charts/SpeiHeatmap.tsx";
import { SpeiTrendChart } from "../../code/ali-je-vroce-era5/charts/SpeiTrendChart.tsx";
import {
  RegressionPanel,
  RegToolbar,
  RegScatterCard,
  RegYearRoundCard,
} from "../../code/ali-je-vroce-era5/components/RegressionPanel.tsx";

import { chartLog, resetChartLog, type RecordedChart } from "./highcharts-stub.ts";
import cases from "./cases.json";

// ── Deterministic settling ────────────────────────────────────────────────────
//
// Counts in-flight fetches through a wrapper installed OVER the fixture shim, and
// waits for a quiet period rather than a fixed delay.
//
// Iteration-counted, NOT wall-clock. `Date.now()` is frozen in the fake-clock
// run (scripts/snapshot/main.mjs --simulate-date), so a time-based timeout would
// never fire and a hang would look like a stall instead of a failure.

let pending = 0;

/**
 * PROBE MODE — `yarn snapshot --probe-fixture-gaps`.
 *
 * A missing fixture aborts the run at the first offending URL, which turns
 * "find out what the fixture matrix is short of" into one re-record per gap. In
 * probe mode a refused URL is swallowed and answered with an empty JSON array so
 * the run continues and reports the COMPLETE gap list in one pass.
 *
 * This cannot be used to launder a snapshot: main.mjs refuses to write anything
 * when the flag is set, and this function is the only thing that reads it.
 */
const PROBE: boolean = (globalThis as any).__SNAPSHOT_PROBE__ === true;

function countFetches(): void {
  const inner = globalThis.fetch;
  globalThis.fetch = async function counted(...args: Parameters<typeof fetch>) {
    pending++;
    try {
      return await inner(...args);
    } catch (err) {
      if (!PROBE) throw err;
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    } finally {
      pending--;
    }
  } as typeof fetch;
}

const QUIET_TICKS = 25;
const MAX_TICKS = 6000;

async function settle(label: string): Promise<void> {
  let quiet = 0;
  for (let i = 0; i < MAX_TICKS; i++) {
    await new Promise((r) => setTimeout(r, 2));
    if (pending === 0) {
      quiet++;
      if (quiet >= QUIET_TICKS) return;
    } else {
      quiet = 0;
    }
  }
  throw new Error(
    `[snapshot] ${label}: never went quiet (${pending} fetches still in flight after ` +
      `${MAX_TICKS} ticks). Either a fixture request is hanging or a component is ` +
      `looping. This is a harness failure, not a snapshot diff — nothing was written.`,
  );
}

// ── Fixture-miss assertion ────────────────────────────────────────────────────
//
// install.ts appends to `misses` BEFORE throwing, precisely because six call
// sites swallow the throw and degrade to an empty section (api.ts:257,279,1059,
// 1324,1352 and StationMap.tsx:119). Without this check a snapshot of
// partially-missing data would look like a clean run.

let missCursor = 0;

function assertNoMisses(label: string): void {
  if (misses.length === missCursor) return;
  const fresh = misses.slice(missCursor).map((m) => m.url);
  missCursor = misses.length;
  if (PROBE) {
    console.warn(`[probe] ${label}: ${fresh.length} unrecorded request(s)`);
    return;
  }
  throw new Error(
    `[snapshot] ${label}: ${fresh.length} unrecorded request(s) — the section rendered ` +
      `with MISSING DATA and must not be baselined:\n  ${fresh.join("\n  ")}\n\n` +
      `Add the parameters to tests/fixtures/manifest.json and re-run \`yarn fixtures:record\`, ` +
      `or, if the URL is new, a code change introduced a network call T-1.2 did not enumerate. ` +
      `No snapshot was written.`,
  );
}

// ── Mounting ──────────────────────────────────────────────────────────────────

interface Unit {
  label: string;
  el: HTMLElement;
  charts: RecordedChart[];
}

/**
 * `expectedCharts` is not bookkeeping — it is the guard on settle().
 *
 * settle() waits for a quiet window on in-flight FETCHES, and a chart can mount
 * after that window closes: a lazy() boundary that resolves late, or a chart
 * built in an effect that no fetch is pending on. chartLog() would then be read
 * short, and a chart missing from the snapshot looks exactly like a chart that
 * has no options — an empty array, no error, silently baselined.
 *
 * So every mount states how many charts the unit draws, and this asserts it,
 * TWICE: once at the end of the first quiet window, and again after a second
 * one, failing if the count grew in between. The first check catches a chart
 * that never arrives; the second catches one that arrives late — including the
 * case where the expected count is 0.
 */
async function mount(
  label: string,
  node: () => JSX.Element,
  expectedCharts: number,
): Promise<Unit> {
  resetChartLog();
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(node, el);
  await settle(label);
  assertNoMisses(label);

  const charts = chartLog().slice();
  if (charts.length !== expectedCharts) {
    throw new Error(
      `[snapshot] ${label}: expected ${expectedCharts} chart(s), got ${charts.length}.\n\n` +
        `Either the unit's chart count changed — in which case update the expected count ` +
        `at the mount() call and say why in the commit — or a chart mounted outside the ` +
        `settle() quiet window and the capture is short. No snapshot was written.`,
    );
  }

  // Second quiet window: a chart that mounts late would otherwise be recorded as
  // an absence rather than reported as one.
  await settle(`${label} (re-check)`);
  if (chartLog().length !== charts.length) {
    throw new Error(
      `[snapshot] ${label}: chart count grew from ${charts.length} to ${chartLog().length} ` +
        `during a SECOND quiet window, so the first capture was taken too early. The unit ` +
        `mounts a chart that settle() cannot see — it is not gated on a fetch. ` +
        `No snapshot was written.`,
    );
  }
  assertNoMisses(`${label} (re-check)`);

  // Snapshot the DOM before teardown; onCleanup destroys the charts.
  const frozen = el.cloneNode(true) as HTMLElement;
  dispose();
  el.remove();
  return { label, el: frozen, charts };
}

// ── DOM readers ───────────────────────────────────────────────────────────────
//
// A SELECTOR THAT MATCHES NOTHING FAILS THE RUN. It used to return null (or []
// for txtAll), which records absence as emptiness: `harness.tsx:661` asked
// SeasonHeatmap for its `<p>` elements, of which it has none, and both stations
// baselined `[]` — a passing snapshot of a section nobody was watching.
//
// Where a selector is legitimately conditional (the today card's unavailable
// branch, the preliminary badge), the CALLER branches on the state that decides
// it and uses `optional()`, which takes the reason as an argument. Absence then
// has to be argued for rather than defaulted into.

function norm(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

class Reader {
  constructor(
    private root: HTMLElement,
    private label: string,
  ) {}

  /** Same unit, narrower root (e.g. one card inside a panel). */
  within(el: HTMLElement, what: string): Reader {
    return new Reader(el, `${this.label} > ${what}`);
  }

  private fail(sel: string, what: string): never {
    throw new Error(
      `[snapshot] ${this.label}: selector \`${sel}\` matched ${what}.\n\n` +
        `A capture point that matches nothing records an absence as an empty value, which ` +
        `is indistinguishable from a section that legitimately has no content — the exact ` +
        `failure this guard exists for. Either the markup moved (fix the selector) or the ` +
        `content is genuinely conditional (branch on the state that decides it and use ` +
        `optional(), stating why). No snapshot was written.`,
    );
  }

  one(sel: string): HTMLElement {
    const el = this.root.querySelector(sel) as HTMLElement | null;
    if (!el) this.fail(sel, "no elements");
    return el;
  }

  txt(sel: string): string | null {
    return norm(this.one(sel).textContent);
  }

  all(sel: string): string[] {
    const els = Array.from(this.root.querySelectorAll(sel));
    if (els.length === 0) this.fail(sel, "no elements");
    return els.map((e) => norm(e.textContent)).filter((s): s is string => s !== null);
  }

  style(sel: string, prop: string): string | null {
    return norm(this.one(sel).style.getPropertyValue(prop));
  }

  /**
   * For markup the page renders only in some states. `why` is not used at
   * runtime; it exists so every tolerated absence carries its justification at
   * the call site.
   */
  optional(sel: string, _why: string): string | null {
    const el = this.root.querySelector(sel);
    return el ? norm(el.textContent) : null;
  }

  optionalStyle(sel: string, prop: string, _why: string): string | null {
    const el = this.root.querySelector(sel) as HTMLElement | null;
    return el ? norm(el.style.getPropertyValue(prop)) : null;
  }

  has(sel: string): boolean {
    return this.root.querySelector(sel) != null;
  }
}

function read(unit: Unit): Reader {
  return new Reader(unit.el, unit.label);
}

// ── Chart-option extraction ───────────────────────────────────────────────────
//
// Values only. Styles, formatters and layout are deliberately dropped: they are
// markup concerns, and T-1.3's screenshots are the right instrument for them.

function sanitize(v: any, depth = 0): any {
  if (v == null) return null;
  if (typeof v === "function") return undefined;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (depth > 8) return "[deep]";
  if (Array.isArray(v)) return v.map((x) => sanitize(x, depth + 1)).filter((x) => x !== undefined);
  if (typeof v === "object") {
    if (typeof (v as any).nodeType === "number") return "[dom]";
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) {
      const s = sanitize(v[k], depth + 1);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return undefined;
}

/**
 * Reads the axis state the stub maintains, not the construction-time options —
 * several charts only reach their displayed state after mount
 * (RegressionChart.tsx:101,129 adds the baseline line; YearRoundChart.tsx:137-138
 * moves the selected-day line), and those lines carry real numbers.
 */
function axisInfo(a: any): any {
  if (!a) return null;
  return {
    title: a.title ?? null,
    min: a.min ?? null,
    max: a.max ?? null,
    categories: a.categories ?? null,
    plot_lines: (a.plotLines ?? []).map((p: any) => ({
      id: p.id ?? null,
      value: p.value ?? null,
      label: p.label?.text ?? null,
      dash_style: p.dashStyle ?? null,
    })),
    plot_bands: (a.plotBands ?? []).map((b: any) => ({
      from: b.from ?? null,
      to: b.to ?? null,
      label: b.label?.text ?? null,
    })),
  };
}

function extractChart(c: RecordedChart): any {
  const o = c.options ?? {};
  const zones: any[] = [];
  for (const [type, po] of Object.entries<any>(o.plotOptions ?? {})) {
    if (po?.zones) zones.push({ series_type: type, zones: po.zones.map((z: any) => z.value ?? null) });
  }
  return {
    seq: c.seq,
    kind: c.kind,
    chart_type: o.chart?.type ?? null,
    x_axis: axisInfo(c.axes.x),
    y_axis: axisInfo(c.axes.y),
    zones: zones.length ? zones : null,
    series: c.seriesRef.map((s: any) => ({
      name: s?.name ?? null,
      type: s?.type ?? null,
      data: sanitize(s?.data),
    })),
    mutations: c.mutations.map((m) => `${m.op}${m.target ? ` ${m.target}` : ""}`),
  };
}

/**
 * The one bar a tropical chart draws differently: the current year, coloured
 * ACCENT at 0.4 opacity (TropicalChart.tsx:73-76). It used to come from
 * `new Date().getFullYear()` and now comes from todayYear(), so pinning it here
 * is what stops the T-1.1 snapshot rolling over on 1 January.
 */
function highlightedBar(chart: any): any {
  const bars = chart?.series?.find((s: any) => s.type === "column")?.data ?? [];
  const hits = bars.filter((b: any) => b && typeof b === "object" && b.color != null);
  return {
    n_bars: bars.length,
    n_highlighted: hits.length,
    year: hits.length === 1 ? hits[0].x : null,
    color: hits.length === 1 ? hits[0].color : null,
    opacity: hits.length === 1 ? hits[0].opacity : null,
    expected_year: todayYear(),
    matches_pinned_clock: hits.length === 1 && hits[0].x === todayYear(),
  };
}

// ── Capture: today card ───────────────────────────────────────────────────────

function captureTodayCard(unit: Unit, status: TodayStatus, last7: Last7): any {
  const el = unit.el;
  const r = read(unit);

  // TodayCard.tsx:135 renders EITHER the data card or <UnavailableCard>, so the
  // data selectors are conditional on exactly one thing: r().available. Branch on
  // it rather than letting every selector shrug and return null.
  const ok = status.available === true;
  const why = "TodayCard.tsx:135 — the data card is not rendered when available is false";

  const pctSpans = Array.from(el.querySelectorAll(".today-pct-wrap > span"));
  // The badge is the only span in that column with no class attribute
  // (TodayCard.tsx:173-185). Selected structurally so a copy change to the badge
  // TEXT still shows up as a diff instead of silently failing to match.
  const badgeEl = pctSpans.find((s) => !s.getAttribute("class"));
  if (ok && status.is_preliminary && !badgeEl) {
    throw new Error(
      `[snapshot] ${unit.label}: is_preliminary is true but no unclassed span exists in ` +
        `.today-pct-wrap — the 'ERA5T · preliminarno' badge (TodayCard.tsx:173-185) moved. ` +
        `No snapshot was written.`,
    );
  }

  return {
    available: status.available === true,
    // Raw values, straight off fetchTodayStatus.
    values: {
      date: status.date ?? null,
      loc: status.loc ?? null,
      today_temp: status.today_temp ?? null,
      percentile: status.percentile ?? null,
      category_key: status.category_key ?? null,
      color: status.color ?? null,
      is_preliminary: status.is_preliminary ?? null,
      n_samples: status.n_samples ?? null,
      year_min: status.year_min ?? null,
      year_max: status.year_max ?? null,
      day_label: status.day_label ?? null,
      month_num: status.month_num ?? null,
      day_num: status.day_num ?? null,
      cutoffs: status.cutoffs ?? null,
      distribution: {
        n_points: status.distribution?.length ?? 0,
        points: status.distribution ?? null,
      },
    },
    // The same numbers as the reader sees them, formatting included.
    rendered: {
      // The date/location control is outside the Show, so it renders either way.
      date_badge: r.txt(".today-date-badge"),
      category_label: ok ? r.txt(".today-cat") : r.optional(".today-cat", why),
      category_color: ok
        ? r.style(".today-cat", "color")
        : r.optionalStyle(".today-cat", "color", why),
      description: ok ? r.txt(".today-desc") : r.optional(".today-desc", why),
      percentile: ok ? r.txt(".today-pct-num") : r.optional(".today-pct-num", why),
      percentile_label: ok ? r.txt(".today-pct-label") : r.optional(".today-pct-label", why),
      samples:
        ok && (status.n_samples ?? 0) > 0
          ? r.txt(".today-pct-samples")
          : r.optional(
              ".today-pct-samples",
              "TodayCard.tsx:169 — only rendered when n_samples > 0",
            ),
      // D-11 OPEN: this string says ERA5T, but the value it labels comes from
      // api.open-meteo.com/v1/forecast (api.ts:249), an NWP blend that is never
      // ERA5T. Snapshotted verbatim on purpose — correcting it is T-4.13.
      // Presence is asserted above against status.is_preliminary.
      preliminary_badge: badgeEl ? norm(badgeEl.textContent) : null,
      // Both branches render `.today-explain`: the data card's provenance line
      // (TodayCard.tsx:191) or UnavailableCard's message (TodayCard.tsx:290).
      explain: r.txt(".today-explain"),
      footer: ok ? r.txt(".today-foot") : r.optional(".today-foot", why),
      unavailable_message: r.has(".today-card-data") ? null : r.txt(".today-explain"),
    },
    last7: {
      available: last7.available === true,
      days: (last7.days ?? []).map((d) => ({
        date: d.date,
        day_label: d.day_label,
        today_temp: d.today_temp,
        percentile: d.percentile,
        category_key: d.category_key,
        color: d.color,
      })),
    },
    charts: unit.charts.map(extractChart),
  };
}

// ── Capture: annual trend ─────────────────────────────────────────────────────

/**
 * fetchAnnualTrend (api.ts:1433) THROWS rather than degrading when the
 * month/day has no row, which is every Feb 29 — the leap-day gap belongs to
 * T-4.5 and is snapshotted here as current behaviour, not fixed.
 *
 * The catch matches THAT throw and nothing else: any other failure is a harness
 * or fixture problem and must abort the run rather than be recorded as if it
 * were the page's normal Feb 29 behaviour.
 */
const NO_TREND_ROW = "No annual trend row";

async function captureTrendApi(month: number, day: number, loc: string | null): Promise<any> {
  try {
    const t = await fetchAnnualTrend(month, day, loc);
    return {
      threw: false,
      day_label: t.dayLabel,
      month_num: t.monthNum,
      day_num: t.dayNum,
      year_min: t.yearMin,
      year_max: t.yearMax,
      n_years: t.nYears,
      trend10: t.trend10,
      p_val: t.pVal,
      tau: t.tau,
      hist_line: t.histLine,
      proj_line: t.projLine,
      scatter: t.scatter,
    };
  } catch (err: any) {
    if (err?.message !== NO_TREND_ROW) throw err;
    return {
      threw: true,
      error: NO_TREND_ROW,
      thrown_at: "api.ts:1433",
      ticket: "T-4.5",
      note:
        "Current behaviour, deliberately not fixed here. Every month/day-keyed " +
        "precomputed table is missing Feb 29, so this call throws instead of " +
        "degrading. The today card is already unavailable by this point " +
        "(api.ts:473), so the page renders no trend section at all.",
    };
  }
}

// ── Capture: analysis panel ───────────────────────────────────────────────────

function captureAnalysis(unit: Unit): any {
  const r = read(unit);
  const scatter = r.within(r.one(".reg-card"), ".reg-card[0]");
  return {
    rendered: {
      toolbar: r.all(".reg-toolbar > div"),
      day_label: r.txt(".reg-doy-ctrl > div"),
      title: scatter.txt("[style*='font-size: 15px']"),
      subtitle: scatter.txt("[style*='margin-top: 3px']"),
      // "<n> YR · <significance>" — RegressionPanel.tsx:262
      stats_badge: scatter.all("[style*='white-space: nowrap']").slice(-1)[0] ?? null,
      total_change: scatter.txt("[style*='font-size: 20px']"),
      total_change_color: scatter.style("[style*='font-size: 20px']", "color"),
      footer: scatter.all("p"),
    },
    charts: unit.charts.map(extractChart),
  };
}

// ── Capture: the page's own raw JSX ───────────────────────────────────────────
//
// AliJeVroceERA5.tsx renders displayed numbers INLINE, outside any component:
// the distribution chart's title and footer (:100-111) and the map panel's
// station count (:139-144). No component owns them, so no component mount
// captures them, and the section-set assertion structurally cannot see them —
// it matches capitalised JSX tags, and these are bare <div>s (that limitation is
// documented at scripts/snapshot/main.mjs, where the assertion is defined).
//
// They are therefore MIRRORED here, character for character, and the mirror is
// checked against the source: scripts/snapshot/main.mjs `assertMirroredCopy`
// requires each template below to appear verbatim in AliJeVroceERA5.tsx, so
// editing the page without editing the harness fails the run rather than
// baselining a string the page no longer renders.

const EN_MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** AliJeVroceERA5.tsx:23-26. */
function fmtDayLabel(dl: string): string {
  const [mon, day] = dl.split(" ");
  return `${(day ?? "").padStart(2, "0")}.${EN_MONTHS[mon ?? ""] ?? "??"}`;
}

/** Mirrors AliJeVroceERA5.tsx:99-112 — the today-chart title, explain and foot. */
function TodayChartCopy(props: { data: TodayStatus; isNat: boolean }) {
  const t = () => props.data;
  return (
    <div class="today-chart">
      <div class="today-chart-title">
        {props.isNat
          ? `Dnevne najvišje temperature v Sloveniji za dva tedna okoli ${fmtDayLabel(t().day_label ?? "")} od ${t().year_min}`
          : `Dnevne najvišje temperature na postaji ${t().loc!.replace(/_/g, " ")} za dva tedna okoli ${fmtDayLabel(t().day_label ?? "")} od ${t().year_min}`}
      </div>
      <p class="today-explain" style={{ "font-size": "12px", "padding-top": "6px" }}>
        Krivulja prikazuje, kako pogosto se je pojavila vsaka vrhunska temperatura na dneve, kot je danes, v vseh letih. Barve označujejo klimatološke cone — od hladne modre prek tipičnega bežastega pasu do ekstremne rdeče.
      </p>
      <div class="today-foot">
        {`${props.isNat ? "Slovenija" : "Danes"}: ${t().today_temp!.toFixed(1)} °C · ${t().percentile!.toFixed(0)}. percentil · mediana ${t().cutoffs!.p50.toFixed(1)} °C · ${(t().n_samples ?? 0).toLocaleString()} opazovanj · ${t().year_min}–${t().year_max}`}
      </div>
    </div>
  );
}

/** Mirrors AliJeVroceERA5.tsx:137-145 — the map panel header. */
function MapPanelHeader(props: { mapLoc: string | null; stationCount: number }) {
  return (
    <div>
      <div class="mirror-panel-title">
        {props.mapLoc ? props.mapLoc.replace(/_/g, " ") : "Slovenija — vse postaje"}
      </div>
      <div class="mirror-panel-sub">{props.stationCount} postaj · ERA5</div>
    </div>
  );
}

// ── The run ───────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** AliJeVroceERA5.tsx:28-32, reproduced so the analysis doy matches the page. */
function dateToDoy(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  return Math.floor((d.getTime() - start.getTime()) / DAY_MS);
}

export interface RunResult {
  environment: Record<string, any>;
  snapshot: Record<string, any>;
}

export async function run(): Promise<RunResult> {
  await installFixtures();
  countFetches();

  const defaults = (cases as any).analysis_defaults;
  const snapshotStations: string[] = (cases as any).snapshot_stations;

  // ── meta ────────────────────────────────────────────────────────────────────
  const meta: SiteMeta = await fetchMeta();
  assertNoMisses("global.meta");

  const era5Stations = meta.stations.filter((s) => s.source === "era5");
  const era5Meta = (): SiteMeta => ({
    ...meta,
    stations: era5Stations,
    default_location: meta.default_location ?? "Ljubljana",
  });
  const labelOf = (name: string) => era5Stations.find((s) => s.name === name)?.label ?? name;

  // ── global ──────────────────────────────────────────────────────────────────
  const mapUnit = await mount(
    "global.station_map",
    () => <StationMap meta={era5Meta()} loc={null} onSelect={() => {}} />,
    1, // the mapChart (StationMap.tsx:47)
  );

  // The map panel's own header, which the page renders as raw JSX around
  // <StationMap> (AliJeVroceERA5.tsx:137-145) — `{era5Stations.length} postaj`
  // is a displayed number no component owns.
  const mapHeaderUnit = await mount(
    "global.map_panel_header",
    () => <MapPanelHeader mapLoc={null} stationCount={era5Stations.length} />,
    0,
  );

  const speiNational = await fetchSpeiHeatmap();
  assertNoMisses("global.spei_national (fetch)");
  const speiUnit = await mount(
    "global.spei_national",
    () => <SpeiHeatmap data={speiNational} />,
    0, // SeasonHeatmap-style CSS grid, no Highcharts
  );

  const speiStation = await fetchSpeiStationSeasonal();
  assertNoMisses("global.spei_station (fetch)");
  const speiStationUnit = await mount(
    "global.spei_station",
    () => <SpeiTrendChart data={speiStation} />,
    1,
  );

  const speiRows: Record<string, any> = {};
  for (const r of speiNational.data ?? []) {
    speiRows[`${r.season}|${r.y}`] = {
      spei: r.spei,
      cat: r.cat,
      color: r.color,
      balance: r.balance,
      n_days: r.n_days,
      rank: r.rank,
      total: r.total,
    };
  }

  // Full SPEI series for the two snapshot stations; trend parameters only for the
  // other sixteen. The chart shows one station and one period at a time
  // (SpeiTrendChart.tsx:139-140), so the full arrays for all eighteen would be
  // ~300 kB of numbers no reader ever sees, while the trend parameters ARE
  // rendered as a headline for whichever station is picked.
  const speiStationFull: Record<string, any> = {};
  const speiStationTrends: Record<string, any> = {};
  for (const name of Object.keys(speiStation.stations ?? {}).sort()) {
    const byPeriod = speiStation.stations[name]!;
    const trends: Record<string, any> = {};
    const full: Record<string, any> = {};
    for (const period of Object.keys(byPeriod).sort()) {
      const s = byPeriod[period]!;
      trends[period] = {
        n_years: s.years.length,
        year_min: s.years[0] ?? null,
        year_max: s.years[s.years.length - 1] ?? null,
        trend: s.trend ?? null,
      };
      if (snapshotStations.includes(name)) full[period] = { years: s.years, spei: s.spei, trend: s.trend };
    }
    speiStationTrends[name] = trends;
    if (snapshotStations.includes(name)) speiStationFull[name] = full;
  }

  const global = {
    meta: {
      country: meta.country,
      name: meta.name,
      default_location: meta.default_location,
      languages: meta.languages,
      default_language: meta.default_language,
      map: meta.map,
      branding: meta.branding,
      strings: meta.strings,
      station_count: era5Stations.length,
      stations: era5Stations.map((s) => ({
        name: s.name,
        label: s.label,
        lat: s.lat,
        lon: s.lon,
        elevation: s.elevation,
      })),
    },
    station_map: {
      _note:
        "Displays no numbers of its own. Rendered so the Highcharts topology fixture " +
        "(StationMap.tsx:45-46) is exercised rather than merely recorded. The marker " +
        "count is the one figure worth watching: api.ts:215,354,1391 cap station " +
        "queries at _size=50 and would truncate silently (T-5.2).",
      marker_count:
        mapUnit.charts[0]?.seriesRef?.find((s: any) => s?.type === "mappoint")?.data?.length ?? null,
      charts: mapUnit.charts.map(extractChart),
      panel_header: {
        _note:
          "Raw JSX in AliJeVroceERA5.tsx:137-145, owned by no component and therefore " +
          "invisible to the section-set assertion. Mirrored by MapPanelHeader in " +
          "harness.tsx and checked against the source by main.mjs assertMirroredCopy. " +
          "`station_count` is the same figure the _size=50 cap would truncate (T-5.2).",
        title: read(mapHeaderUnit).txt(".mirror-panel-title"),
        station_count: read(mapHeaderUnit).txt(".mirror-panel-sub"),
      },
    },
    spei_national: {
      available: speiNational.available,
      year_min: speiNational.year_min,
      year_max: speiNational.year_max,
      baseline: speiNational.baseline,
      n_rows: speiNational.data?.length ?? 0,
      rows: speiRows,
      rendered_legend: read(speiUnit).all("button"),
    },
    spei_station: {
      available: speiStation.available,
      year_min: speiStation.year_min,
      year_max: speiStation.year_max,
      baseline: speiStation.baseline,
      station_count: Object.keys(speiStation.stations ?? {}).length,
      default_view: {
        _note: "What SpeiTrendChart.tsx:139-140 selects with no interaction.",
        station: Object.keys(speiStation.stations ?? {}).sort()[0] ?? null,
        period: "Summer",
        rendered: read(speiStationUnit).all("p"),
      },
      trends: speiStationTrends,
      series_snapshot_stations: speiStationFull,
      charts: speiStationUnit.charts.map(extractChart),
    },
  };

  // ── by_station ──────────────────────────────────────────────────────────────
  const byStation: Record<string, any> = {};

  for (const station of snapshotStations) {
    const label = labelOf(station);

    const heatRows = await fetchSeasonHeatmap(station);
    assertNoMisses(`by_station.${station}.season_heatmap (fetch)`);
    const heatUnit = await mount(
      `by_station.${station}.season_heatmap`,
      () => <Era5SeasonHeatmap loc={station} label={label} />,
      0, // SeasonHeatmap.tsx draws a CSS grid, not a Highcharts chart
    );
    const seasonRows: Record<string, any> = {};
    for (const r of heatRows) {
      seasonRows[`${(r as any).season}|${(r as any).y}`] = {
        avg: (r as any).avg,
        percentile: (r as any).percentile,
        cat: (r as any).cat,
        color: (r as any).color,
        rank: (r as any).rank,
        total: (r as any).total,
        n_days: (r as any).n_days,
      };
    }

    // The year-round calendar is keyed on station + variable only; its 365 rows
    // do not move with the selected date, which is why it lives here and not in
    // `cases`. doy=1 only positions the selected-day marker.
    const cal = await fetchCalendar(station, defaults.variable, defaults.window_days, "raw", "theilsen");
    assertNoMisses(`by_station.${station}.calendar (fetch)`);
    const calUnit = await mount(
      `by_station.${station}.calendar`,
      () => (
        <RegressionPanel meta={era5Meta()} defaultDoy={1} syncLoc={() => station}>
          <RegYearRoundCard />
        </RegressionPanel>
      ),
      1, // YearRoundChart
    );
    const calRows: Record<string, [number, number]> = {};
    for (const r of cal.rows) {
      calRows[`${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`] = [
        r.trend10,
        r.p_val,
      ];
    }

    const tropical: Record<string, any> = {};
    for (const kind of ["days", "nights"] as const) {
      const threshold =
        kind === "days" ? defaults.tropical_days_threshold : defaults.tropical_nights_threshold;
      const data = await fetchEra5Tropical(station, kind, threshold, defaults.tropical_streak);
      assertNoMisses(`by_station.${station}.tropical_${kind} (fetch)`);
      const unit = await mount(
        `by_station.${station}.tropical_${kind}`,
        () => (
          <Era5TropicalChart
            loc={station}
            label={label}
            kind={kind}
            threshold={threshold}
            streak={defaults.tropical_streak}
          />
        ),
        1, // TropicalChart
      );
      const charts = unit.charts.map(extractChart);
      const tr = read(unit);
      tropical[kind] = {
        threshold,
        streak: defaults.tropical_streak,
        year_min: data?.years[0] ?? null,
        year_max: data?.years[data.years.length - 1] ?? null,
        n_years: data?.years.length ?? 0,
        nonzero_count: data?.nonzero_count ?? null,
        counts: data?.counts ?? null,
        trend: data?.trend ?? null,
        rendered: {
          header: tr.txt("[style*='font-size: 14px']"),
          coverage: tr.txt("[style*='font-size: 10px']"),
          paragraphs: tr.all("p"),
        },
        current_year_bar: highlightedBar(charts[0]),
        charts,
      };
    }

    byStation[station] = {
      label,
      season_heatmap: {
        n_rows: heatRows.length,
        rows: seasonRows,
        // SeasonHeatmap.tsx renders no <p> at all — the previous selector here
        // matched nothing and baselined [] for both stations. The four stat
        // tiles (SeasonHeatmap.tsx:204-213) are the numbers this section
        // actually displays, and the legend and decade ticks are its labels.
        rendered: {
          modes: read(heatUnit).all(".shm-btn"),
          stat_values: read(heatUnit).all(".shm-stat-num"),
          stat_labels: read(heatUnit).all(".shm-stat-lbl"),
          legend: read(heatUnit).all(".shm-leg-item"),
          year_ticks: read(heatUnit).all(".shm-tick"),
        },
        charts: heatUnit.charts.map(extractChart),
      },
      year_round_calendar: {
        loc: cal.loc,
        variable: cal.var,
        unit: cal.unit,
        method_label: cal.method_label,
        n_rows: cal.rows.length,
        rows: calRows,
        rendered: {
          title: read(calUnit).txt("[style*='font-size: 15px']"),
          legend: read(calUnit).all("span"),
        },
        charts: calUnit.charts.map(extractChart),
      },
      tropical_days: tropical.days,
      tropical_nights: tropical.nights,
    };
  }

  // ── cases ───────────────────────────────────────────────────────────────────
  const today = todayIso();
  const caseOut: any[] = [];

  for (const c of (cases as any).cases as any[]) {
    const label = `case ${c.id}`;
    const doy = dateToDoy(c.date);
    const month = Number(c.date.split("-")[1]);
    const day = Number(c.date.split("-")[2]);

    const page = await fetchPageData(c.date, c.today_loc);
    assertNoMisses(`${label}.page_data`);
    const status = page.status;
    const last7 = page.last7;

    // The gauge (TodayCard.tsx:141) always mounts when the data card renders;
    // the last-7 strip (TodayCard.tsx:208-217) only when last7 has days — and
    // both sit INSIDE the `available` Show (TodayCard.tsx:135), so an
    // unavailable day draws nothing however much last-7 data came back.
    const expectedCardCharts = !status.available
      ? 0
      : 1 + (last7?.available && (last7.days?.length ?? 0) > 0 ? 1 : 0);

    const cardUnit = await mount(
      `${label}.today_card`,
      () => (
        <TodayCard
          data={status}
          last7={last7}
          meta={era5Meta()}
          date={c.date}
          today={today}
          loading={false}
          onDateChange={() => {}}
          onLocChange={() => {}}
          nationalLoc={ERA5_NATIONAL}
        />
      ),
      expectedCardCharts,
    );

    // Both are gated on todayData()?.available on the page
    // (AliJeVroceERA5.tsx:98 and :116), so on Feb 29 neither mounts.
    let distribution: any = null;
    let trendRendered: any = null;
    let todayChartCopy: any = null;
    if (status.available) {
      const distUnit = await mount(
        `${label}.distribution`,
        () => <DistributionChart data={status} chartId="dist-chart" />,
        1,
      );
      distribution = { charts: distUnit.charts.map(extractChart) };

      // The title, explain and footer the page wraps around that chart as raw
      // JSX (AliJeVroceERA5.tsx:99-112). The footer alone displays four numbers
      // — median cutoff, sample count and both record years — that no component
      // renders and nothing else here captures.
      const copyUnit = await mount(
        `${label}.today_chart_copy`,
        () => <TodayChartCopy data={status} isNat={c.today_loc === ERA5_NATIONAL} />,
        0,
      );
      const cr = read(copyUnit);
      todayChartCopy = {
        _note:
          "Raw JSX in AliJeVroceERA5.tsx:99-112, mirrored by TodayChartCopy in harness.tsx " +
          "and checked against the source by main.mjs assertMirroredCopy.",
        title: cr.txt(".today-chart-title"),
        explain: cr.txt(".today-explain"),
        footer: cr.txt(".today-foot"),
      };

      // loc is the TODAY-card station, not the analysis one (AliJeVroceERA5.tsx:117).
      const trendUnit = await mount(
        `${label}.today_trend`,
        () => <TodayTrendChart date={c.date} loc={c.today_loc} />,
        1,
      );
      const tr = read(trendUnit);
      const charts = trendUnit.charts.map(extractChart);
      trendRendered = {
        title: tr.txt(".today-chart-title"),
        explain: tr.txt(".today-explain"),
        footer: tr.txt(".today-foot"),
        // The current-year plotline: a visible label that used to read the system
        // clock (TodayTrendChart.tsx:41) and now follows the pinned date.
        current_year_plotline: {
          value: charts[0]?.x_axis?.plot_lines?.[0]?.value ?? null,
          label: charts[0]?.x_axis?.plot_lines?.[0]?.label ?? null,
          expected_year: todayYear(),
          matches_pinned_clock:
            charts[0]?.x_axis?.plot_lines?.[0]?.label === String(todayYear()),
        },
        charts,
      };
    }

    const analysisUnit = await mount(
      `${label}.analysis`,
      () => (
        <RegressionPanel meta={era5Meta()} defaultDoy={doy} syncLoc={() => c.analysis_loc}>
          <RegToolbar />
          <RegScatterCard />
        </RegressionPanel>
      ),
      1, // RegressionChart
    );

    const heroUnit = await mount(
      `${label}.hero_cards`,
      () => <HeroCards loc={c.analysis_loc} doy={doy} />,
      0,
    );
    const hr = read(heroUnit);

    caseOut.push({
      id: c.id,
      date: c.date,
      today_loc: c.today_loc,
      analysis_loc: c.analysis_loc,
      analysis_doy: doy,
      purpose: c.purpose,
      ...(c.verified ? { verified: c.verified } : {}),
      today_card: captureTodayCard(cardUnit, status, last7),
      distribution,
      today_chart_copy: todayChartCopy,
      today_trend: {
        api: await captureTrendApi(month, day, c.today_loc),
        rendered: trendRendered,
      },
      analysis: captureAnalysis(analysisUnit),
      hero_cards: {
        rendered: {
          headline: hr.txt("[style*='font-size: 42px']"),
          headline_color: hr.style("[style*='font-size: 42px']", "color"),
          category: hr.txt("[style*='border-radius: 20px']"),
          paragraphs: hr.all("p"),
          stats: hr.all("[style*='font-size: 11px']"),
        },
      },
    });
  }

  return {
    environment: {
      pinned_today: today,
      pinned_year: todayYear(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      number_locale: new Intl.NumberFormat().resolvedOptions().locale,
      date_locale: new Intl.DateTimeFormat().resolvedOptions().locale,
    },
    snapshot: {
      global,
      by_station: byStation,
      cases: caseOut,
      fixture_misses: misses.map((m) => m.url),
    },
  };
}
