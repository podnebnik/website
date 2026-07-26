// T-5.4a — Highcharts accessibility bootstrap.
//
// Loads the accessibility + export-data modules as SIDE-EFFECT imports — the same
// idiom every chart on this page already uses for `highcharts/highcharts-more`
// (e.g. RegressionChart.tsx:71) — and registers one global default so the
// screen-reader "view as data table" affordance stays available without the
// visible export hamburger button ever appearing.
//
// Order matters: export-data @requires modules/exporting, and accessibility must
// register after core. All three are awaited before any chart calls
// Highcharts.chart(), so a chart is never constructed before the modules exist.
//
// Idempotent + memoised: the imports and setOptions run exactly once no matter how
// many chart instances call this. `enableChartA11y` takes the Highcharts instance
// the caller already imported (a singleton) rather than importing core itself, so
// there is no second copy of Highcharts.
//
// SNAPSHOT: the three module paths below are aliased to tests/snapshot/highcharts-stub.ts
// in tests/snapshot/vite.config.mjs. Under the harness these imports are no-op
// side effects and HC.setOptions is the stub's no-op, so nothing here reaches real
// Highcharts — exactly as the existing highcharts-more / modules/map aliases do.

let ready: Promise<void> | null = null;

export function enableChartA11y(HC: any): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await import("highcharts/modules/exporting");
      await import("highcharts/modules/export-data");
      await import("highcharts/modules/accessibility");
      HC.setOptions({
        // exporting.enabled:false keeps the export-data API (chart.viewData /
        // getDataRows) available — so the accessibility module still offers
        // "view as data table" inside its clipped, opacity-0.01 screen-reader
        // region — WITHOUT ever drawing the visible export/context menu button.
        // Verified in a real browser (Highcharts 12.6.0): 0 visible buttons, the
        // view-data-table proxy present in the SR region. Purely additive; no
        // rendered pixel changes (T-5.4a).
        exporting: { enabled: false },
      });
    })();
  }
  return ready;
}
