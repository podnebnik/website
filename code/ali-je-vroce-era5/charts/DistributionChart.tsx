import { onMount, onCleanup, createEffect } from "solid-js";
import type { TodayStatus } from "../types.ts";
import { enableChartA11y } from "./highcharts-a11y.ts";
import { t, fmtNum } from "../i18n/format.ts";
import { assertFrequencySane, distributionTooltipHtml } from "./distribution-frequency.ts";

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

// `getData` returns the CURRENT chart data. The chart is built once (onMount) but its
// data changes on every location/date switch via createEffect; the tooltip formatter
// closes over `getData`, not over the mount-time `r`, so it can never render a stale
// location's zone/count (T-5.22 B — a defect that predated T-5.21). The static chart
// geometry below still uses the snapshot `r`, because createEffect re-applies it.
function buildOptions(r: TodayStatus, getData: () => TodayStatus): Highcharts.Options {
  const c       = r.cutoffs!;
  const todayX  = r.today_temp!;
  const dist    = r.distribution!;
  const distMin = dist[0]![0];
  const distMax = dist[dist.length - 1]![0];

  // Guard the CURRENT data every time the chart is (re)built — mount and each
  // createEffect data change. On the national view `n_samples` is the SUM over the
  // pooled stations, so the per-station basis divides by their count (T-5.22).
  const nSamples     = r.n_samples ?? 0;
  const stationCount = r.station_count ?? 1;
  const perStationN  = stationCount > 0 ? nSamples / stationCount : nSamples;
  assertFrequencySane(dist, perStationN, nSamples, stationCount);

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
      // Reads the CURRENT data (getData()) at hover time — the whole tooltip (zone +
      // day-count) is derived from it, so it always matches the location on screen even
      // though the chart was built once at mount (T-5.22 B). See distributionTooltipHtml.
      formatter(this: any) {
        return distributionTooltipHtml(getData(), this.x as number);
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
    // The tooltip formatter reads `() => props.data` live, so it survives later data
    // changes (createEffect refreshes only the geometry, not the formatter). T-5.22 B.
    chart = Highcharts.chart(container, buildOptions(r, () => props.data));
  });

  createEffect(() => {
    const r = props.data;
    if (!chart || !r.available || !r.distribution?.length || !r.cutoffs) return;
    const opts = buildOptions(r, () => props.data);
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
