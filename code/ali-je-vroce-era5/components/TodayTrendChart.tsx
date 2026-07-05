import { createResource, Show, onMount, onCleanup, createEffect } from "solid-js";
import { fetchAnnualTrend } from "../api.ts";
import type { AnnualTrend } from "../types.ts";

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const COL      = "#962c1a";
const MONO     = { fontFamily: "'JetBrains Mono', monospace", fontSize: "9px" };

interface ChartProps {
  trend: AnnualTrend;
}

function buildTrendSeries(d: AnnualTrend) {
  const histLine = d.histLine.x.map((x, i) => [x, d.histLine.y[i]]);
  const histBand = d.histLine.x.map((x, i) => [x, d.histLine.lower[i], d.histLine.upper[i]]);
  const fcLine   = d.projLine.x.map((x, i) => [x, d.projLine.y[i]]);
  const fcBand   = d.projLine.x.map((x, i) => [x, d.projLine.lower[i], d.projLine.upper[i]]);
  const milestoneYears = [2030, 2040, 2050];
  const fcMilestones = milestoneYears.map((yr) => {
    let best = 0, bestDiff = Infinity;
    d.projLine.x.forEach((x, i) => { const diff = Math.abs(x - yr); if (diff < bestDiff) { bestDiff = diff; best = i; } });
    return { x: yr, y: +d.projLine.y[best].toFixed(1) };
  });
  return { histLine, histBand, fcLine, fcBand, fcMilestones };
}

