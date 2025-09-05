import { Component, createSignal, createEffect, onMount } from "solid-js";
import Highcharts, { Chart, Options } from "highcharts";

/**
 * TypeScript Example: SolidJS + Highcharts Integration
 *
 * This component demonstrates:
 * - Interface-based prop typing
 * - Generic type constraints with union types
 * - Optional parameters with defaults
 * - Type-safe event handlers
 * - External library type integration (Highcharts)
 */

// 1. Define props interface for weather visualization
interface WeatherVisualizationProps {
  /** Station name displayed in chart title */
  stationName: string;
  /** Temperature data points to visualize */
  data: TemperatureDataPoint[];
  /** Chart visualization type - defaults to 'line' */
  chartType?: "line" | "column" | "area";
  /** Chart height in pixels - defaults to 400 */
  height?: number;
  /** Whether to show interactive tooltips */
  showTooltips?: boolean;
  /** Callback fired when chart is initialized */
  onChartReady?: (chart: Chart) => void;
}

// 2. Define data types with optional properties
interface TemperatureDataPoint {
  /** ISO date string */
  date: string;
  /** Average temperature in Celsius */
  temperature: number;
  /** Minimum temperature (optional) */
  min?: number;
  /** Maximum temperature (optional) */
  max?: number;
}

/**
 * TypeScript Example: Type-Safe Chart Configuration Builder
 *
 * Demonstrates:
 * - Explicit return type (Highcharts.Options)
 * - Default parameters with type annotations
 * - Array transformation with type safety
 * - Conditional type mapping for series data
 */
// 3. Chart configuration type-safe builders
const createChartOptions = (
  data: TemperatureDataPoint[],
  stationName: string,
  chartType: "line" | "column" | "area" = "line",
  showTooltips: boolean = true
): Options => {
  // Transform data for Highcharts - explicit typing for clarity
  const chartData: [number, number][] = data.map(
    (point: TemperatureDataPoint): [number, number] => [
      new Date(point.date).getTime(),
      point.temperature,
    ]
  );

  // Filter and transform min/max data with proper type guards
  const minMaxData: [number, number, number][] = data
    .filter(
      (point): point is TemperatureDataPoint & { min: number; max: number } =>
        point.min !== undefined && point.max !== undefined
    )
    .map((point): [number, number, number] => [
      new Date(point.date).getTime(),
      point.min,
      point.max,
    ]);

  return {
    chart: {
      type: chartType,
      backgroundColor: "transparent",
      style: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      },
    },
    title: {
      text: `Temperatura - ${stationName}`,
      style: {
        fontSize: "18px",
        fontWeight: "600",
        color: "#1f2937",
      },
    },
    xAxis: {
      type: "datetime",
      title: {
        text: "Datum",
        style: { color: "#6b7280" },
      },
      labels: {
        style: { color: "#6b7280" },
      },
    },
    yAxis: {
      title: {
        text: "Temperatura (°C)",
        style: { color: "#6b7280" },
      },
      labels: {
        style: { color: "#6b7280" },
      },
      gridLineColor: "#f3f4f6",
    },
    tooltip: {
      enabled: showTooltips,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#e5e7eb",
      borderRadius: 8,
      shadow: true,
      useHTML: true,
      formatter: function () {
        const date = new Highcharts.Time().dateFormat(
          "%d.%m.%Y",
          this.x as number
        );
        return `
          <div style="font-size: 12px; padding: 4px;">
            <strong>${date}</strong><br/>
            Temperatura: <span style="color: #3b82f6; font-weight: 600;">${this.y}°C</span>
          </div>
        `;
      },
    },
    legend: {
      enabled: minMaxData.length > 0,
      itemStyle: {
        color: "#6b7280",
      },
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
          radius: 3,
        },
      },
      ...(minMaxData.length > 0
        ? [
            {
              name: "Min/Max razpon",
              data: minMaxData,
              type: "arearange" as const, // TypeScript: 'as const' ensures literal type instead of string
              color: "#60a5fa",
              fillOpacity: 0.2,
              lineWidth: 0,
              marker: {
                enabled: false,
              },
            },
          ]
        : []), // TypeScript: Conditional spread demonstrates array type inference
    ],
    credits: {
      enabled: false,
    },
    accessibility: {
      enabled: true,
      description: `Graf temperature za postajo ${stationName}`,
    },
  };
};

