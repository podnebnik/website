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

import { t } from "../i18n/format.ts";

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
        // T-5.16 — Slovenian screen-reader strings (D-8). Two groups:
        //
        //  • Top-level `lang.*` (viewData/…): the export CONTEXT-MENU labels. With
        //    `exporting.enabled:false` above, the menu is never drawn, so these do
        //    not surface today — translated and kept only in case the menu is ever
        //    enabled. See the note in i18n/sl.ts.
        //  • `lang.accessibility.*`: the strings the a11y info region ACTUALLY
        //    announces (built regardless of the export menu, InfoRegionsComponent).
        //    Highcharts deep-merges this partial tree over its defaults, so anything
        //    omitted below keeps the English default on purpose (see next comment).
        lang: {
          viewData:    t("hc.viewData"),
          hideData:    t("hc.hideData"),
          downloadCSV: t("hc.downloadCSV"),
          downloadXLS: t("hc.downloadXLS"),
          accessibility: {
            defaultChartTitle:   t("hc.a11y.defaultChartTitle"),
            chartContainerLabel: t("hc.a11y.chartContainerLabel"),
            svgContainerLabel:   t("hc.a11y.svgContainerLabel"),
            table: {
              viewAsDataTableButtonText: t("hc.a11y.viewAsDataTableButtonText"),
              tableSummary:              t("hc.a11y.tableSummary"),
            },
            screenReaderSection: {
              endOfChartMarker: t("hc.a11y.endOfChartMarker"),
            },
            series: {
              nullPointValue: t("hc.a11y.nullPointValue"),
            },
            axis: {
              defaultAxisNames: {
                categories: t("hc.a11y.axisCategories"),
                time:       t("hc.a11y.axisTime"),
                values:     t("hc.a11y.axisValues"),
              },
            },
            // DELIBERATELY LEFT TO THE ENGLISH DEFAULTS (T-5.16, scope = Tier 1 only):
            // the chart-type descriptions (lang.accessibility.chartTypes.*), axis-range
            // descriptions (axis.xAxisDescription*, rangeFromTo, timeRange*, …) and
            // series summaries (series.summary.*). These are count-templated with
            // Highcharts' own binary singular/plural (`{#eq n 1}point{else}points{/eq}`),
            // evaluated inside Highcharts at render — NOT through our t()/Intl.PluralRules.
            // Slovenian has FOUR grammatical numbers (1 / 2 / 3–4 / 5+); a binary form is
            // grammatically wrong for most counts, on a surface where the listener cannot
            // see the number to reconstruct the meaning. A correct translation is not
            // expressible through this mechanism, so English (grammatical, familiar) is
            // the lesser harm. This is a DECISION, not an oversight — do not "finish the
            // job" and ship the ungrammatical binary-plural version. If Highcharts ever
            // gains a proper plural-rule mechanism, this is where to revisit it.
          },
        },
      });
    })();
  }
  return ready;
}
