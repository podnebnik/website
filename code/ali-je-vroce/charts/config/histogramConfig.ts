/**
 * Configuration builders for histogram chart components
 */

import * as Highcharts from "highcharts";
import { COLORS, DIMENSIONS, CHART_STYLES, CHART_DEFAULTS } from "../../utils/chartConstants.ts";

export interface HistogramConfigParams {
  left: [number, number | null][];
  mid: [number, number | null][];
  right: [number, number | null][];
  p05: number;
  p50: number;
  p95: number;
  today: number | null;
  yMax: number;
  title: string;
}

export interface LabelPointConfig {
  topFrac?: number;
  dx?: number;
  color?: string;
  bold?: boolean;
  size?: string;
}

/**
 * Create base chart configuration for histogram plots
 */
export function createHistogramChartConfig({
  left,
  mid,
  right,
  p05,
  p50,
  p95,
  today,
  yMax,
  title,
}: HistogramConfigParams): Highcharts.Options {
  const labelSeries = createLabelSeries(p05, p50, p95, yMax);
  
  // Create TODAY marker series if today value is valid
  const todaySeries = Number.isFinite(today) 
    ? createTodayMarkerSeries(today!, yMax)
    : null;
    
  const xAxisMin = left[0]?.[0] ?? null;
  const xAxisMax = right[right.length - 1]?.[0] ?? null;

  return {
    chart: {
      type: "areaspline",
      backgroundColor: CHART_DEFAULTS.BACKGROUND_COLOR,
      spacingTop: DIMENSIONS.SPACING_TOP,
      spacingRight: DIMENSIONS.SPACING_RIGHT_SMALL,
      spacingLeft: DIMENSIONS.SPACING_LEFT,
    },
    title: { text: title, y: 10 },
    xAxis: {
      min: xAxisMin ? xAxisMin - 0.5 : null,
      max: xAxisMax ? xAxisMax + 0.5 : null,
      startOnTick: false,
      endOnTick: false,
      showFirstLabel: true,
      showLastLabel: true,
      tickInterval: 2, // Show tick every 2°C
      title: { text: "Povprečna dnevna temperatura (°C)" },
      lineColor: COLORS.LIGHT_BLUE_GRAY,
      plotLines: [
        { 
          color: COLORS.PERCENTILE_LINE, 
          width: DIMENSIONS.THIN_LINE, 
          value: p05, 
          dashStyle: CHART_STYLES.DASH_STYLE, 
          zIndex: CHART_STYLES.PLOT_LINE_Z 
        },
        { 
          color: COLORS.PERCENTILE_LINE, 
          width: DIMENSIONS.THIN_LINE, 
          value: p50, 
          dashStyle: CHART_STYLES.DASH_STYLE, 
          zIndex: CHART_STYLES.PLOT_LINE_Z 
        },
        { 
          color: COLORS.PERCENTILE_LINE, 
          width: DIMENSIONS.THIN_LINE, 
          value: p95, 
          dashStyle: CHART_STYLES.DASH_STYLE, 
          zIndex: CHART_STYLES.PLOT_LINE_Z 
        },
        ...(Number.isFinite(today)
          ? [
              {
                color: COLORS.BLACK,
                width: DIMENSIONS.THICK_LINE,
                value: today!,
                dashStyle: CHART_STYLES.SOLID_STYLE,
                zIndex: CHART_STYLES.TODAY_LINE_Z,
              },
            ]
          : []),
      ],
    },
    yAxis: {
      title: { text: "Število dni med 1950 in 2025" },
      min: 0,
      max: yMax,
      gridLineColor: COLORS.GRID_LINE,
    },
    legend: { enabled: CHART_DEFAULTS.LEGEND_ENABLED },
    tooltip: {
      shared: false,
      headerFormat: "",
      pointFormat: "<b>{point.x:.1f}°C</b><br/>Ocena števila dni: {point.y:.0f}",
    },
    series: [
      createColdAreaSeries(left),
      createNormalAreaSeries(mid),
      createHotAreaSeries(right),
      labelSeries,
      ...(todaySeries ? [todaySeries] : []),
    ],
    credits: { enabled: CHART_DEFAULTS.CREDITS_ENABLED },
  };
}

/**
 * Create a label point for percentile and today markers
 */
