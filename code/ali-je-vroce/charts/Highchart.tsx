// code/ali-je-vroce/charts/Highchart.tsx
import { onCleanup, onMount } from "solid-js";
import Highcharts from "highcharts";
import { HighchartProps } from "../../types/components.ts";

/**
 * Minimal Solid wrapper for Highcharts
 * Props:
 *  - options: Highcharts.Options
 *  - height?: string (default "400px")
 */
export function Highchart(props: HighchartProps) {
  let container!: HTMLDivElement;

  onMount(() => {
    const chart = Highcharts.chart(container, props.options || {});
    onCleanup(() => chart && chart.destroy());
  });

  return (
    <div
      ref={container}
      style={{ width: "100%", height: props.height || "400px" }}
    />
  );
}
