import { onMount, onCleanup, createEffect } from "solid-js";
import type { TodayStatus } from "../types.ts";
import { enableChartA11y } from "./highcharts-a11y.ts";
import { t, fmtNum, fmtInt } from "../i18n/format.ts";

interface Props {
  data:    TodayStatus;
  chartId: string;
}

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const MONO     = { fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" };

const ZONE_COLORS = [
  "#3a5a8a",   // p0–p10   Cold
  "#6c8fb6",   // p10–p20  Cool
  "#e7d9b8",   // p20–p80  Normal
  "#c25a2c",   // p80–p95  Hot
  "#962c1a",   // p95+     Extreme
];

const ZONE_LABELS = [
  t("dist.zone_cold"), t("dist.zone_cool"), t("dist.zone_normal"),
  t("dist.zone_hot"), t("dist.zone_extreme"),
];

// T-5.21 — tooltip frequency line. Bin width is a fixed 1 °C, NOT the served grid
// spacing: that spacing (≈0.13 °C) is a linspace(200) artefact, and a count per
// 0.13 °C would be a fraction of a day. The served curve is an empirical KDE
// (D-15) smoothed with a Scott-rule bandwidth of ≈0.9 °C, so 1 °C is about the
// finest bin the smoothing can actually resolve.
const BIN_WIDTH = 1;

// Density is sampled at the FIXED bin centre (⌊temp⌋ + 0.5), so the count is
// constant across [b, b+1) and steps at each whole degree. This is deliberate: the
// within-bin curvature of the KDE is kernel shape, not resolvable data, so a count
// that slid smoothly with the cursor would display precision the smoothing already
// removed. Do NOT "fix" this by interpolating at the cursor value.
function densityAt(dist: readonly [number, number][], x: number): number {
  const first = dist[0];
  const last  = dist[dist.length - 1];
  if (!first || !last || x <= first[0] || x >= last[0]) return 0;
  for (let i = 0; i < dist.length - 1; i++) {
    const a = dist[i]!;
    const b = dist[i + 1]!;
    if (a[0] <= x && x <= b[0]) {
      const f = (x - a[0]) / (b[0] - a[0]);
      return a[1] + f * (b[1] - a[1]);
    }
  }
  return 0;
}

function buildOptions(r: TodayStatus): Highcharts.Options {
  const c       = r.cutoffs!;
  const todayX  = r.today_temp!;
  const dist    = r.distribution!;
  const distMin = dist[0]![0];
  const distMax = dist[dist.length - 1]![0];

  // Ensure the x-axis always includes today's temperature even when it is an
  // extreme outlier beyond the historical KDE range (e.g. Kredarica on a heat wave).
  const pad     = (distMax - distMin) * 0.06;
  const axisMin = Math.min(distMin, todayX) - pad;
  const axisMax = Math.max(distMax, todayX) + pad;

  const zoneLabelStyle = {
    color: INK_SOFT, fontSize: "9px", fontWeight: "600",
    ...MONO,
  };

  return {
    chart: {
      type:            "areaspline",
      height:          220,
      margin:          [28, 16, 32, 16],
      backgroundColor: "transparent",
      animation:       false,
      style:           { fontFamily: "Space Grotesk, system-ui, sans-serif" },
    },
    title:   { text: "" },
    credits: { enabled: false },
    legend:  { enabled: false },
    // T-5.4a — screen-reader summary (Slovenian copy awaiting operator review)
    accessibility: {
      enabled: true,
      description: t("dist.a11y"),
    },
    tooltip: {
      formatter(this: any) {
        const temp: number = this.x;
        const zone =
          temp < c.p10 ? t("dist.zone_cold") :
          temp < c.p20 ? t("dist.zone_cool") :
          temp < c.p80 ? t("dist.zone_normal") :
          temp < c.p95 ? t("dist.zone_hot") : t("dist.zone_extreme");
        const line1 = t("dist.tooltip", { temp: fmtNum(temp, 1), zone });

        // T-5.21 — approximate day-count in the hovered whole-degree bin.
        // days ≈ KDE density at the bin centre × bin width × sample size. `n` is
        // the pooled ±7-day day count (per-station) or the sum across the 18
        // stations (national); the national curve is the mean of the per-station
        // densities, so density × Σnᵢ recovers the total station-days near temp.
        const lo   = Math.floor(temp);
        const hi   = lo + 1;
        const n    = r.n_samples ?? 0;
        const days = Math.round(densityAt(dist, lo + 0.5) * BIN_WIDTH * n);
        const line2 = days === 0
          ? t("dist.tooltip_freq_lt1", { lo: fmtInt(lo), hi: fmtInt(hi) })
          : t("dist.tooltip_freq", { count: days, lo: fmtInt(lo), hi: fmtInt(hi) });

        return `${line1}<br>${line2}`;
      },
    },
    xAxis: {
      min:           axisMin,
      max:           axisMax,
      title:         { text: null },
      labels:        { format: "{value}°C", style: { color: INK_SOFT, fontSize: "10px", ...MONO } },
      lineColor:     "rgba(14,14,12,0.1)",
      tickColor:     "rgba(14,14,12,0.1)",
      gridLineWidth: 0,
      crosshair:     { color: "rgba(14,14,12,0.15)", width: 1 },
      plotLines: [{
        value:  todayX,
        color:  INK,
        width:  3,
        zIndex: 5,
        label: {
          text:      t("dist.today_line", { temp: fmtNum(todayX, 1) }),
          rotation:  -90,
          x:         -4,
          y:         40,
          align:     "right",
          style:     { color: INK, fontSize: "11px", fontWeight: "600", ...MONO, textOutline: "3px white" },
        },
      }],
      plotBands: [
        { from: axisMin,  to: c.p10,  color: "transparent",
          label: { text: t("dist.band_below", { p: fmtNum(c.p10, 1) }),                        align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p10,   to: c.p20,  color: "transparent",
          label: { text: t("dist.band_range", { a: fmtNum(c.p10, 1), b: fmtNum(c.p20, 1) }),      align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p20,   to: c.p80,  color: "transparent",
          label: { text: t("dist.band_range", { a: fmtNum(c.p20, 1), b: fmtNum(c.p80, 1) }),      align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p80,   to: c.p95,  color: "transparent",
          label: { text: t("dist.band_range", { a: fmtNum(c.p80, 1), b: fmtNum(c.p95, 1) }),      align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p95,   to: axisMax, color: "transparent",
          label: { text: t("dist.band_above", { p: fmtNum(c.p95, 1) }),                        align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
      ],
    },
    yAxis: {
      title:         { text: undefined },
      labels:        { enabled: false },
      gridLineWidth: 0,
      lineWidth:     0,
      tickWidth:     0,
    },
    plotOptions: {
      areaspline: {
        marker:      { enabled: false },
        lineWidth:   0,
        fillOpacity: 1,
        zoneAxis:    "x",
        zones: [
          { value: c.p10, color: "transparent", fillColor: ZONE_COLORS[0] },
          { value: c.p20, color: "transparent", fillColor: ZONE_COLORS[1] },
          { value: c.p80, color: "transparent", fillColor: ZONE_COLORS[2] },
          { value: c.p95, color: "transparent", fillColor: ZONE_COLORS[3] },
          {               color: "transparent", fillColor: ZONE_COLORS[4] },
        ],
      },
    },
    series: [{ type: "areaspline", name: "Density", data: dist }],
  } as Highcharts.Options;
}

export function DistributionChart(props: Props) {
  let container!: HTMLDivElement;
  let chart: any = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await enableChartA11y(Highcharts);
    const r = props.data;
    if (!r.available || !r.distribution?.length || !r.cutoffs) return;
    chart = Highcharts.chart(container, buildOptions(r));
  });

  createEffect(() => {
    const r = props.data;
    if (!chart || !r.available || !r.distribution?.length || !r.cutoffs) return;
    const opts = buildOptions(r);
    const xOpts = opts.xAxis as Highcharts.XAxisOptions;
    chart.series[0]?.setData(r.distribution, false, false, false);
    chart.xAxis[0]?.update({
      min: xOpts.min,
      max: xOpts.max,
      plotLines: xOpts.plotLines,
      plotBands: xOpts.plotBands,
    }, false);
    chart.update({ plotOptions: opts.plotOptions }, false);
    chart.redraw(false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return (
    <>
      <div id={props.chartId} ref={container} style={{ "min-height": "200px" }} />
      <div class="today-chart-legend">
        {ZONE_COLORS.map((bg, i) => (
          <span class="tcl-item">
            <span class="tcl-sw" style={{ background: bg }} />
            {ZONE_LABELS[i]}
          </span>
        ))}
      </div>
    </>
  );
}
