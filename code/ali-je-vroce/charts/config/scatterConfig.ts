/**
 * Configuration builders for scatter chart components
 */

import * as Highcharts from "highcharts";
import { COLORS, DIMENSIONS, CHART_STYLES, CHART_DEFAULTS } from "../../utils/chartConstants.ts";

export interface ScatterPoint {
  x: number;
  y: number;
  day_offset: number | null;
  marker: {
    radius: number;
    fillColor: string;
  };
}

export interface TodayPoint {
  x: number;
  y: number;
  marker: {
    radius: number;
    lineWidth: number;
    lineColor: string;
  };
}

export interface ScatterConfigParams {
  title: string;
  xMin: number;
  xMax: number;
  todayX: number;
  yMin: number;
  yMax: number;
  p05: number;
  p95: number;
  scatter: ScatterPoint[];
  trendLine: Array<{ x: number; y: number }>;
  todayPoint: TodayPoint | null; // Make optional
  trendPerCentury: number;
  todayLabel: string;
}

/**
 * Create base chart configuration for scatter plots
 */
export function createScatterChartConfig({
  title,
  xMin,
  xMax,
  todayX,
  yMin,
  yMax,
  p05,
  p95,
  scatter,
  trendLine,
  todayPoint,
  trendPerCentury,
  todayLabel,
}: ScatterConfigParams): Highcharts.Options {
  console.log(
    "🔥 Scatter Config - TODAY series creation:",
    "todayPoint:",
    todayPoint,
    "todayLabel:",
    todayLabel,
    "adding TODAY series:",
    !!todayPoint
  );

  return {
    chart: {
      type: "scatter",
      spacingRight: DIMENSIONS.SPACING_RIGHT,
      backgroundColor: CHART_DEFAULTS.BACKGROUND_COLOR,
    },
    title: {
      text: title,
    },
    xAxis: {
      title: { text: null },
      tickInterval: 20,
      min: xMin - 1,
      max: todayX + 1,
      labels: {
        formatter: function (this: Highcharts.AxisLabelsFormatterContextObject) {
          return String(this.value);
        },
      },
    },
    yAxis: {
      min: yMin,
      max: yMax,
      title: { text: "Daily average temperature (°C)" },
      tickAmount: CHART_DEFAULTS.TICK_AMOUNT,
      plotLines: [
        {
          value: p95,
          color: COLORS.PERCENTILE_LINE,
          dashStyle: CHART_STYLES.DASH_STYLE,
          width: DIMENSIONS.THIN_LINE,
          zIndex: CHART_STYLES.ANNOTATION_Z,
          label: {
            text: `95th percentile: ${p95.toFixed(1)}°C`,
            align: "right" as const,
            x: 60,
          },
        },
        {
          value: p05,
          color: COLORS.PERCENTILE_LINE,
          dashStyle: CHART_STYLES.DASH_STYLE,
          width: DIMENSIONS.THIN_LINE,
          zIndex: CHART_STYLES.ANNOTATION_Z,
          label: {
            text: `5th percentile: ${p05.toFixed(1)}°C`,
            align: "right" as const,
            x: 60,
          },
        },
      ],
    },
    legend: { enabled: CHART_DEFAULTS.LEGEND_ENABLED },
    tooltip: {
      useHTML: true,
      formatter: function () {
        if ((this as any).series.name === "Trend") return false;
        if ((this as any).series.name === todayLabel) {
          return `<b>${todayLabel}</b>: ${(this as any).y!.toFixed(1)}°C`;
        }
        const point = (this as any).point;
        const off = point?.day_offset;
        const offTxt = off || off === 0 ? ` (offset ${off >= 0 ? "+" : ""}${off}d)` : "";
        return `Year: <b>${(this as any).x}</b>${offTxt}<br/>Tavg: <b>${(this as any).y!.toFixed(1)}°C</b>`;
      },
    },
    annotations: [
      {
        labels: [
          {
            point: {
              x: (xMin + xMax) / 2,
              y: (trendLine[0]!.y + trendLine[1]!.y) / 2,
              xAxis: 0,
              yAxis: 0,
            },
            text: `Trend: ${trendPerCentury >= 0 ? "+" : ""}${trendPerCentury.toFixed(1)}°C / century`,
            backgroundColor: COLORS.ANNOTATION_BACKGROUND,
            borderColor: COLORS.DARK_GRAY,
            style: { fontSize: CHART_STYLES.FONT_SIZE_SMALL },
          },
        ],
      },
    ],
    series: [
      createHistorySeries(scatter),
      createTrendSeries(trendLine),
      ...(todayPoint ? [createTodaySeries(todayPoint, todayLabel)] : []),
    ],
    credits: { enabled: CHART_DEFAULTS.CREDITS_ENABLED },
  };
}

/**
 * Create the historical data scatter series
 */
export function createHistorySeries(scatter: ScatterPoint[]): Highcharts.SeriesOptionsType {
  return {
    name: "History",
    type: "scatter",
    data: scatter,
    marker: {
      symbol: "circle",
      states: {
        hover: { enabled: true },
      },
    },
  };
}

/**
 * Create the trend line series
 */
export function createTrendSeries(trendLine: Array<{ x: number; y: number }>): Highcharts.SeriesOptionsType {
  return {
    name: "Trend",
    type: "line",
    data: trendLine,
    color: COLORS.TREND_LINE,
    enableMouseTracking: false,
  };
}

/**
 * Create the "today" point series with data label
 */
export function createTodaySeries(todayPoint: TodayPoint, todayLabel: string): Highcharts.SeriesOptionsType {
  return {
    name: todayLabel,
    type: "scatter",
    data: [todayPoint],
    marker: {
      symbol: "circle",
      fillColor: COLORS.WHITE,
      lineWidth: DIMENSIONS.MEDIUM_LINE,
      lineColor: COLORS.TODAY_MARKER,
    },
    dataLabels: [
      {
        enabled: true,
        align: "left" as const,
        format: `${todayLabel}<br/>{point.y:.1f}°C`,
        x: 8,
        y: 4,
        style: { fontWeight: "600" },
      },
    ],
  };
}
