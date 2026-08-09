import { createResource, Show, ErrorBoundary, onMount, onCleanup, createEffect } from "solid-js";
import { fetchAnnualTrend, ERA5_NATIONAL } from "../api.ts";
import { todayYear } from "../clock.ts";
import { sectionErrorFallback } from "./SectionError.tsx";
import { enableChartA11y } from "../charts/highcharts-a11y.ts";
import { reduceChartMotion } from "../reduced-motion.ts";
import { t, fmtNum, fmtSigned, fmtMonthDay } from "../i18n/format.ts";
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
  // projLine is the straight fitted projection stored as two endpoints
  // (year_max → proj_end_year). Place each milestone dot ON that line by linear
  // interpolation between the endpoints — equivalently y = slope·year + intercept.
  // The old code snapped each milestone to the NEARER of the two endpoints and
  // reused that endpoint's y, so 2030 rendered year_max's value and 2040 rendered
  // 2050's — two of the three dots landed off the line (T-4.23).
  const [x0, x1] = d.projLine.x;
  const [y0, y1] = d.projLine.y;
  if (x0 === undefined || x1 === undefined || y0 === undefined || y1 === undefined || x1 === x0)
    throw new Error("projLine needs two distinct endpoints to place milestones");
  const fcMilestones = milestoneYears.map((yr) => {
    const y = y0 + ((yr - x0) * (y1 - y0)) / (x1 - x0);
    return { x: yr, y: +y.toFixed(1) };
  });
  return { histLine, histBand, fcLine, fcBand, fcMilestones };
}

function TrendHighchart(props: ChartProps) {
  let container!: HTMLDivElement;
  let chart: any = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");
    await enableChartA11y(Highcharts);

    const d = props.trend;
    // Rendered as a visible plotline label below, on a component that mounts on
    // every page load — so it has to follow the injected date, not the system
    // clock, or the T-1.1 snapshot rolls over on 1 January.
    const currentYear = todayYear();
    const { histLine, histBand, fcLine, fcBand, fcMilestones } = buildTrendSeries(d);

    chart = Highcharts.chart(container, reduceChartMotion({
      chart: {
        type:            "line",
        height:          240,
        margin:          [16, 16, 40, 54],
        backgroundColor: "transparent",
        animation:       false,
      },
      title:   { text: "" },
      credits: { enabled: false },
      legend:  { enabled: false },
      // T-5.4a — screen-reader summary (Slovenian copy awaiting operator review)
      accessibility: {
        enabled: true,
        description: t("trend.a11y"),
      },
      tooltip: {
        formatter(this: any) {
          if (this.series.name === "Annual value") return t("trend.tooltip_annual", { x: Math.round(this.x), y: fmtNum(this.y, 1) });
          if (this.series.name === "Milestones")   return t("trend.tooltip_milestone", { x: this.x, y: fmtNum(this.y, 1) });
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
        title:         { text: undefined },
        labels:        { format: "{value}°C", style: { color: INK_SOFT, ...MONO } },
        gridLineColor: "rgba(14,14,12,0.06)",
      },
      // T-5.71 — disable the decorative ~1 s series draw-in outright (see
      // DistributionChart for the mount-storm rationale). chart.animation:false is
      // redraw-only; this governs the initial reveal.
      plotOptions: { series: { animation: false } },
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
    } as Highcharts.Options));
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
  // era5 station count (D-7 "povprečje N postaj") — the national trend explain
  // names it rather than the bare "vseh postaj". Derived from meta.stations by the
  // caller so it can't go stale; only read on the national branch
  // (props.loc null or ERA5_NATIONAL — the caller passes the latter).
  stationCount: number;
}

export function TodayTrendChart(props: Props) {
  const month = () => Number(props.date.split("-")[1]);
  const day   = () => Number(props.date.split("-")[2]);

  const [trend, { refetch }] = createResource(
    () => ({ month: month(), day: day(), loc: props.loc }),
    ({ month, day, loc }) => fetchAnnualTrend(month, day, loc),
  );

  // Keep previous data visible while refetching so the chart stays mounted
  const trendDisplay = () => trend() ?? trend.latest;

  return (
    <div class="today-chart">
      <ErrorBoundary fallback={sectionErrorFallback(refetch, "240px")}>
      <Show when={trendDisplay()}>
        {(tr) => {
          const d = () => tr();
          const sig      = () => { const p = d().pVal; return p < 0.001 ? "p < 0,001" : p < 0.01 ? "p < 0,01" : p < 0.05 ? `p = ${fmtNum(p, 3)}` : `p = ${fmtNum(p, 3)} (ns)`; };
          const proj2050 = () => {
            const y = d().projLine.y;
            const lastY = y[y.length - 1];
            if (lastY === undefined) throw new Error("projLine.y is empty");
            return fmtNum(lastY, 1);
          };
          const trendStr = () => fmtSigned(d().trend10, 2);
          // National (loc === ERA5_NATIONAL, or null) is NOT a station: return null so
          // both the title and explain take their national branch. Testing bare
          // truthiness printed the raw "era5:national" key (T-4.20); the `&&` narrows
          // props.loc to string for the compare + replace, so no assertion is needed.
          const stationLabel = () =>
            props.loc && props.loc !== ERA5_NATIONAL ? props.loc.replace(/_/g, " ") : null;
          return (
            <>
              <div class="today-chart-title">
                {stationLabel()
                  ? t("trend.title_station", { station: stationLabel()!, day: fmtMonthDay(d().monthNum, d().dayNum), yearMin: d().yearMin, yearMax: d().yearMax })
                  : t("trend.title_nat", { day: fmtMonthDay(d().monthNum, d().dayNum), yearMin: d().yearMin, yearMax: d().yearMax })}
              </div>
              <TrendHighchart trend={d()} />
              <p class="today-explain" style={{ padding: "4px 0 12px" }}>
                {t("trend.explain", {
                  source: stationLabel()
                    ? t("trend.explain_source_station", { station: stationLabel()! })
                    : t("trend.explain_source_nat", { count: props.stationCount }),
                  yearMin: d().yearMin,
                  trend: trendStr(),
                  sig: sig(),
                  proj2050: proj2050(),
                })}
              </p>
              <div class="today-foot">
                {t("trend.foot", { trend: trendStr(), sig: sig(), tau: fmtNum(d().tau, 3), count: d().nYears })}
              </div>
            </>
          );
        }}
      </Show>
      <Show when={trend.loading && !trendDisplay()}>
        <div style={{ height: "240px" }} class="animate-pulse bg-[var(--color-paper-2)] rounded" />
      </Show>
      </ErrorBoundary>
    </div>
  );
}