/**
 * TypeScript Example: SolidJS Component with External Library Integration
 *
 * Demonstrates:
 * - Component generic type constraints (Component<Props>)
 * - Signal typing with explicit generics (createSignal<T>)
 * - Ref element typing (HTMLDivElement | undefined)
 * - Optional chaining with type-safe event callbacks
 * - Error boundary patterns with try-catch blocks
 */
// 4. Main weather visualization component
const WeatherVisualization: Component<WeatherVisualizationProps> = (props) => {
  // TypeScript: HTMLDivElement union with undefined for uninitialized refs
  let chartContainer: HTMLDivElement | undefined;

  // TypeScript: Explicit generic typing for signals - Chart comes from Highcharts
  const [chart, setChart] = createSignal<Chart | null>(null);
  const [isLoading, setIsLoading] = createSignal<boolean>(true);

  // TypeScript: SolidJS lifecycle hook with type-safe DOM manipulation
  onMount(() => {
    if (chartContainer && props.data.length > 0) {
      try {
        const options = createChartOptions(
          props.data,
          props.stationName,
          props.chartType,
          props.showTooltips
        );

        // TypeScript: Highcharts.chart returns Chart type, ensuring type safety
        const chartInstance = Highcharts.chart(chartContainer, {
          ...options, // TypeScript: Spread operator with Options type
          chart: {
            ...options.chart,
            height: props.height || 400, // TypeScript: Nullish coalescing with number fallback
          },
        });

        setChart(chartInstance);
        // TypeScript: Optional chaining prevents runtime errors if callback undefined
        props.onChartReady?.(chartInstance);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to create chart:", error);
        setIsLoading(false);
      }
    }
  });

  // TypeScript: Reactive effect with signal dependency tracking
  createEffect(() => {
    const currentChart = chart();
    if (currentChart && props.data.length > 0) {
      const options = createChartOptions(
        props.data,
        props.stationName,
        props.chartType,
        props.showTooltips
      );

      // TypeScript: External library method call with Options type validation
      currentChart.update(options);
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
          display: isLoading() ? "none" : "block",
        }}
      />
    </div>
  );
};

/**
 * TypeScript Example: Complete Usage Component
 *
 * Demonstrates:
 * - Union type constraints for signal state
 * - Typed array literals with interface compliance
 * - Event handler typing with proper parameters
 * - Template literal types in conditional class names
 * - Module export patterns with type exports
 */
// 5. Usage example component
const WeatherVisualizationExample: Component = () => {
  // TypeScript: Signal with explicit union type constraint
  const [chartType, setChartType] = createSignal<"line" | "column" | "area">(
    "line"
  );

  // TypeScript: Typed array literal ensuring interface compliance
  const mockData: TemperatureDataPoint[] = [
    { date: "2025-08-30", temperature: 23.5, min: 18.2, max: 28.1 },
    { date: "2025-08-31", temperature: 25.1, min: 19.5, max: 29.3 },
    { date: "2025-09-01", temperature: 22.8, min: 17.9, max: 27.2 },
    { date: "2025-09-02", temperature: 24.3, min: 20.1, max: 28.8 },
    { date: "2025-09-03", temperature: 26.7, min: 21.4, max: 31.2 },
    { date: "2025-09-04", temperature: 28.1, min: 23.0, max: 32.5 },
    { date: "2025-09-05", temperature: 27.4, min: 22.8, max: 31.8 },
  ];

  // TypeScript: Event handler with explicit parameter typing
  const handleChartReady = (chart: Chart): void => {
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
