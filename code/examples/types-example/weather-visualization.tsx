import { Component, createSignal, createEffect, onMount } from "solid-js";
import Highcharts, { Chart, Options } from "highcharts";

// 1. Define props interface for weather visualization
interface WeatherVisualizationProps {
  stationName: string;
  data: TemperatureDataPoint[];
  chartType?: "line" | "column" | "area";
  height?: number;
  showTooltips?: boolean;
  onChartReady?: (chart: Chart) => void;
}

// 2. Define data types
interface TemperatureDataPoint {
  date: string;
  temperature: number;
  min?: number;
  max?: number;
}

// 3. Chart configuration type-safe builders
const createChartOptions = (
  data: TemperatureDataPoint[],
  stationName: string,
  chartType: "line" | "column" | "area" = "line"
): Options => {
  // Transform data for Highcharts
  const chartData = data.map(point => [
    new Date(point.date).getTime(),
    point.temperature
  ]);

  const minMaxData = data
    .filter(point => point.min !== undefined && point.max !== undefined)
    .map(point => [
      new Date(point.date).getTime(),
      point.min!,
      point.max!
    ]);

  return {
    chart: {
      type: chartType,
      backgroundColor: "transparent",
      style: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }
    },
    title: {
      text: `Temperatura - ${stationName}`,
      style: {
        fontSize: "18px",
        fontWeight: "600",
        color: "#1f2937"
      }
    },
    xAxis: {
      type: "datetime",
      title: {
        text: "Datum",
        style: { color: "#6b7280" }
      },
      labels: {
        style: { color: "#6b7280" }
      }
    },
    yAxis: {
      title: {
        text: "Temperatura (°C)",
        style: { color: "#6b7280" }
      },
      labels: {
        style: { color: "#6b7280" }
      },
      gridLineColor: "#f3f4f6"
    },
    tooltip: {
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#e5e7eb",
      borderRadius: 8,
      shadow: true,
      useHTML: true,
      formatter: function() {
        const date = new Highcharts.Time().dateFormat("%d.%m.%Y", this.x as number);
        return `
          <div style="font-size: 12px; padding: 4px;">
            <strong>${date}</strong><br/>
            Temperatura: <span style="color: #3b82f6; font-weight: 600;">${this.y}°C</span>
          </div>
        `;
      }
    },
    legend: {
      enabled: minMaxData.length > 0,
      itemStyle: {
        color: "#6b7280"
      }
    },
    series: [
      {
        name: "Temperatura",
        data: chartData,
        type: chartType,
        color: "#3b82f6",
        fillOpacity: chartType === "area" ? 0.3 : undefined,
        marker: {
          enabled: data.length <= 50,
          radius: 3
        }
      },
      ...(minMaxData.length > 0 ? [{
        name: "Min/Max razpon",
        data: minMaxData,
        type: "arearange" as const,
        color: "#60a5fa",
        fillOpacity: 0.2,
        lineWidth: 0,
        marker: {
          enabled: false
        }
      }] : [])
    ],
    credits: {
      enabled: false
    },
    accessibility: {
      enabled: true,
      description: `Graf temperature za postajo ${stationName}`
    }
  };
};

// 4. Main weather visualization component
const WeatherVisualization: Component<WeatherVisualizationProps> = (props) => {
  let chartContainer: HTMLDivElement | undefined;
  const [chart, setChart] = createSignal<Chart | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  // Create chart on mount
  onMount(() => {
    if (chartContainer && props.data.length > 0) {
      try {
        const options = createChartOptions(
          props.data,
          props.stationName,
          props.chartType
        );

        const chartInstance = Highcharts.chart(chartContainer, {
          ...options,
          chart: {
            ...options.chart,
            height: props.height || 400
          }
        });

        setChart(chartInstance);
        props.onChartReady?.(chartInstance);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to create chart:", error);
        setIsLoading(false);
      }
    }
  });

  // Update chart when data changes
  createEffect(() => {
    const currentChart = chart();
    if (currentChart && props.data.length > 0) {
      const options = createChartOptions(
        props.data,
        props.stationName,
        props.chartType
      );
      
      // Update series data
      const temperatureSeries = currentChart.series[0];
      if (temperatureSeries) {
        const chartData = props.data.map(point => [
          new Date(point.date).getTime(),
          point.temperature
        ]);
        temperatureSeries.setData(chartData);
      }
    }
  });

  return (
    <div class="weather-chart-container">
      {isLoading() && (
        <div class="flex items-center justify-center h-96">
          <div class="text-gray-500">Nalaganje grafa...</div>
        </div>
      )}
      
      <div
        ref={chartContainer}
        class="weather-chart"
        style={{
          width: "100%",
          height: `${props.height || 400}px`,
          display: isLoading() ? "none" : "block"
        }}
      />
    </div>
  );
};

// 5. Usage example component
const WeatherVisualizationExample: Component = () => {
  const [chartType, setChartType] = createSignal<"line" | "column" | "area">("line");
  
  // Mock data for example
  const mockData: TemperatureDataPoint[] = [
    { date: "2025-08-30", temperature: 23.5, min: 18.2, max: 28.1 },
    { date: "2025-08-31", temperature: 25.1, min: 19.5, max: 29.3 },
    { date: "2025-09-01", temperature: 22.8, min: 17.9, max: 27.2 },
    { date: "2025-09-02", temperature: 24.3, min: 20.1, max: 28.8 },
    { date: "2025-09-03", temperature: 26.7, min: 21.4, max: 31.2 },
    { date: "2025-09-04", temperature: 28.1, min: 23.0, max: 32.5 },
    { date: "2025-09-05", temperature: 27.4, min: 22.8, max: 31.8 }
  ];

  const handleChartReady = (chart: Chart) => {
    console.log("Chart ready:", chart);
  };

  return (
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-800">
          TypeScript Highcharts Integration
        </h2>
        
        <div class="flex gap-2">
          <button
            type="button"
            onClick={() => setChartType("line")}
            class={`px-4 py-2 rounded ${
              chartType() === "line" 
                ? "bg-blue-500 text-white" 
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Črta
          </button>
          <button
            type="button"
            onClick={() => setChartType("area")}
            class={`px-4 py-2 rounded ${
              chartType() === "area" 
                ? "bg-blue-500 text-white" 
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Področje
          </button>
          <button
            type="button"
            onClick={() => setChartType("column")}
            class={`px-4 py-2 rounded ${
              chartType() === "column" 
                ? "bg-blue-500 text-white" 
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Stolpci
          </button>
        </div>
      </div>

      <WeatherVisualization
        stationName="Ljubljana"
        data={mockData}
        chartType={chartType()}
        height={400}
        showTooltips={true}
        onChartReady={handleChartReady}
      />

      <div class="text-sm text-gray-600">
        <h3 class="font-semibold mb-2">TypeScript koristi:</h3>
        <ul class="list-disc list-inside space-y-1">
          <li>Tipizirana Highcharts konfiguracija</li>
          <li>Type-safe podatkovni prehodi</li>
          <li>Inteligentno samodokončevanje v IDE</li>
          <li>Ujemanje napak med kompajliranjem</li>
          <li>Ponovno uporabne tipne definicije</li>
        </ul>
      </div>
    </div>
  );
};

export default WeatherVisualization;
export { WeatherVisualizationExample, createChartOptions };
export type { WeatherVisualizationProps, TemperatureDataPoint };
