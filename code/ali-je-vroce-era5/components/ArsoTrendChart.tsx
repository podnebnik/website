import { createResource, Show, onMount, onCleanup, createEffect } from "solid-js";
import { fetchArsoTrend, isArsoLoc } from "../api.ts";
import type { ArsoTrend } from "../api.ts";

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const COL      = "#962c1a";
const MONO     = { fontFamily: "'JetBrains Mono', monospace", fontSize: "9px" };

function ArsoTrendHighchart(props: { trend: ArsoTrend }) {
  let container!: HTMLDivElement;
  let chart: any = null;

  function buildSeries(d: ArsoTrend) {
    return {
      scatter:   d.scatter.map(p => ({ x: p.x, y: p.y })),
      trendLine: d.trendLine,
    };
  }

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    const d = props.trend;
    const { scatter, trendLine } = buildSeries(d);
    const currentYear = new Date().getFullYear();

    chart = Highcharts.chart(container, {
      chart: {
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
          if (this.series.name === "Annual value") return `<b>${this.x}</b>: ${this.y.toFixed(1)} °C`;
          return false;
        },
      },
      xAxis: {
        title:         { text: null },
        labels:        { style: { color: INK_SOFT, ...MONO } },
        lineColor:     "rgba(14,14,12,0.1)",
        tickColor:     "rgba(14,14,12,0.1)",
        gridLineWidth: 0,
        plotLines: [{
          value:     currentYear,
          color:     INK,
          width:     1,
          dashStyle: "Dot" as any,
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
        {
          name: "Annual value", type: "scatter" as any,
          data: scatter,
          color: "rgba(150,44,26,0.55)",
          marker: { enabled: true, radius: 3, symbol: "circle" },
          zIndex: 4,
        },
        {
          name: "Trend", type: "line" as any,
          data: trendLine,
          color: COL, lineWidth: 1.5,
          enableMouseTracking: false, marker: { enabled: false },
          zIndex: 6,
        },
      ],
    } as Highcharts.Options);
  });

  createEffect(() => {
    const d = props.trend;
    if (!chart) return;
    const { scatter, trendLine } = buildSeries(d);
    chart.series[0]?.setData(scatter,   false, false, false);
    chart.series[1]?.setData(trendLine, false, false, false);
    chart.redraw(false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}

interface Props {
  date:   string;
  loc:    string | null;
  label?: string;
}

export function ArsoTrendChart(props: Props) {
  const stationId = () => {
    const l = props.loc ?? "";
    return isArsoLoc(l) ? Number(l.replace("arso:", "")) : null;
  };

  const month = () => Number(props.date.split("-")[1]);
  const day   = () => Number(props.date.split("-")[2]);

  const [trend] = createResource(
    () => {
      const id = stationId();
      return id != null ? { stationId: id, month: month(), day: day() } : null;
    },
    ({ stationId, month, day }) => fetchArsoTrend(stationId, month, day),
  );

  const trendDisplay = () => trend() ?? trend.latest;

  return (
    <div class="today-chart">
      <Show when={trendDisplay()}>
        {(t) => {
          const d = () => t();
          const sign = () => d().trend10 >= 0 ? "+" : "";
          return (
            <>
              <div class="today-chart-title">
                Najvišje temperature ARSO {props.label ? `na postaji ${props.label}` : ""} okoli {d().dayLabel} · {d().yearMin}–{d().yearMax} · linearna regresija
              </div>
              <ArsoTrendHighchart trend={d()} />
              <p class="today-explain" style={{ padding: "4px 0 2px" }}>
                Vsaka pika je povprečna dnevna najvišja temperatura v ±7-dnevnem oknu okoli tega datuma za vsako leto meritev ARSO. Trend linearne regresije znaša {sign()}{d().trend10.toFixed(2)} °C/desetletje.
              </p>
              <div class="today-foot">
                Linearna regresija OLS · {sign()}{d().trend10.toFixed(2)} °C/desetletje · {d().nYears} let
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
