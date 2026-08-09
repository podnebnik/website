import { onMount, onCleanup, createEffect } from "solid-js";
import type { Last7 } from "../types.ts";
import { enableChartA11y } from "../charts/highcharts-a11y.ts";
import { reduceChartMotion } from "../reduced-motion.ts";
import { t, fmtNum, fmtInt } from "../i18n/format.ts";

const CAT_ORDER  = ["freezing", "cold", "nope", "hot", "hell"];
const CAT_COLORS = ["#3a5a8a", "#6c8fb6", "#e7d9b8", "#c25a2c", "#962c1a"];
const CAT_LABELS = [
  t("last7.cat_freezing"), t("last7.cat_cold"), t("last7.cat_nope"),
  t("last7.cat_hot"), t("last7.cat_hell"),
];

const INK      = "#0E0E0C";
const MONO     = { fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: "600" };

interface Props {
  days: Last7["days"];
}

export function TodayLast7Chart(props: Props) {
  let container!: HTMLDivElement;
  let chart: any = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await enableChartA11y(Highcharts);

    const points = props.days.map((d) => {
      const [, mm, dd] = d.date.split("-");
      return {
        label:   `${dd}.${mm}`,
        y:       CAT_ORDER.indexOf(d.category_key),
        color:   d.color,
        temp:    d.today_temp,
        pct:     d.percentile,
        catName: CAT_LABELS[CAT_ORDER.indexOf(d.category_key)] ?? d.category_key,
      };
    });

    chart = Highcharts.chart(container, reduceChartMotion({
      chart: {
        type:            "line",
        height:          190,
        margin:          [8, 12, 40, 108],
        backgroundColor: "transparent",
        borderWidth:     0,
        animation:       false,
      },
      title:   { text: "" },
      credits: { enabled: false },
      legend:  { enabled: false },
      // T-5.4a — screen-reader summary (Slovenian copy awaiting operator review)
      accessibility: {
        enabled: true,
        description: t("last7.a11y"),
      },
      tooltip: {
        formatter(this: any) {
          const p = this.point as any;
          return t("last7.tooltip", { label: p.label, cat: p.catName, temp: fmtNum(p.temp, 1), pct: fmtInt(p.pct) });
        },
      },
      xAxis: {
        categories: points.map((p) => p.label),
        title:      { text: null },
        labels:     { style: { color: INK, ...MONO } },
        lineColor:  "rgba(14,14,12,0.15)",
        tickColor:  "rgba(14,14,12,0.15)",
        gridLineWidth: 0,
      },
      yAxis: {
        categories:    CAT_LABELS,
        min:           0,
        max:           CAT_LABELS.length - 1,
        tickPositions: [0, 1, 2, 3, 4],
        title:         { text: undefined },
        labels: {
          style:        { color: INK, fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", fontWeight: "600", textOverflow: "none", whiteSpace: "nowrap" },
          align:        "right",
          x:            -6,
          reserveSpace: true,
        },
        gridLineColor: "rgba(14,14,12,0.1)",
        plotBands: CAT_COLORS.map((color, i) => ({
          from:  i - 0.5,
          to:    i + 0.5,
          color: color + "33",
        })),
      },
      // T-5.71 — disable the decorative ~1 s series draw-in outright (see
      // DistributionChart for the mount-storm rationale). chart.animation:false is
      // redraw-only; this governs the initial reveal.
      plotOptions: { series: { animation: false } },
      series: [{
        name: "Category",
        type: "line",
        data: points.map((p, i) => ({
          x:       i,
          y:       p.y,
          color:   p.color,
          temp:    p.temp,
          pct:     p.pct,
          catName: p.catName,
          label:   p.label,
        })),
        color:     INK,
        lineWidth: 1.5,
        marker: {
          enabled:   true,
          radius:    5,
          symbol:    "circle",
          lineWidth: 1.5,
          lineColor: INK,
        },
      }],
    } as Highcharts.Options));
  });

  createEffect(() => {
    const points = props.days.map((d) => {
      const [, mm, dd] = d.date.split("-");
      return {
        label:   `${dd}.${mm}`,
        y:       CAT_ORDER.indexOf(d.category_key),
        color:   d.color,
        temp:    d.today_temp,
        pct:     d.percentile,
        catName: CAT_LABELS[CAT_ORDER.indexOf(d.category_key)] ?? d.category_key,
      };
    });
    if (!chart) return;
    chart.xAxis[0]?.setCategories(points.map((p) => p.label), false);
    chart.series[0]?.setData(
      points.map((p, i) => ({ x: i, y: p.y, color: p.color, temp: p.temp, pct: p.pct, catName: p.catName, label: p.label })),
      true, false, false,
    );
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}
