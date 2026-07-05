import { onMount, onCleanup } from "solid-js";
import type { AnnualTrend } from "../types.ts";

interface Props {
  data:    AnnualTrend;
  chartId: string;
}

export function AnnualTrendChart(props: Props) {
  let container!: HTMLDivElement;
  let chart: Highcharts.Chart | null = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");
    const d = props.data;

    const sigLabel =
      d.pVal < 0.001 ? "p < 0.001 ★★★"
      : d.pVal < 0.01 ? "p < 0.01 ★★"
      : d.pVal < 0.05 ? "p < 0.05 ★"
      : "p ≥ 0.05";

    chart = Highcharts.chart(container, {
      chart: {
        type:        "scatter",
        animation:   false,
        backgroundColor: "transparent",
        style:       { fontFamily: "Space Grotesk, system-ui, sans-serif" },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        title: { text: undefined },
        gridLineWidth: 1,
        gridLineColor: "rgba(0,0,0,0.06)",
      },
      yAxis: {
        title: { text: "°C", style: { fontSize: "11px" } },
        gridLineColor: "rgba(0,0,0,0.06)",
      },
      tooltip: {
        formatter(this: Highcharts.Point) {
          if (typeof this.x === "number" && typeof this.y === "number") {
            return `<b>${Math.round(this.x)}</b>: ${this.y.toFixed(2)} °C`;
          }
          return "";
        },
      },
      series: [
        // CI band
        {
          type:      "arearange",
          name:      "95% CI",
          data:      d.histLine.x.map((x, i) => [x, d.histLine.lower[i]!, d.histLine.upper[i]!]),
          color:     "#c25a2c",
          fillOpacity: 0.10,
          lineWidth:  0,
          marker:    { enabled: false },
          enableMouseTracking: false,
        },
        // Projection CI band
        {
          type:      "arearange",
          name:      "Proj CI",
          data:      d.projLine.x.map((x, i) => [x, d.projLine.lower[i]!, d.projLine.upper[i]!]),
          color:     "#c25a2c",
          fillOpacity: 0.06,
          lineWidth:  0,
          dashStyle: "Dash" as Highcharts.DashStyleValue,
          marker:    { enabled: false },
          enableMouseTracking: false,
        },
        // Historical trend line
        {
          type:      "line",
          name:      "Trend",
          data:      d.histLine.x.map((x, i) => [x, d.histLine.y[i]!]),
          color:     "#c25a2c",
          lineWidth: 2,
          marker:    { enabled: false },
          enableMouseTracking: false,
        },
        // Projection line
        {
          type:      "line",
          name:      "Projekcija",
          data:      d.projLine.x.map((x, i) => [x, d.projLine.y[i]!]),
          color:     "#c25a2c",
          lineWidth: 1.5,
          dashStyle: "Dash" as Highcharts.DashStyleValue,
          marker:    { enabled: false },
          enableMouseTracking: false,
        },
        // Scatter dots
        {
          type:   "scatter",
          name:   "Letni P90",
          data:   d.scatter.map((p) => ({ x: p.x, y: p.y })),
          color:  "rgba(194,90,44,0.55)",
          marker: { radius: 3, symbol: "circle" },
        },
      ],
      responsive: {
        rules: [{
          condition: { maxWidth: 500 },
          chartOptions: { yAxis: [{ title: { text: undefined } }] },
        }],
      },
    } as Highcharts.Options);

    // Sub-title with stats
    const sub = container.closest(".annual-trend-card")?.querySelector(".annual-trend-stats");
    if (sub) {
      sub.textContent = `${d.trend10 > 0 ? "+" : ""}${d.trend10.toFixed(3)} °C/desetletje · ${sigLabel} · τ = ${d.tau.toFixed(3)} · ${d.nYears} let`;
    }
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div id={props.chartId} ref={container} style={{ "min-height": "260px" }} />;
}
