// T-5.15 — the single prefers-reduced-motion read for the JS-driven animations that
// CSS media queries cannot reach: Highcharts option objects and the TodayFlag SMIL.
// CSS-driven motion is handled by the `@media (prefers-reduced-motion: reduce)` block
// in styles/era5.css; this module exists only for what CSS cannot see.
//
// GUARDED, failing toward NO PREFERENCE. jsdom (the snapshot harness) and the node
// unit-test env expose no `window.matchMedia`, so an unguarded read throws. `matches:
// false` on absence keeps the default (animated) branch, which is exactly why adding
// these reads moves no snapshot leaf — the harness never takes the reduce branch.
//
// BUILD-TIME READ, not reactive. Callers read this when a chart is built. A reader who
// toggles the OS setting mid-session sees the CSS respond instantly, but a chart only
// picks it up on its next rebuild (the next date or station change). Deliberate — a
// live matchMedia listener rebuilding every chart is cost the rare case does not
// justify (T-5.15 decision (b)).
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Suppress a Highcharts chart's motion when the reader asks for it. Returns the options
// UNCHANGED (same reference) under no preference, so the emitted option object is
// byte-identical and no snapshot leaf moves. Under `reduce` it disables BOTH the redraw
// animation (`chart.animation`) AND the initial series reveal
// (`plotOptions.series.animation`) — the latter is the ~1 s draw-in that `chart.animation`
// alone never governed (T-5.15 finding A4: chart.animation is redraw-only; the initial
// reveal reads series.options.animation, whose Highcharts default is { duration: 1000 }).
export function reduceChartMotion(opts: Highcharts.Options): Highcharts.Options {
  if (!prefersReducedMotion()) return opts;
  return {
    ...opts,
    chart: { ...(opts.chart ?? {}), animation: false },
    plotOptions: {
      ...(opts.plotOptions ?? {}),
      series: { ...(opts.plotOptions?.series ?? {}), animation: false },
    },
  };
}
