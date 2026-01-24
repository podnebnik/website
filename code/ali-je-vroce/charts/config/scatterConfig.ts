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
  p05,
  p95,
  scatter,
  trendLine,
  todayPoint,
  trendPerCentury,
  todayLabel,
}: ScatterConfigParams): Highcharts.Options {

  // Find actual scatter data bounds for Y-axis
  const scatterYValues = scatter.map(point => point.y);
  const todayY = todayPoint?.y;
  const allYValues = todayY !== undefined ? [...scatterYValues, todayY] : scatterYValues;
  const dataYMin = Math.min(...allYValues);
  const dataYMax = Math.max(...allYValues);
  
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
      min: dataYMin,
      max: dataYMax,
      startOnTick: false,
      endOnTick: false,
      showFirstLabel: true,
      showLastLabel: true,
      tickInterval: 2, // Show tick every 2°C
      title: { text: "Povprečna dnevna temperatura (°C)" },
      plotLines: [
        {
          value: p95,
          color: COLORS.PERCENTILE_LINE,
          dashStyle: CHART_STYLES.DASH_STYLE,
          width: DIMENSIONS.THIN_LINE,
          zIndex: CHART_STYLES.ANNOTATION_Z,
          label: {
            text: `95. percentil: ${p95.toFixed(1)}°C`,
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
            text: `5. percentil: ${p05.toFixed(1)}°C`,
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
        const day = point?.date ? point?.date.toLocaleString("sl-SI", {
          day: "numeric",
          month: "long",
        }) : null;
        const off = point?.day_offset;
        const offTxt = off || off === 0 ? ` (offset ${off >= 0 ? "+" : ""}${off}d)` : "";
        return `Leto: <b>${(this as any).x}</b>${offTxt}<br/>Dan: <b>${day}</b><br/>Povprečna temp.: <b>${(this as any).y!.toFixed(1)}°C</b>`;
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
      radius: 8,
    },
    dataLabels: {
      enabled: true,
      allowOverlap: true,
      align: "left" as const,
      verticalAlign: "middle" as const,
      format: `{series.name}<br/>{point.y:.1f}°C`,
      x: 5,   // Smaller offset to stay within chart boundaries
      y: 0,   // Vertically centered
      style: { 
        fontWeight: "bold",
        color: COLORS.BLACK,
        fontSize: "13px",
        textOutline: "2px white"
      },
      crop: false,
      overflow: "allow"
    },
  };
}