export function createLabelPoint(
  x: number,
  text: string,
  yMax: number,
  cfg: LabelPointConfig = {}
) {
  return {
    x,
    y: yMax * (cfg.topFrac ?? 0.96),
    marker: { enabled: false },
    dataLabels: {
      enabled: true,
      rotation: -90,
      align: "center" as const,
      verticalAlign: "top" as const,
      y: 0,
      x: cfg.dx ?? 0,
      style: {
        color: cfg.color ?? COLORS.GRAY,
        fontWeight: cfg.bold ? "700" : "500",
        fontSize: cfg.size ?? CHART_STYLES.FONT_SIZE_SMALL,
        textOutline: "none",
      },
      crop: false,
      overflow: "allow" as const,
      format: text,
    },
  };
}

/**
 * Create a TODAY marker series with horizontal positioning similar to scatter charts
 */
export function createTodayMarkerSeries(
  x: number,
  yMax: number
): Highcharts.SeriesOptionsType {
  return {
    name: "TODAY",
    type: "scatter",
    data: [{
      x,
      y: yMax * 0.85, // Position near the top for better visibility
    }],
    marker: { 
      enabled: true,
      symbol: "circle",
      fillColor: COLORS.WHITE,
      lineWidth: 3,
      lineColor: COLORS.TODAY_MARKER,
      radius: 8,
    },
    zIndex: 5, // Higher z-index to ensure visibility over other series
    dataLabels: {
      enabled: true,
      align: "center" as const,
      verticalAlign: "bottom" as const,
      format: `DANES<br/>${x.toFixed(1)}°C`,
      x: 0, // Centered horizontally on the marker
      y: -15, // Position above the marker
      style: {
        fontWeight: "700",
        color: COLORS.BLACK,
        fontSize: CHART_STYLES.FONT_SIZE_MEDIUM, // Match scatter chart font size
        textOutline: "2px white", // Thinner outline
      },
      crop: false,
      overflow: "allow" as const,
    },
    enableMouseTracking: false,
    showInLegend: false,
  };
}

/**
 * Create the label series for percentile markers and today point
 */
export function createLabelSeries(
  p05: number,
  p50: number,
  p95: number,
  yMax: number
): Highcharts.SeriesOptionsType {
  const labelPoints = [
    createLabelPoint(p05, "5. percentil", yMax, { dx: -10 }),
    createLabelPoint(p50, "50. percentil", yMax),
    createLabelPoint(p95, "95. percentil", yMax, { dx: 10 }),
  ];

  // Note: TODAY label is now handled by separate series in createHistogramChartConfig
  // No longer added to this labelPoints array

  const labelSeries: Highcharts.SeriesOptionsType = {
    name: "labels",
    type: "scatter",
    data: labelPoints,
    enableMouseTracking: false,
    showInLegend: false,
  };
  
  return labelSeries;
}

/**
 * Create the cold area series (≤ 5th percentile)
 */
export function createColdAreaSeries(data: [number, number | null][]): Highcharts.SeriesOptionsType {
  return {
    name: "≤ 5.",
    type: "areaspline",
    data,
    color: COLORS.COLD_AREA,
    fillOpacity: CHART_STYLES.FILL_OPACITY_HIGH,
    lineWidth: DIMENSIONS.MEDIUM_LINE,
    marker: { enabled: false },
    enableMouseTracking: true,
  };
}

/**
 * Create the normal area series (5th-95th percentile)
 */
export function createNormalAreaSeries(data: [number, number | null][]): Highcharts.SeriesOptionsType {
  return {
    name: "5.–95.",
    type: "areaspline",
    data,
    color: COLORS.NORMAL_AREA,
    fillOpacity: CHART_STYLES.FILL_OPACITY_MEDIUM,
    lineWidth: DIMENSIONS.MEDIUM_LINE,
    marker: { enabled: false },
    enableMouseTracking: true,
  };
}

/**
 * Create the hot area series (≥ 95th percentile)
 */
export function createHotAreaSeries(data: [number, number | null][]): Highcharts.SeriesOptionsType {
  return {
    name: "≥ 95.",
    type: "areaspline",
    data,
    color: COLORS.HOT_AREA,
    fillOpacity: CHART_STYLES.FILL_OPACITY_MEDIUM,
    lineWidth: DIMENSIONS.MEDIUM_LINE,
    marker: { enabled: false },
    enableMouseTracking: true,
  };
}
