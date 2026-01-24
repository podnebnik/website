/**
 * Shared tooltip and legend configuration builders for charts
 */

import * as Highcharts from "highcharts";
import { CHART_DEFAULTS } from "./chartConstants.js";

/**
 * Create tooltip configuration for scatter charts
 */
export function createScatterTooltip(todayLabel: string): Highcharts.TooltipOptions {
  return {
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
      const offTxt =
        off || off === 0 ? ` (offset ${off >= 0 ? "+" : ""}${off}d)` : "";
      return `Leto: <b>${(this as any).x}</b>${offTxt}<br/>Dan: ${day}<br/>Povprečna temp.: <b>${(
        this as any
      ).y!.toFixed(1)}°C</b>`;
    },
  };
}

/**
 * Create tooltip configuration for histogram charts
 */
export function createHistogramTooltip(): Highcharts.TooltipOptions {
  return {
    shared: false,
    headerFormat: "",
    pointFormat: "<b>{point.x:.1f}°C</b><br/>Ocena števila dni: {point.y:.0f}",
  };
}

/**
 * Create standard legend configuration (typically disabled for these charts)
 */
export function createChartLegend(enabled: boolean = CHART_DEFAULTS.LEGEND_ENABLED): Highcharts.LegendOptions {
  return {
    enabled,
  };
}

/**
 * Create annotation configuration for trend display
 */
export function createTrendAnnotation(
  xMin: number,
  xMax: number,
  trendLine: Array<{ x: number; y: number }>,
  trendPerCentury: number
): Highcharts.AnnotationsOptions[] {
  return [
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
          backgroundColor: "rgba(255,255,255,0.7)",
          borderColor: "#333",
          style: { fontSize: "12px" },
        },
      ],
    },
  ];
}
