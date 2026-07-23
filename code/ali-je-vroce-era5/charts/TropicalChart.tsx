// Shared tropical-days/nights renderer.
//
// T-2.3 (D-1) removed this file's own sidecar client — the `SIDECAR_BASE`
// `/api/live/tropical_*` endpoints, the `CONFIGS` table that carried them, the
// `TropData` response shape and the `TropicalChart` component that fetched
// them. Nothing imported that component; the live page composes `TropHighchart`
// below from `charts/Era5TropicalChart.tsx:118`, which gets its series from
// `fetchEra5Tropical` (`api.ts:444`) over datasette.
import { createEffect, onMount, onCleanup } from "solid-js";
import { todayYear } from "../clock";

export interface TropTrend {
  model_used:      boolean | "nb";
  rate_per_year:   number;
  days_per_decade: number;
  p_value:         number;
  x_line:          number[];
  y_line:          number[];
  ci_low:          number[];
  ci_high:         number[];
  pi_low?:         number[];
  pi_high?:        number[];
  fit_year_max:    number;
  aic:             number;
  alpha:           number;
}

export interface TropStation {
  years:         number[];
  counts:        number[];
  nonzero_count: number;
  trend:         TropTrend;
}

export interface Config {
  kind:             "days" | "nights";
  unitLabel:        string;
  defaultThreshold: number;
  minT:             number;
  maxT:             number;
  subLabel:         (th: number, st: number) => string;
  tooltipNoun:      string;
  plainDesc:        (th: number) => string;
  plainNoun:        string;
}

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const ACCENT   = "#C25A2C";
const MONO     = { fontFamily: "'JetBrains Mono', monospace" };

function pFmt(p: number): string {
  return p < 0.001 ? "p < 0.001" : p < 0.01 ? "p < 0.01" : p < 0.05 ? `p = ${p.toFixed(3)}` : `p = ${p.toFixed(3)} (ns)`;
}

// ── Highcharts inner component ────────────────────────────────────────────────

export interface ChartProps {
  station:   string;
  series:    TropStation;
  cfg:       Config;
  threshold: number;
}

export function TropHighchart(props: ChartProps) {
  let container!: HTMLDivElement;
  let chart: any = null;

  const buildSeries = () => {
    const { years, counts, trend } = props.series;
    const currentYear = todayYear();

    const barData = years.map((y, i) => ({
      x: y, y: counts[i]!,
      ...(y === currentYear ? { color: ACCENT, opacity: 0.4 } : {}),
    }));

    const out: any[] = [
      {
        type: "column",
        name: props.cfg.tooltipNoun,
        data: barData,
        color: ACCENT + "99",
        groupPadding: 0.05,
        pointPadding: 0,
        borderWidth: 0,
        zIndex: 2,
        dataLabels: {
          enabled: true,
          style: { fontSize: "8px", fontWeight: "400", color: INK_SOFT, textOutline: "none" },
          formatter(this: any) { return this.y || null; },
        },
      },
    ];

    if (trend?.model_used && trend.x_line) {
      const dpd = trend.days_per_decade;
      const p   = trend.p_value;

      if (trend.pi_low) {
        out.push({
          type: "arearange",
          name: "95% PI",
          data: trend.x_line.map((x, i) => [x, trend.pi_low![i], trend.pi_high![i]]),
          color: INK,
          fillOpacity: 0.05,
          lineWidth: 0,
          marker: { enabled: false },
          enableMouseTracking: false,
          zIndex: 0,
        });
      }

      out.push(
        {
          type: "arearange",
          name: "95% CI",
          data: trend.x_line.map((x, i) => [x, trend.ci_low[i], trend.ci_high[i]]),
          color: INK,
          fillOpacity: 0.12,
          lineWidth: 0,
          marker: { enabled: false },
          enableMouseTracking: false,
          zIndex: 1,
        },
        {
          type: "line",
          name: `NB fit (${dpd >= 0 ? "+" : ""}${dpd.toFixed(1)} ${props.cfg.unitLabel}/des · ${pFmt(p)})`,
          data: trend.x_line.map((x, i) => ({ x, y: trend.y_line[i] })),
          color: INK,
          lineWidth: 2,
          dashStyle: "Solid",
          marker: { enabled: false },
          zIndex: 3,
        }
      );
    }
    return out;
  };

  const buildXPlotLines = () => {
    if (!props.series.trend?.fit_year_max) return [];
    return [{
      value: props.series.trend.fit_year_max + 0.5,
      color: INK_SOFT, width: 1, dashStyle: "Dot" as const, zIndex: 4,
      label: {
        text: `trend do ${props.series.trend.fit_year_max}`, rotation: 0,
        align: "right" as const, x: -4, y: -4,
        style: { fontSize: "9px", color: INK_SOFT, ...MONO },
      },
    }];
  };

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");

    chart = Highcharts.chart(container, {
      chart: { type: "column", height: 300, backgroundColor: "transparent", animation: false, style: { fontFamily: "Space Grotesk, sans-serif" } },
      title:   { text: undefined },
      credits: { enabled: false },
      legend:  { enabled: true, itemStyle: { fontSize: "10px", fontWeight: "400", color: INK } },
      tooltip: {
        formatter(this: any) {
          if (this.series.type === "line") return `<b>${Math.round(this.x)}</b><br>Trend: <b>${this.y!.toFixed(1)}</b> ${props.cfg.unitLabel}`;
          if (this.series.type === "arearange") return false as any;
          const partial = this.x === todayYear() ? " <i>(leto v teku)</i>" : "";
          return `<b>${this.x}</b>${partial}<br>${props.cfg.tooltipNoun}: <b>${this.y}</b>`;
        },
      },
      xAxis: {
        title: { text: null },
        labels: { style: { color: INK_SOFT, fontSize: "10px", ...MONO } },
        gridLineWidth: 0,
        tickColor: "rgba(14,14,12,0.1)",
        plotLines: buildXPlotLines(),
      },
      yAxis: {
        title: { text: props.cfg.unitLabel.charAt(0).toUpperCase() + props.cfg.unitLabel.slice(1), style: { fontSize: "10px", color: INK_SOFT } },
        min: 0,
        gridLineColor: "rgba(14,14,12,0.06)",
        labels: { style: { fontSize: "10px", color: INK_SOFT, ...MONO } },
      },
      series: buildSeries(),
    } as any);
  });

  // ── KEY FIX: read reactive props BEFORE early return so deps are always tracked ──
  createEffect(() => {
    const _series    = props.series;    // establish reactive dependency
    const _threshold = props.threshold; // establish reactive dependency
    if (!chart) return;
    const series = buildSeries();
    while (chart.series.length) chart.series[0].remove(false);
    series.forEach(s => chart.addSeries(s, false));
    chart.xAxis[0].update({ plotLines: buildXPlotLines() }, false);
    chart.redraw(false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}
