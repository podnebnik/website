import { onMount, onCleanup, createEffect } from "solid-js";
import type { RegressionResponse } from "../types.ts";

interface Props {
  data:    RegressionResponse;
  chartId: string;
}

// `Axis.plotLinesAndBands` is a live runtime property that highcharts 12.6 does not
// declare, although it declares both addPlotLine (:187106) and removePlotLine
// (:187269). Describing the one field this file reads keeps the rest of Axis checked,
// rather than casting the axis to `any`.
type AxisWithBands = Highcharts.Axis & { plotLinesAndBands?: Array<{ id?: string }> };

export function RegressionChart(props: Props) {
  let container!: HTMLDivElement;
  let chart: Highcharts.Chart | null = null;

  function buildSeries(results: RegressionResponse["results"]): Highcharts.SeriesOptionsType[] {
    const series: Highcharts.SeriesOptionsType[] = [];
    for (const res of results) {
      const color = res.color ?? "#e07b00";

      // CI band
      const bandData = res.line.x.map((x, i) => [x, res.line.lower[i], res.line.upper[i]] as [number,number,number]);
      series.push({
        type: "arearange",
        name: res.loc + " CI",
        data: bandData,
        color,
        fillOpacity: 0.12,
        lineWidth: 0,
        marker: { enabled: false },
        enableMouseTracking: false,
        showInLegend: false,
        zIndex: 1,
      } as Highcharts.SeriesArearangeOptions);

      // Trend line
      series.push({
        type: "line",
        name: res.loc.replace(/_/g, " "),
        data: res.line.x.map((x, i) => [x, res.line.y[i]] as [number,number]),
        color,
        lineWidth: 2,
        marker: { enabled: false },
        showInLegend: true,
        zIndex: 2,
      } as Highcharts.SeriesLineOptions);

      // Scatter dots
      series.push({
        type: "scatter",
        name: res.loc + " data",
        data: res.scatter.map(pt => ({
          x: pt.x, y: pt.y,
          color: pt.color,
          marker: { fillColor: pt.color },
        })),
        color,
        showInLegend: false,
        zIndex: 3,
        marker: { radius: 4, symbol: "circle" },
      } as Highcharts.SeriesScatterOptions);
    }
    return series;
  }

  onMount(async () => {
    const HC = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");

    const d = props.data;
    chart = HC.chart(container, {
      chart: {
        backgroundColor: "transparent",
        margin: [10, 20, 40, 60],
        animation: false,
      },
      title:         null,
      credits:       { enabled: false },
      exporting:     { enabled: false },
      accessibility: { enabled: false },
      legend: {
        enabled: true,
        itemStyle: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: "600", fontSize: "11px", color: "#1a1a18" },
      },
      tooltip: {
        shared: false,
        formatter(this: Highcharts.TooltipFormatterContextObject) {
          const pt = this.point as any;
          const loc = (this.series.name ?? "").replace(/_/g, " ");
          return `<b>${loc}</b><br/>${this.x}: <b>${(this.y as number).toFixed(2)}</b> ${d.unit}${pt.anomaly != null ? `<br/>anomaly: ${pt.anomaly > 0 ? "+" : ""}${pt.anomaly.toFixed(2)}` : ""}`;
        },
      },
      xAxis: { type: "linear", title: { text: null }, gridLineWidth: 0, tickInterval: 10 },
      yAxis: {
        title: { text: d.ylabel, style: { fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" } },
        gridLineColor: "rgba(0,0,0,0.06)",
      },
      series: buildSeries(d.results),
    } as Highcharts.Options);

    // Baseline plotlines
    if (chart && d.results.length) {
      for (const res of d.results) {
        (chart.yAxis[0] as any).addPlotLine({
          id: `baseline-${res.loc}`,
          value: res.baseline,
          color: res.color ?? "#999",
          width: 1,
          dashStyle: "Dash",
          zIndex: 2,
          label: {
            text:  `${res.stats.n_years}-YR MEAN ${res.baseline.toFixed(1)}`,
            align: "right",
            x:     -4,
            style: { color: res.color ?? "#999", fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" },
          },
        });
      }
    }
  });

  createEffect(() => {
    const d = props.data;
    if (!chart) return;
    // Bind the primary axis once. `chart.yAxis[0]` was read five times, and every
    // read is an unchecked array access; a chart always has one yAxis, but the
    // loop below also needs the same object each time. The `as any` that used to
    // wrap addPlotLine was unnecessary — highcharts.d.ts:187106 declares it.
    let first;
    while ((first = chart.series[0])) first.remove(false);
    for (const s of buildSeries(d.results)) chart.addSeries(s, false);
    const yAxis = chart.yAxis[0] as AxisWithBands | undefined;
    if (!yAxis) return;
    yAxis.setTitle({ text: d.ylabel });
    // .filter() first, as before: removePlotLine mutates plotLinesAndBands, so
    // iterating it live would skip entries.
    const stale = (yAxis.plotLinesAndBands ?? []).filter(pl => pl.id?.startsWith("baseline-"));
    for (const pl of stale) if (pl.id) yAxis.removePlotLine(pl.id);
    for (const res of d.results) {
      yAxis.addPlotLine({
        id: `baseline-${res.loc}`, value: res.baseline, color: res.color ?? "#999",
        width: 1, dashStyle: "Dash", zIndex: 2,
        label: { text: `${res.stats.n_years}-YR MEAN ${res.baseline.toFixed(1)}`,
          align: "right", x: -4, style: { color: res.color ?? "#999", fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" } },
      });
    }
    chart.redraw(false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} style={{ width: "100%", height: "260px" }} />;
}
