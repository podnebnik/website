// T-1.1 — Highcharts recording stub.
//
// Aliased over `highcharts`, `highcharts/highcharts-more` and
// `highcharts/modules/map` for the snapshot build only (tests/snapshot/vite.config.mjs).
// Nothing in code/ali-je-vroce-era5 knows this exists, and the production build
// never sees it.
//
// ── Why a stub and not real Highcharts ────────────────────────────────────────
//
// The ticket asks for VALUES, NOT MARKUP. The numbers a chart displays are the
// ones handed to Highcharts — series data, plot lines, plot bands, axis extremes.
// Rendering them to SVG and scraping them back would add a lossy round-trip
// through a layout engine that drops labels at small viewports; that is exactly
// the failure the T-1.2 session hit when the browser pane reported
// innerWidth === 0 and Highcharts silently omitted the plotline label it was
// trying to verify. Recording the options object captures the same numbers
// losslessly and makes the harness independent of Highcharts' rendering.
//
// The two values the T-1.2 review specifically requires are reachable ONLY this
// way, because both are computed inside onMount and never leave the chart config:
//
//   * TodayTrendChart.tsx:68-81  — xAxis.plotLines[0].{value,label.text}, the
//     current-year marker. Was `new Date().getFullYear()`.
//   * TropicalChart.tsx:104-107  — the one bar carrying an explicit `color` and
//     `opacity`, i.e. the current year. Also was `new Date().getFullYear()`.
//
// ── Fidelity ──────────────────────────────────────────────────────────────────
//
// Post-construction mutations are applied for real, not swallowed, because
// several charts only reach their displayed state afterwards:
//
//   TodayGauge.tsx:81            setData — the needle position IS the value
//   DistributionChart.tsx:143-150 setData + chart.update — the zone thresholds
//   RegressionChart.tsx:101,129  addPlotLine — the baseline temperature
//   YearRoundChart.tsx:137-138   remove/addPlotLine — the selected day marker
//   TropicalChart.tsx:225-228    remove-all + addSeries — the whole series set
//
// The surface implemented here is exactly the surface the island touches (grep
// for `chart\.` over code/ali-je-vroce-era5). Anything else throws rather than
// no-ops: a stub that quietly swallows an unknown call is a stub that lies about
// what the page did.

export interface RecordedAxis {
  title: string | null;
  min: number | null;
  max: number | null;
  categories: any;
  plotLines: any[];
  plotBands: any[];
}

export interface RecordedChart {
  /** Order of the Highcharts.chart()/mapChart() call within the current unit. */
  seq: number;
  kind: "chart" | "mapChart";
  options: any;
  /** Live axis state, including post-construction plotline edits. */
  axes: { x: RecordedAxis; y: RecordedAxis };
  /**
   * The chart's LIVE series list, not the construction-time `options.series`.
   * TropicalChart.tsx:225-226 removes every series and re-adds them on the first
   * effect run, so reading the options array would snapshot a set the chart no
   * longer holds.
   */
  seriesRef: any[];
  /** Mutations applied after construction, in order. */
  mutations: Array<{ op: string; target: string }>;
}

let log: RecordedChart[] = [];
let seq = 0;

export function resetChartLog(): void {
  log = [];
  seq = 0;
}

export function chartLog(): RecordedChart[] {
  return log;
}

function firstAxis(a: any): any {
  return Array.isArray(a) ? (a[0] ?? {}) : (a ?? {});
}

function toAxis(raw: any): RecordedAxis {
  const a = firstAxis(raw);
  return {
    title: a.title?.text ?? null,
    min: a.min ?? null,
    max: a.max ?? null,
    categories: a.categories ?? null,
    plotLines: [...(a.plotLines ?? [])],
    plotBands: [...(a.plotBands ?? [])],
  };
}

