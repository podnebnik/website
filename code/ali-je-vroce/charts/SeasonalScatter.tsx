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
import { useHistoricalDataQuery } from "../hooks/queries.ts";
import { LOADING_MESSAGES } from "../utils/uiConstants.ts";
import { CHART_DATA } from "../utils/chartConstants.ts";
import * as Highcharts from "highcharts";

/**
 * Props:
 *  - stationId: number|string
 *  - center_mmdd: "MM-DD"
 *  - todayTemp?: number | null (optional, for today point)
 *  - title?: string
 */
export default function SeasonalScatter(props: SeasonalScatterProps) {
  // Create reactive parameters for the query
  const queryParams = createMemo(() => ({
    station_id: Number(props.stationId),
    center_mmdd: props.center_mmdd,
    window_days: CHART_DATA.WINDOW_DAYS,
  }));
  console.log(
    "Scatter todayTemp:",
    props.todayTemp,
    "station:",
    props.stationId
  );

  // Use TanStack Query hook for historical data
  const queryResult = useHistoricalDataQuery(queryParams());

  // Memoized chart options calculation
  const chartOptions = createMemo<Highcharts.Options | null>(() => {
    const rawData = queryResult.data;
    const isLoading = queryResult.isLoading;

    if (!rawData || isLoading) {
      return null;
    }

    // Only generate new chart options when todayTemp is valid to prevent race condition
    const hasValidTodayTemp =
      props.todayTemp == null || Number.isFinite(Number(props.todayTemp));
    if (!hasValidTodayTemp) {
      console.log(
        "Scatter skipping chart config due to invalid todayTemp:",
        props.todayTemp
      );
      return null;
    }

    try {
      // Process the raw historical data to extract temperatures and years
      // Expect format: {year, day_offset, tavg}
      const years = rawData.map((d: any) => +d.year);
      const temps = rawData.map((d: any) => +d.tavg);

      // Calculate percentiles across all temperature points
      const sorted = [...temps].sort((a, b) => a - b);
      const p05 = percentile(sorted, 5);
      const p95 = percentile(sorted, 95);
      const med = percentile(sorted, 50);

      // Color by anomaly vs overall median
      const anomalies = temps.map((v: number) => v - med);
      const zmin = Math.min(...anomalies),
        zmax = Math.max(...anomalies);

      const scatter: ScatterPoint[] = rawData.map((d: any, i: number) => ({
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
      const todayPoint: TodayPoint | null =
        props.todayTemp != null && Number.isFinite(Number(props.todayTemp))
          ? {
              x: todayX,
              y: Number(props.todayTemp),
              marker: { radius: 7, lineWidth: 2, lineColor: "#333" },
            }
          : null;

      const yMin = Math.floor(
        Math.min(...temps, todayPoint?.y ?? Math.min(...temps)) - 1
      );
      const yMax = Math.ceil(
        Math.max(...temps, todayPoint?.y ?? Math.max(...temps)) + 1
      );

      // Create trend line data
      const trendLine = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ];

      const config = createScatterChartConfig({
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

      console.log("Generated scatter config: ", config);

      // Use configuration builder instead of inline configuration
      return config;
    } catch (e) {
      console.error("Failed to generate chart options:", e);
      return null;
    }
  });

  console.log("Scatter chart options:", chartOptions());

  return (
    <ChartContainer
      loading={queryResult.isLoading}
      error={queryResult.error?.message || null}
      hasData={!!chartOptions()}
      chartType="scatter"
      loadingMessage={LOADING_MESSAGES.CHART}
    >
      <Highchart options={chartOptions()!} height="360px" />
    </ChartContainer>
  );
}
