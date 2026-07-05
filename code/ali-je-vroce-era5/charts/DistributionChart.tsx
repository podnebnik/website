import { onMount, onCleanup, createEffect } from "solid-js";
import type { TodayStatus } from "../types.ts";

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

const ZONE_LABELS = ["Hladno", "Sveže", "Normalno", "Vroče", "Ekstremno"];

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
    title:   { text: undefined },
    credits: { enabled: false },
    legend:  { enabled: false },
    tooltip: {
      formatter(this: any) {
        const temp: number = this.x;
        let zone: string;
        if      (temp < c.p10) zone = "Hladno";
        else if (temp < c.p20) zone = "Sveže";
        else if (temp < c.p80) zone = "Normalno";
        else if (temp < c.p95) zone = "Vroče";
        else                   zone = "Ekstremno";
        return `${temp.toFixed(1)} °C · ${zone}`;
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
          text:      `DANES: ${todayX.toFixed(1)} °C`,
          rotation:  -90,
          x:         -4,
          y:         40,
          align:     "right",
          style:     { color: INK, fontSize: "11px", fontWeight: "600", ...MONO, textOutline: "3px white" },
        },
      }],
      plotBands: [
        { from: axisMin,  to: c.p10,  color: "transparent",
          label: { text: `< ${c.p10.toFixed(1)}°C`,                        align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p10,   to: c.p20,  color: "transparent",
          label: { text: `${c.p10.toFixed(1)}–${c.p20.toFixed(1)}°C`,      align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p20,   to: c.p80,  color: "transparent",
          label: { text: `${c.p20.toFixed(1)}–${c.p80.toFixed(1)}°C`,      align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p80,   to: c.p95,  color: "transparent",
          label: { text: `${c.p80.toFixed(1)}–${c.p95.toFixed(1)}°C`,      align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
        { from: c.p95,   to: axisMax, color: "transparent",
          label: { text: `> ${c.p95.toFixed(1)}°C`,                        align: "center", verticalAlign: "top", y: 18, style: zoneLabelStyle } },
      ],
    },
    yAxis: {
      title:         { text: null },
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
