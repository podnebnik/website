// code/ali-je-vroce/charts/Highchart.tsx
import { onCleanup, onMount, createEffect, createSignal } from "solid-js";
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
  let chart: Highcharts.Chart | null = null;
  const [isInitialized, setIsInitialized] = createSignal(false);

  onMount(() => {
    if (props.options && container) {
      chart = Highcharts.chart(container, props.options);
      setIsInitialized(true);
    }

    onCleanup(() => {
      if (chart) {
        chart.destroy();
        chart = null;
      }
    });
  });

  // Handle options changes after initial mount
  createEffect(() => {
    if (!isInitialized() || !props.options || !chart) {
      console.log("Highchart effect skipping:", {
        isInitialized: isInitialized(),
        hasOptions: !!props.options,
        hasChart: !!chart,
      });
      return;
    }

    console.log("Highchart recreating chart with new options:", props.options);
    // Always recreate the chart to avoid update issues with dynamic series
    chart.destroy();
    chart = Highcharts.chart(container, props.options);
    console.log("Chart recreated successfully");
  });

  return (
    <div
      ref={container}
      style={{ width: "100%", height: props.height || "400px" }}
    />
  );
}
