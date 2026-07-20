import { onMount, onCleanup, createEffect } from "solid-js";
import type { Last7 } from "../types.ts";

const CAT_ORDER  = ["freezing", "cold", "nope", "hot", "hell"];
const CAT_COLORS = ["#3a5a8a", "#6c8fb6", "#e7d9b8", "#c25a2c", "#962c1a"];
const CAT_LABELS = ["Zmrzujoče", "Hladno", "Normalno", "Vroče", "Peklensko"];

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const MONO     = { fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: "600" };

interface Props {
  days: Last7["days"];
}

export function TodayLast7Chart(props: Props) {
  let container!: HTMLDivElement;
  let chart: any = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;

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

    chart = Highcharts.chart(container, {
      chart: {
        type:            "line",
        height:          190,
        margin:          [8, 12, 40, 108],
        backgroundColor: "transparent",
        borderWidth:     0,
        animation:       false,
      },
      title:   { text: null },
      credits: { enabled: false },
      legend:  { enabled: false },
      tooltip: {
        formatter(this: any) {
          const p = this.point as any;
          return `<b>${p.label}</b>: ${p.catName} · ${p.temp.toFixed(1)} °C (${p.pct.toFixed(0)}th pct)`;
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
        title:         { text: null },
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
    } as Highcharts.Options);
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
