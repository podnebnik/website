// code/ali-je-vroce/charts/SeasonalHistogram.tsx
import { createMemo } from "solid-js";
import { Highchart } from "./Highchart.tsx";
import { ChartContainer } from "../components/ChartContainer.tsx";
import { SeasonalHistogramProps } from "../../types/components.ts";
import { percentile, stddev, epanechnikovKernel } from "../utils/statistics.ts";
import { clamp } from "../utils/mathHelpers.ts";
import { createHistogramChartConfig } from "./config/histogramConfig.ts";
import { useHistoricalDataQuery } from "../hooks/queries.ts";
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
  // Create stable reactive parameters to prevent unnecessary query recreations
  const stationId = () => Number(props.stationId);
  const centerMmdd = () => props.center_mmdd;
  const windowDays = () => CHART_DATA.WINDOW_DAYS;

  console.log(
    "📊 ORIGINAL Histogram - todayTemp prop:",
    props.todayTemp,
    "typeof:",
    typeof props.todayTemp,
    "isFinite:",
    Number.isFinite(Number(props.todayTemp))
  );

  // Use TanStack Query hook for historical data with individual parameters
  const queryResult = useHistoricalDataQuery(
    stationId(),
    centerMmdd(),
    windowDays()
  );

  // Memoized histogram-specific processing
  const chartOptions = createMemo<Highcharts.Options | null>(() => {
    const rawData = queryResult.data;
    const isLoading = queryResult.isLoading;

    if (!rawData || isLoading) {
      return null;
    }

    // Allow chart creation even when todayTemp is invalid - just omit TODAY labels
    // This prevents race conditions during station changes
    const todayTemp =
      props.todayTemp != null && Number.isFinite(Number(props.todayTemp))
        ? Number(props.todayTemp)
        : null;

    console.log("📊 ORIGINAL Histogram - validated todayTemp:", todayTemp);

    try {
      // Process the raw historical data inline
      const temperatures = rawData.map((d: any) => +d.tavg);
      const sortedTemperatures = [...temperatures].sort((a, b) => a - b);
      const temperatureRange = {
        min: Math.min(...temperatures),
        max: Math.max(...temperatures),
      };

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
      const todayVal = todayTemp; // Use the validated todayTemp from memo scope

      const config = createHistogramChartConfig({
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

      return config;
    } catch (e) {
      console.error("Error processing histogram data:", e);
      return null;
    }
  });

  return (
    <ChartContainer
      loading={queryResult.isLoading}
      error={queryResult.error?.message || null}
      hasData={!!chartOptions()}
      chartType="histogram"
      loadingMessage={LOADING_MESSAGES.HISTOGRAM}
    >
      <Highchart options={chartOptions()!} />
    </ChartContainer>
  );
}
