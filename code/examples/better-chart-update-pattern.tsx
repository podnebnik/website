// @ts-nocheck
/**
 * Example of robust chart update pattern using createEffect and setData
 * This pattern should be used to fix the histogram chart TODAY label issue
 */
import { Component, onMount, createEffect } from "solid-js";
import Highcharts from "highcharts";
import { HistoricalData } from "../types/weather"; // Adjust the import path as necessary

interface ScatterChartProps {
  data: HistoricalData[];
  stationName: string;
}

const ScatterChart: Component<ScatterChartProps> = (props) => {
  let chartContainer: HTMLDivElement | undefined;
  let chart: Highcharts.Chart | undefined;

  const processDataForScatter = (data: HistoricalData[]) => {
    // Create different series based on temperature ranges
    const coldSeries: [number, number][] = [];
    const mildSeries: [number, number][] = [];
    const warmSeries: [number, number][] = [];
    const hotSeries: [number, number][] = [];

    data.forEach((point) => {
      const temp = point.temperature;
      const humidity = point.humidity;

      if (temp < 10) {
        coldSeries.push([temp, humidity]);
      } else if (temp < 20) {
        mildSeries.push([temp, humidity]);
      } else if (temp < 30) {
        warmSeries.push([temp, humidity]);
      } else {
        hotSeries.push([temp, humidity]);
      }
    });

    return { coldSeries, mildSeries, warmSeries, hotSeries };
  };

  onMount(() => {
    if (chartContainer) {
      const { coldSeries, mildSeries, warmSeries, hotSeries } =
        processDataForScatter(props.data);

      chart = Highcharts.chart(chartContainer, {
        chart: {
          type: "scatter",
          backgroundColor: "transparent",
          borderRadius: 12,
          zoomType: "xy",
        },
        title: {
          text: `Temperature vs Humidity Correlation - ${props.stationName}`,
          style: {
            fontSize: "18px",
            fontWeight: "600",
            color: "#1e293b",
          },
        },
        subtitle: {
          text: "Click and drag to zoom in. Last 30 days data",
          style: {
            color: "#64748b",
          },
        },
        xAxis: {
          title: {
            text: "Temperature (°C)",
            style: {
              color: "#64748b",
              fontWeight: "600",
            },
          },
          labels: {
            style: {
              color: "#64748b",
            },
          },
          gridLineColor: "#e2e8f0",
          startOnTick: true,
          endOnTick: true,
          showLastLabel: true,
        },
        yAxis: {
          title: {
            text: "Humidity (%)",
            style: {
              color: "#64748b",
              fontWeight: "600",
            },
          },
          labels: {
            style: {
              color: "#64748b",
            },
          },
          gridLineColor: "#e2e8f0",
          min: 0,
          max: 100,
        },
        legend: {
          layout: "horizontal",
          align: "center",
          verticalAlign: "bottom",
          backgroundColor: "rgba(255,255,255,0.9)",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          borderRadius: 8,
          shadow: true,
          itemStyle: {
            color: "#64748b",
          },
        },
        plotOptions: {
          scatter: {
            marker: {
              radius: 6,
              states: {
                hover: {
                  enabled: true,
                  lineColor: "rgb(100,100,100)",
                  radiusPlus: 2,
                },
              },
            },
            states: {
              hover: {
                marker: {
                  enabled: false,
                },
              },
            },
            tooltip: {
              headerFormat: "<b>{series.name}</b><br>",
              pointFormat: "Temperature: {point.x}°C<br/>Humidity: {point.y}%",
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          borderColor: "#e2e8f0",
          borderRadius: 8,
          shadow: true,
          style: {
            color: "#1e293b",
          },
        },
        series: [
          {
            name: "Cold (< 10°C)",
            color: "#3b82f6",
            data: coldSeries,
            marker: {
              symbol: "circle",
              fillColor: "#3b82f6",
              lineColor: "#1e40af",
              lineWidth: 2,
            },
          },
          {
            name: "Mild (10-20°C)",
            color: "#14b8a6",
            data: mildSeries,
            marker: {
              symbol: "diamond",
              fillColor: "#14b8a6",
              lineColor: "#0f766e",
              lineWidth: 2,
            },
          },
          {
            name: "Warm (20-30°C)",
            color: "#f59e0b",
            data: warmSeries,
            marker: {
              symbol: "square",
              fillColor: "#f59e0b",
              lineColor: "#d97706",
              lineWidth: 2,
            },
          },
          {
            name: "Hot (> 30°C)",
            color: "#ef4444",
            data: hotSeries,
            marker: {
              symbol: "triangle",
              fillColor: "#ef4444",
              lineColor: "#dc2626",
              lineWidth: 2,
            },
          },
        ],
        credits: {
          enabled: false,
        },
        exporting: {
          enabled: true,
          buttons: {
            contextButton: {
              menuItems: [
                "viewFullscreen",
                "separator",
                "downloadPNG",
                "downloadJPEG",
                "downloadPDF",
                "downloadSVG",
              ],
            },
          },
        },
      });
    }
  });

  createEffect(() => {
    if (chart && props.data) {
      const { coldSeries, mildSeries, warmSeries, hotSeries } =
        processDataForScatter(props.data);

      chart.series[0].setData(coldSeries, false);
      chart.series[1].setData(mildSeries, false);
      chart.series[2].setData(warmSeries, false);
      chart.series[3].setData(hotSeries, false);

      chart.setTitle({
        text: `Temperature vs Humidity Correlation - ${props.stationName}`,
      });
      chart.redraw();
    }
  });

  return (
    <div class="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
      <div ref={chartContainer} class="h-96"></div>
      <div class="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
        <p class="font-medium mb-2">Chart Features:</p>
        <ul class="space-y-1 text-xs">
          <li>
            • <strong>Zoom:</strong> Click and drag to zoom into specific areas
          </li>
          <li>
            • <strong>Legend:</strong> Click series names to show/hide data
            points
          </li>
          <li>
            • <strong>Export:</strong> Use the menu button (☰) to download the
            chart
          </li>
          <li>
            • <strong>Correlation:</strong> Observe temperature-humidity
            relationships by color/shape
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ScatterChart;