function makeChart(kind: "chart" | "mapChart", options: any): any {
  const record: RecordedChart = {
    seq: seq++,
    kind,
    options,
    axes: { x: toAxis(options?.xAxis), y: toAxis(options?.yAxis) },
    seriesRef: [],
    mutations: [],
  };
  log.push(record);

  const note = (op: string, target = "") => record.mutations.push({ op, target });

  const makeAxisApi = (which: "x" | "y") => {
    const state = record.axes[which];
    const name = `${which}Axis[0]`;
    return {
      get plotLinesAndBands() {
        // RegressionChart.tsx:125 reads this to find its own lines by id.
        return state.plotLines;
      },
      addPlotLine(pl: any) {
        state.plotLines.push(pl);
        note("addPlotLine", `${name} ${pl?.id ?? pl?.value ?? ""}`);
      },
      removePlotLine(id: string) {
        const at = state.plotLines.findIndex((p) => p?.id === id);
        if (at >= 0) state.plotLines.splice(at, 1);
        note("removePlotLine", `${name} ${id}`);
      },
      update(patch: any) {
        if (patch && "plotLines" in patch) state.plotLines = [...(patch.plotLines ?? [])];
        if (patch && "plotBands" in patch) state.plotBands = [...(patch.plotBands ?? [])];
        if (patch && "min" in patch) state.min = patch.min ?? null;
        if (patch && "max" in patch) state.max = patch.max ?? null;
        if (patch && "categories" in patch) state.categories = patch.categories ?? null;
        note("axis.update", name);
      },
      setTitle(t: any) {
        state.title = t?.text ?? null;
        note("setTitle", name);
      },
      setExtremes(min: number, max: number) {
        state.min = min ?? null;
        state.max = max ?? null;
        note("setExtremes", name);
      },
    };
  };

  const chart: any = {
    options,
    series: [],
    xAxis: [makeAxisApi("x")],
    yAxis: [makeAxisApi("y")],
    addSeries(s: any) {
      chart.series.push(mkSeries(s));
      note("addSeries", s?.name ?? s?.type ?? "");
    },
    redraw() {
      note("redraw");
    },
    update(patch: any) {
      Object.assign(options, patch);
      note("chart.update");
    },
    setSize() {},
    reflow() {},
    destroy() {},
  };

  function mkSeries(s: any) {
    // `w` is captured by identity so remove() stays correct as the array is
    // spliced — TropicalChart.tsx:225 and RegressionChart.tsx:122 both do
    // `while (chart.series.length) chart.series[0].remove(false)`, and index-based
    // removal would go out of sync after the first splice and loop forever.
    const w: any = {
      get name() {
        return s?.name;
      },
      get type() {
        return s?.type;
      },
      get data() {
        return s?.data;
      },
      options: s,
      setData(data: any) {
        s.data = data;
        note("setData", `${s?.name ?? s?.type ?? ""}`);
      },
      remove() {
        const at = chart.series.indexOf(w);
        if (at >= 0) chart.series.splice(at, 1);
        note("remove", `${s?.name ?? s?.type ?? ""}`);
      },
      update(patch: any) {
        Object.assign(s, patch);
        note("series.update", `${s?.name ?? s?.type ?? ""}`);
      },
      setVisible() {},
    };
    return w;
  }

  chart.series = (options?.series ?? []).map(mkSeries);
  record.seriesRef = chart.series;
  return chart;
}

const Highcharts = {
  chart: (_container: any, options: any) => makeChart("chart", options),
  mapChart: (_container: any, options: any) => makeChart("mapChart", options),
  // StationMap.tsx:41-44 calls the map module's export only when it is callable.
  // This module's default export is an object, so map-module init is skipped —
  // deliberately, since mapChart above needs no registration.
  maps: {},
  setOptions: () => {},
  getOptions: () => ({}),
  seriesTypes: {},
  wrap: () => {},
  addEvent: () => () => {},
  merge: (...objs: any[]) => Object.assign({}, ...objs),
};

export default Highcharts;
