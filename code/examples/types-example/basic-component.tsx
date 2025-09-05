import { Component, createSignal } from "solid-js";

// 1. Define props interface
interface WeatherCardProps {
  stationName: string;
  temperature?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

// 2. Define internal state types
interface WeatherState {
  lastUpdated: Date | null;
  refreshCount: number;
}

// 3. Basic SolidJS component with TypeScript
const WeatherCard: Component<WeatherCardProps> = (props) => {
  // Typed signals
  const [state, setState] = createSignal<WeatherState>({
    lastUpdated: null,
    refreshCount: 0
  });

  // Event handler with proper typing
  const handleRefresh = () => {
    props.onRefresh?.();
    setState(prev => ({
      ...prev,
      lastUpdated: new Date(),
      refreshCount: prev.refreshCount + 1
    }));
  };

  // Computed value with type inference
  const displayTemperature = () => {
    if (props.isLoading) return "Nalaganje...";
    if (props.temperature === undefined) return "Ni podatka";
    return `${props.temperature}°C`;
  };

  return (
    <div class="weather-card bg-white rounded-lg shadow-md p-4">
      <h3 class="text-lg font-semibold text-gray-800">
        {props.stationName}
      </h3>
      
      <div class="temperature text-2xl font-bold text-blue-600 mt-2">
        {displayTemperature()}
      </div>

      {state().lastUpdated && (
        <p class="text-sm text-gray-500 mt-2">
          Zadnja posodobitev: {state().lastUpdated!.toLocaleTimeString()}
          (Posodobitev #{state().refreshCount})
        </p>
      )}

      <button 
        type="button"
        onClick={handleRefresh}
        disabled={props.isLoading}
        class="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {props.isLoading ? "Posodabljam..." : "Posodobi"}
      </button>
    </div>
  );
};

// 4. Usage example with proper typing
const WeatherCardExample: Component = () => {
  const [loading, setLoading] = createSignal(false);
  const [temp, setTemp] = createSignal<number | undefined>(23.5);

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setTemp(Math.round(Math.random() * 30 + 10));
      setLoading(false);
    }, 1000);
  };

  return (
    <div class="p-4">
      <h2 class="text-xl font-bold mb-4">TypeScript Component Example</h2>
      
      <WeatherCard 
        stationName="Ljubljana"
        temperature={temp()}
        isLoading={loading()}
        onRefresh={handleRefresh}
      />
    </div>
  );
};

export default WeatherCard;
export { WeatherCardExample };
export type { WeatherCardProps, WeatherState };
