// code/ali-je-vroce/charts/SeasonalScatter.tsx
import { createMemo } from "solid-js";
import { Highchart } from "./Highchart.tsx";
import { ChartContainer } from "../components/ChartContainer.tsx";
import { SeasonalScatterProps } from "../../types/components.ts";
import { percentile, linreg } from "../utils/statistics.ts";
import { colorFor } from "../utils/mathHelpers.ts";
import {
  createScatterChartConfig,
  ScatterPoint,
  TodayPoint,
} from "./config/scatterConfig.ts";
import { useChartData } from "../hooks/useChartData.ts";
import { LOADING_MESSAGES } from "../utils/uiConstants.ts";
import { CHART_DATA } from "../utils/chartConstants.ts";
import * as Highcharts from "highcharts";

/**
 * Props:
 *  - stationId: number|string (required)
 *  - center_mmdd: "MM-DD" string (required)
 *  - todayTemp: number (required, live from API)
 *  - title?: string
 */
export default function SeasonalScatter(props: SeasonalScatterProps) {
  // Use the custom data loading hook
  const { loading, error, data, processedData } = useChartData({
    stationId: props.stationId,
    center_mmdd: props.center_mmdd,
    todayTemp: props.todayTemp,
    windowDays: CHART_DATA.WINDOW_DAYS,
  });

  // Memoized chart options calculation
  const chartOptions = createMemo<Highcharts.Options | null>(() => {
    const rawData = data();
    const processed = processedData();

    if (!rawData || !processed || loading()) {
      return null;
    }

    try {
      // Expect 15 points per year: {year, day_offset, tavg}
      const years = rawData.map((d) => +d.year);
      const temps = processed.temperatures;

      // Percentiles across *all* points in the window (all years * 15 days)
      const sorted = processed.sortedTemperatures;
      const p05 = percentile(sorted, 5);
      const p95 = percentile(sorted, 95);
      const med = percentile(sorted, 50);

      // Color by anomaly vs overall median
      const anomalies = temps.map((v) => v - med);
      const zmin = Math.min(...anomalies),
        zmax = Math.max(...anomalies);

      const scatter: ScatterPoint[] = rawData.map((d, i) => ({
        x: +d.year, // stack by year on x-axis
        y: +d.tavg,
        // optional: keep offset if we later want to jitter or show tooltip
        day_offset: d.day_offset ?? null,
        marker: { radius: 4, fillColor: colorFor(anomalies[i]!, zmin, zmax) },
      }));

      // Linear regression across ALL points (years * 15)
      const { a, b } = linreg(years, temps);
      const x0 = Math.min(...years),
        x1 = Math.max(...years);
      const y0 = a + b * x0,
        y1 = a + b * x1;
      const trendPerCentury = b * 100;

      // "Today" label plotted slightly to the right of the newest year
      const todayX = x1 + 2;
      const todayPoint: TodayPoint = {
        x: todayX,
        y: props.todayTemp!,
        marker: { radius: 7, lineWidth: 2, lineColor: "#333" },
      };

      const yMin = Math.floor(Math.min(...temps, props.todayTemp!) - 1);
      const yMax = Math.ceil(Math.max(...temps, props.todayTemp!) + 1);

      // Create trend line data
      const trendLine = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ];

      // Use configuration builder instead of inline configuration
      return createScatterChartConfig({
        title: props.title || "Daily average temperatures — two weeks window",
        xMin: x0,
        xMax: x1,
        todayX,
        yMin,
        yMax,
        p05,
        p95,
        scatter,
        trendLine,
        todayPoint,
        trendPerCentury,
        todayLabel: CHART_DATA.TODAY_LABEL,
      });
    } catch (e) {
      console.error("Failed to generate chart options:", e);
      return null;
    }
  });

  return (
    <ChartContainer
      loading={loading()}
      error={error()}
      hasData={!!chartOptions()}
      chartType="scatter"
      loadingMessage={LOADING_MESSAGES.CHART}
    >
      <Highchart options={chartOptions()!} height="360px" />
    </ChartContainer>
  );
}
