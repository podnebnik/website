/**
 * Shared axis configuration builders for temperature charts
 */

import * as Highcharts from "highcharts";
import { COLORS, DIMENSIONS, CHART_STYLES, CHART_DEFAULTS } from "../utils/chartConstants.js";

export interface TemperatureYAxisConfig {
  yMin: number;
  yMax: number;
  title: string;
  p05?: number;
  p95?: number;
  tickAmount?: number;
}

export interface ScatterXAxisConfig {
  xMin: number;
  todayX: number;
}

export interface HistogramXAxisConfig {
  title: string;
  p05: number;
  p50: number;
  p95: number;
  today?: number | null;
  tickAmount?: number;
}

/**
 * Create Y-axis configuration for temperature charts
 */
export function createTemperatureYAxis({
  yMin,
  yMax,
  title,
  p05,
  p95,
  tickAmount = CHART_DEFAULTS.TICK_AMOUNT,
}: TemperatureYAxisConfig): Highcharts.YAxisOptions {
  const plotLines: Highcharts.YAxisPlotLinesOptions[] = [];

  // Add percentile plot lines if provided
  if (p95 !== undefined) {
    plotLines.push({
      value: p95,
      color: COLORS.PERCENTILE_LINE,
      dashStyle: CHART_STYLES.DASH_STYLE,
      width: DIMENSIONS.THIN_LINE,
      zIndex: CHART_STYLES.ANNOTATION_Z,
      label: {
        text: `95th percentile: ${p95.toFixed(1)}°C`,
        align: "right",
        x: 60,
      },
    });
  }

  if (p05 !== undefined) {
    plotLines.push({
      value: p05,
      color: COLORS.PERCENTILE_LINE,
      dashStyle: CHART_STYLES.DASH_STYLE,
      width: DIMENSIONS.THIN_LINE,
      zIndex: CHART_STYLES.ANNOTATION_Z,
      label: {
        text: `5th percentile: ${p05.toFixed(1)}°C`,
        align: "right",
        x: 60,
      },
    });
  }

  return {
    min: yMin,
    max: yMax,
    title: { text: title },
    tickAmount,
    ...(plotLines.length > 0 && { plotLines }),
  };
}

/**
 * Create X-axis configuration for scatter charts (year-based)
 */
export function createScatterXAxis({
  xMin,
  todayX,
}: ScatterXAxisConfig): Highcharts.XAxisOptions {
  return {
    title: { text: null },
    tickInterval: 20,
    min: xMin - 1,
    max: todayX + 1,
    labels: {
      formatter: function (this: Highcharts.AxisLabelsFormatterContextObject) {
        return String(this.value);
      },
    },
  };
}

/**
 * Create X-axis configuration for histogram charts (temperature-based)
 */
export function createHistogramXAxis({
  title,
  p05,
  p50,
  p95,
  today,
  tickAmount = CHART_DEFAULTS.HISTOGRAM_TICK_AMOUNT,
}: HistogramXAxisConfig): Highcharts.XAxisOptions {
  const plotLines: Highcharts.XAxisPlotLinesOptions[] = [
    {
      color: COLORS.PERCENTILE_LINE,
      width: DIMENSIONS.THIN_LINE,
      value: p05,
      dashStyle: CHART_STYLES.DASH_STYLE,
      zIndex: CHART_STYLES.PLOT_LINE_Z,
    },
    {
      color: COLORS.PERCENTILE_LINE,
      width: DIMENSIONS.THIN_LINE,
      value: p50,
      dashStyle: CHART_STYLES.DASH_STYLE,
      zIndex: CHART_STYLES.PLOT_LINE_Z,
    },
    {
      color: COLORS.PERCENTILE_LINE,
      width: DIMENSIONS.THIN_LINE,
      value: p95,
      dashStyle: CHART_STYLES.DASH_STYLE,
      zIndex: CHART_STYLES.PLOT_LINE_Z,
    },
  ];

  // Add today's temperature line if provided
  if (Number.isFinite(today)) {
    plotLines.push({
      color: COLORS.BLACK,
      width: DIMENSIONS.THICK_LINE,
      value: today!,
      dashStyle: CHART_STYLES.SOLID_STYLE,
      zIndex: CHART_STYLES.TODAY_LINE_Z,
    });
  }

  return {
    title: { text: title },
    lineColor: COLORS.LIGHT_BLUE_GRAY,
    tickAmount,
    plotLines,
  };
}

/**
 * Create Y-axis configuration for histogram frequency charts
 */
export function createHistogramYAxis(yMax: number): Highcharts.YAxisOptions {
  return {
    title: { text: "Frekvenca (štetje)" },
    min: 0,
    max: yMax,
    gridLineColor: COLORS.GRID_LINE,
  };
}
