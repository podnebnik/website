// code/ali-je-vroce/charts/SeasonalHistogram.tsx
import { createMemo } from "solid-js";
import { Highchart } from "./Highchart.tsx";
import { ChartContainer } from "../components/ChartContainer.tsx";
import { SeasonalHistogramProps } from "../../types/components.js";
import { percentile, stddev, epanechnikovKernel } from "../utils/statistics.ts";
import { clamp } from "../utils/mathHelpers.ts";
import { createHistogramChartConfig } from "./config/histogramConfig.ts";
import { useChartData } from "../hooks/useChartData.ts";
import { LOADING_MESSAGES } from "../utils/uiConstants.ts";
import { CHART_DATA } from "../utils/chartConstants.ts";
import * as Highcharts from "highcharts";

/**
 * Non-Gaussian smoothed histogram (Epanechnikov KDE) for the 15-day window.
 * Props:
 *  - stationId: number|string
 *  - center_mmdd: "MM-DD"
 *  - todayTemp?: number | null
 *  - title?: string
 */
export default function SeasonalHistogram(props: SeasonalHistogramProps) {
  // Use the custom data loading hook
  const { loading, error, processedData, calculations } = useChartData({
    stationId: props.stationId,
    center_mmdd: props.center_mmdd,
    todayTemp: props.todayTemp ?? null,
    windowDays: CHART_DATA.WINDOW_DAYS,
  });

  // Memoized histogram-specific processing
  const chartOptions = createMemo<Highcharts.Options | null>(() => {
    const processed = processedData();
    const calc = calculations();

    if (!processed || !calc || loading()) {
      return null;
    }

    try {
      const { sortedTemperatures, temperatures } = processed;
      const { temperatureRange } = calc;

      // Calculate specific percentiles needed for histogram (5%, 50%, 95%)
      const p05 = percentile(sortedTemperatures, 5);
      const p50 = percentile(sortedTemperatures, 50);
      const p95 = percentile(sortedTemperatures, 95);

      // Extend range for better visualization
      const padding = 0.5; // °C
      const xMin = Math.floor(temperatureRange.min - padding);
      const xMax = Math.ceil(temperatureRange.max + padding);

      // Generate denser grid for histogram display (every 0.1°C)
      const step = 0.1; // °C resolution
      const xs = [];
      for (let x = xMin; x <= xMax + 1e-9; x += step) xs.push(x);

      // Use robust bandwidth calculation (SeasonalHistogram's approach)
      const IQR =
        percentile(sortedTemperatures, 75) - percentile(sortedTemperatures, 25);
      const robustBW =
        IQR > 0
          ? (2 * IQR) / Math.cbrt(temperatures.length)
          : (stddev(temperatures) * 1.06) / Math.cbrt(temperatures.length);
      const h = clamp(robustBW, 0.2, 2.5);

      // Recalculate KDE with denser grid and robust bandwidth
      const N = temperatures.length;
      const density = xs.map((x) => {
        let s = 0;
        for (let i = 0; i < N; i++)
          s += epanechnikovKernel((x - temperatures[i]!) / h);
        return s / (N * h);
      });

      // Scale density to approximate counts
      const areaApprox = density.reduce((a, b) => a + b, 0) * step;
      const scale = areaApprox > 0 ? N / areaApprox : 1;
      const ys = density.map((d) => d * scale);

      // Split by percentile ranges for fill styling
      const left: [number, number | null][] = [];
      const mid: [number, number | null][] = [];
      const right: [number, number | null][] = [];
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i]!,
          y = ys[i]!;
        left.push(x <= p05 ? [x, y] : [x, null]);
        mid.push(x >= p05 && x <= p95 ? [x, y] : [x, null]);
        right.push(x >= p95 ? [x, y] : [x, null]);
      }

      const yMax = Math.max(...ys) * 1.12; // a bit of headroom
      const todayVal =
        props.todayTemp != null && Number.isFinite(Number(props.todayTemp))
          ? Number(props.todayTemp)
          : null;

      return createHistogramChartConfig({
        left,
        mid,
        right,
        p05,
        p50,
        p95,
        today: todayVal,
        yMax,
        title: props.title || `Distribution around ${props.center_mmdd}`,
      });
    } catch (e) {
      console.error("Error processing histogram data:", e);
      return null;
    }
  });

  return (
    <ChartContainer
      loading={loading()}
      error={error()}
      hasData={!!chartOptions()}
      chartType="histogram"
      loadingMessage={LOADING_MESSAGES.HISTOGRAM}
    >
      <Highchart options={chartOptions()!} />
    </ChartContainer>
  );
}
