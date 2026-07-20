import { onMount, onCleanup, createEffect } from "solid-js";
import type { CalendarData } from "../api.ts";

interface Props {
  data: CalendarData;
  doy:  number;
  var:  string;
}

const MONTH_DOYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTH_MIDS = MONTH_DOYS.map((d, i) =>
  Math.round((d + (MONTH_DOYS[i + 1] ?? 366)) / 2)
);
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const IS_PRECIP = new Set(["precipitation_sum","et0_evapotranspiration"]);
const POS_TEMP  = [210, 55,  35] as const;   // red   — warming
const NEG_TEMP  = [35,  90,  210] as const;   // blue  — cooling
const POS_PRECIP = [35,  100, 210] as const;  // blue  — wetter
const NEG_PRECIP = [180, 105, 25] as const;   // amber — drier

function mdToDoy(month: number, day: number): number {
  const jan1 = new Date(2001, 0, 1).getTime();
  return Math.round((new Date(2001, month - 1, day).getTime() - jan1) / 86400000) + 1;
}

function barColor(trend10: number, p_val: number, variable: string): string {
  const isPos  = trend10 >= 0;
  const isPrecip = IS_PRECIP.has(variable);
  const [r, g, b] = isPrecip
    ? (isPos ? POS_PRECIP : NEG_PRECIP)
    : (isPos ? POS_TEMP   : NEG_TEMP);
  const alpha = p_val < 0.001 ? 0.95 : p_val < 0.01 ? 0.70 : p_val < 0.05 ? 0.40 : 0.12;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function YearRoundChart(props: Props) {
  let container!: HTMLDivElement;
  let chart: any = null;

  function buildSeries(data: CalendarData, variable: string) {
    return data.rows.map(r => ({
      x:     mdToDoy(r.month, r.day),
      y:     r.trend10,
      color: barColor(r.trend10, r.p_val, variable),
      p:     r.p_val,
    }));
  }

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;

    const colData = buildSeries(props.data, props.var);

    chart = Highcharts.chart(container, {
      chart: {
        type:            "column",
        marginTop:       10,
        marginBottom:    34,
        marginLeft:      52,
        marginRight:     12,
        animation:       false,
        backgroundColor: "transparent",
        style:           { fontFamily: "Space Grotesk, system-ui, sans-serif" },
      },
      title:    { text: undefined },
      subtitle: { text: undefined },
      credits:  { enabled: false },
      legend:   { enabled: false },
      xAxis: {
        min: 0.5, max: 365.5,
        tickPositions: MONTH_MIDS,
        labels: {
          formatter(this: any) {
            const idx = MONTH_MIDS.findIndex(m => m === this.value);
            return idx >= 0 ? MONTH_LABELS[idx]! : "";
          },
          style: { fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#6B655B" },
        },
        lineColor:  "rgba(14,14,12,0.10)",
        tickColor:  "rgba(14,14,12,0.10)",
        gridLineWidth: 0,
        plotLines: [{
          id:        "doy-line",
          value:     props.doy,
          color:     "#962c1a",
          width:     2,
          zIndex:    5,
          dashStyle: "ShortDash" as Highcharts.DashStyleValue,
        }],
      },
      yAxis: {
        title:      { text: null },
        labels: {
          format: "{value}",
          style:  { fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#6B655B" },
        },
        plotLines: [{
          value:     0,
          color:     "rgba(14,14,12,0.2)",
          width:     1,
        }],
        gridLineColor: "rgba(14,14,12,0.06)",
      },
      plotOptions: {
        column: {
          animation:     false,
          grouping:      false,
          borderWidth:   0,
          pointPadding:  0,
          groupPadding:  0,
        },
      },
      tooltip: {
        formatter(this: any) {
          const ref = new Date(2001, 0, this.x - 1);
          const label = ref.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
          const sign = this.y >= 0 ? "+" : "";
          const pStr = this.point.p < 0.001 ? "< 0.001" : this.point.p.toFixed(3);
          return `<b>${label}</b><br>Trend: ${sign}${this.y.toFixed(3)} ${props.data.unit}/decade<br>p = ${pStr}`;
        },
        style: { fontSize: "12px", fontFamily: "Space Grotesk, sans-serif" },
      },
      series: [{
        type:      "column",
        name:      "trend/decade",
        data:      colData,
        borderWidth: 0,
      }],
    } as Highcharts.Options);
  });

  // Update plotLine when DOY changes — no rebuild
  createEffect(() => {
    const doy = props.doy;
    if (!chart) return;
    chart.xAxis[0].removePlotLine("doy-line");
    chart.xAxis[0].addPlotLine({
      id:        "doy-line",
      value:     doy,
      color:     "#962c1a",
      width:     2,
      zIndex:    5,
      dashStyle: "ShortDash",
    });
  });

  // Rebuild series when data or variable changes
  createEffect(() => {
    const data = props.data;
    const variable = props.var;
    if (!chart) return;
    chart.series[0]?.setData(buildSeries(data, variable), true, false, false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} style={{ "min-height": "180px" }} />;
}