function TrendHighchart(props: ChartProps) {
  let container!: HTMLDivElement;
  let chart: any = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");

    const d = props.trend;
    const currentYear = new Date().getFullYear();
    const { histLine, histBand, fcLine, fcBand, fcMilestones } = buildTrendSeries(d);

    chart = Highcharts.chart(container, {
      chart: {
        type:            "line",
        height:          240,
        margin:          [16, 16, 40, 54],
        backgroundColor: "transparent",
        animation:       false,
      },
      title:   { text: null },
      credits: { enabled: false },
      legend:  { enabled: false },
      tooltip: {
        formatter(this: any) {
          if (this.series.name === "Annual value") return `<b>${Math.round(this.x)}</b>: ${this.y.toFixed(1)} °C`;
          if (this.series.name === "Milestones")   return `<b>${this.x}</b>: ${this.y.toFixed(1)} °C <em>(projection)</em>`;
          return false;
        },
      },
      xAxis: {
        title:     { text: null },
        labels:    { style: { color: INK_SOFT, ...MONO } },
        lineColor: "rgba(14,14,12,0.1)",
        tickColor: "rgba(14,14,12,0.1)",
        gridLineWidth: 0,
        plotLines: [{
          value:     currentYear,
          color:     INK,
          width:     1,
          dashStyle: "Dot",
          zIndex:    5,
          label: {
            text:     String(currentYear),
            rotation: 0,
            align:    "center",
            y:        -4,
            style:    { color: INK, ...MONO, fontWeight: "600" },
          },
        }],
      },
      yAxis: {
        title:         { text: null },
        labels:        { format: "{value}°C", style: { color: INK_SOFT, ...MONO } },
        gridLineColor: "rgba(14,14,12,0.06)",
      },
      series: [
        { name: "CI hist",       type: "arearange", data: histBand,
          fillOpacity: 0.09, lineWidth: 0, color: COL, enableMouseTracking: false, marker: { enabled: false }, zIndex: 2 },
        { name: "CI projection", type: "arearange", data: fcBand,
          fillOpacity: 0.05, lineWidth: 0, color: COL, enableMouseTracking: false, marker: { enabled: false }, zIndex: 2 },
        { name: "Annual value",  type: "scatter",   data: (d.scatter as Array<{ x: number; y: number }>),
          color: "rgba(150,44,26,0.55)", marker: { enabled: true, radius: 3, symbol: "circle" }, zIndex: 4 },
        { name: "NB trend",   type: "line", data: histLine,
          color: COL, lineWidth: 1.5, enableMouseTracking: false, marker: { enabled: false }, zIndex: 6 },
        { name: "Projection", type: "line", data: fcLine,
          color: COL, lineWidth: 1.5, dashStyle: "Dash",
          enableMouseTracking: false, marker: { enabled: false }, zIndex: 6 },
        { name: "Milestones", type: "scatter", data: fcMilestones,
          marker: { enabled: true, radius: 3.5, symbol: "circle",
                    fillColor: "#F5F2EC", lineColor: COL, lineWidth: 1.5 },
          zIndex: 7 },
      ],
    } as Highcharts.Options);
  });

  createEffect(() => {
    const d = props.trend;
    if (!chart) return;
    const { histLine, histBand, fcLine, fcBand, fcMilestones } = buildTrendSeries(d);
    chart.series[0]?.setData(histBand,     false, false, false);
    chart.series[1]?.setData(fcBand,       false, false, false);
    chart.series[2]?.setData(d.scatter,    false, false, false);
    chart.series[3]?.setData(histLine,     false, false, false);
    chart.series[4]?.setData(fcLine,       false, false, false);
    chart.series[5]?.setData(fcMilestones, false, false, false);
    chart.redraw(false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}

interface Props {
  date: string;
  loc:  string | null;
}

export function TodayTrendChart(props: Props) {
  const month = () => Number(props.date.split("-")[1]);
  const day   = () => Number(props.date.split("-")[2]);

  const [trend] = createResource(
    () => ({ month: month(), day: day(), loc: props.loc }),
    ({ month, day, loc }) => fetchAnnualTrend(month, day, loc),
  );

  // Keep previous data visible while refetching so the chart stays mounted
  const trendDisplay = () => trend() ?? trend.latest;

  return (
    <div class="today-chart">
      <Show when={trendDisplay()}>
        {(t) => {
          const d = () => t();
          const sign     = () => d().trend10 >= 0 ? "+" : "";
          const sig      = () => { const p = d().pVal; return p < 0.001 ? "p < 0.001" : p < 0.01 ? "p < 0.01" : p < 0.05 ? `p = ${p}` : `p = ${p} (ns)`; };
          const proj2050 = () => d().projLine.y[d().projLine.y.length - 1].toFixed(1);
          const trendStr = () => `${sign()}${d().trend10.toFixed(2)}`;
          return (
            <>
              <div class="today-chart-title">
                Najvišje temperature {props.loc ? `na postaji ${props.loc.replace(/_/g, " ")}` : "v Sloveniji"} okoli {d().dayLabel} · {d().yearMin}–{d().yearMax} · trend s projekcijo do 2050
              </div>
              <TrendHighchart trend={d()} />
              <p class="today-explain" style={{ padding: "4px 0 2px" }}>
                Vsaka pika je 90. percentil {props.loc ? `lapsno popravljene dnevne najvišje temperature na postaji ${props.loc.replace(/_/g, " ")}` : "nacionalne povprečne dnevne najvišje temperature vseh postaj"} v ±30-dnevnem oknu okoli tega datuma za vsako leto od {d().yearMin}. Trend Theil-Sen je {trendStr()} °C/desetletje ({sig()}). Po tem tempu projekcija kaže {proj2050()} °C do leta 2050. Zasenčeni pas je 95% interval zaupanja za nagib.
              </p>
              <div class="today-foot">
                Theil-Sen + TFPW MK: {trendStr()} °C/desetletje · {sig()} · τ = {d().tau.toFixed(3)} · 95% CI · {d().nYears} let
              </div>
            </>
          );
        }}
      </Show>
      <Show when={trend.loading && !trendDisplay()}>
        <div style={{ height: "240px" }} class="animate-pulse bg-[var(--color-paper-2)] rounded" />
      </Show>
    </div>
  );
}
