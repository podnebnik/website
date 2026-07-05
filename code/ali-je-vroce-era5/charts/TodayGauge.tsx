import { onMount, onCleanup, createEffect } from "solid-js";
import type { TodayStatus } from "../types.ts";

interface Props {
  data: TodayStatus;
}

const CAT_ORDER  = ["freezing", "cold", "nope", "hot", "hell"] as const;
const CAT_COLORS = ["#3a5a8a", "#6c8fb6", "#e7d9b8", "#c25a2c", "#962c1a"] as const;
const BOUNDS     = [0, 10, 20, 80, 95, 101] as const;

function dialPosition(catKey: string, pct: number): number {
  const idx = Math.max(0, CAT_ORDER.indexOf(catKey as typeof CAT_ORDER[number]));
  const lo = BOUNDS[idx], hi = BOUNDS[idx + 1];
  const frac = hi > lo ? Math.min(1, Math.max(0, (pct - lo) / (hi - lo))) : 0.5;
  return idx + frac;
}

export function TodayGauge(props: Props) {
  let container!: HTMLDivElement;
  let chart: Highcharts.Chart | null = null;

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");

    const r = props.data;
    const catKey = r.category_key ?? "nope";
    const pct    = r.percentile ?? 0;
    const target = dialPosition(catKey, pct);

    chart = Highcharts.chart(container, {
      chart: {
        type:            "gauge",
        backgroundColor: "transparent",
        margin:          [0, 0, 0, 0],
        animation:       { duration: 900, easing: "easeOutQuint" },
      },
      title:         null,
      credits:       { enabled: false },
      tooltip:       { enabled: false },
      exporting:     { enabled: false },
      accessibility: { enabled: false },
      pane: {
        startAngle: -90,
        endAngle:    90,
        center:      ["50%", "92%"],
        size:        "150%",
        background:  undefined,
      },
      yAxis: {
        min:              0,
        max:              CAT_ORDER.length,
        tickPositions:    [],
        minorTickInterval: null as any,
        plotBands:        CAT_ORDER.map((_, i) => ({
          from:        i,
          to:          i + 1,
          color:       CAT_COLORS[i],
          thickness:   18,
          outerRadius: "100%",
        })),
        lineWidth: 0,
      },
      series: [{
        type: "gauge",
        data: [0],
        dial: {
          radius:          "62%",
          baseWidth:       4,
          baseLength:      "0%",
          rearLength:      "0%",
          backgroundColor: "#1a1a18",
        },
        pivot: { radius: 5, backgroundColor: "#1a1a18" },
        dataLabels: { enabled: false },
      }],
    } as Highcharts.Options);

    // Animate needle from 0 → actual value on first render
    chart.series[0]?.setData([target], true, { duration: 900 });
  });

  createEffect(() => {
    const catKey = props.data.category_key ?? "nope";
    const pct    = props.data.percentile    ?? 0;
    if (!chart) return;
    chart.series[0]?.setData([dialPosition(catKey, pct)], true, { duration: 500 }, false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  const tempStyle = () => {
    const catKey = props.data.category_key ?? "nope";
    return {
      background: props.data.color ?? "#e7d9b8",
      color:      catKey === "nope" ? "#1a1a18" : "#ffffff",
    };
  };

  return (
    <div class="flex flex-col items-center gap-2 flex-shrink-0">
      <div ref={container} style={{ width: "230px", height: "100px" }} />
      <div
        class="font-mono text-sm font-semibold px-4 py-1 rounded-full leading-tight"
        style={tempStyle()}
      >
        {props.data.today_temp?.toFixed(1)} °C
      </div>
    </div>
  );
}
