import { onMount, Show } from "solid-js";
import { vrednosti, opisi, percentile_labels } from "./constants.ts";

// Import custom hooks
import { useWeatherData } from "./hooks/useWeatherData.ts";

// Import components
import { StationSelector } from "./components/StationSelector.tsx";
import { TemperatureDisplay } from "./components/TemperatureDisplay.tsx";
import { ErrorMessage } from "./components/ErrorMessage.tsx";

// ✅ INSERT: SeasonalScatter (Highcharts #1) - Testing robust versions
import SeasonalScatterRobust from "./charts/SeasonalScatterRobust.tsx";
import SeasonalHistogramRobust from "./charts/SeasonalHistogramRobust.tsx";
import SeasonalHistogram from "./charts/SeasonalHistogram.tsx";
import SeasonalScatter from "./charts/SeasonalScatter.tsx";

/**
 * AliJeVroce is a Solid JS component that displays whether it is hot today in a selected location,
 * based on temperature statistics fetched from a remote API. It shows the minimum, average, and
 * maximum temperatures over the last 24 hours, their respective times, and compares the average
 * temperature to historical percentiles. The component also provides a textual and visual
 * representation of the result, along with the time of the last data update.
 *
 * @component
 * @returns The rendered component displaying temperature statistics and percentile comparison.
 */
export function AliJeVroce() {
  // ✅ INSERT: test flag + today's label for the SeasonalScatter chart
  const isTest = () =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("test") === "1";

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const mmdd = `${mm}-${dd}`;
  const prettyTitle = `Two weeks around ${dd} ${today.toLocaleString("en-US", {
    month: "long",
  })} — history`;

  // Use the custom hook to manage all data and state
  const {
    // Station data
    stations,
    selectedStation,
    stationPrefix,
    isLoadingStations,
    stationsError,

    // Temperature data
    isLoadingData,
    dataError,
    result,
    resultTemperature,
    tempMin,
    timeMin,
    tempMax,
    timeMax,
    tempAvg,
    timeUpdated,

    // Functions
    initialize,
    retryLoadingData,
    retryLoadingStations,
    onStationChange,
  } = useWeatherData();

  // Initialize the component on mount
  onMount(() => {
    initialize();
  });

  return (
    <div class="text-center">
      <h1 class="not-prose font-normal text-5xl font-sans text-balance">
        Ali je danes vroče{" "}
        <StationSelector
          stations={stations()}
          selectedStation={selectedStation()}
          stationPrefix={stationPrefix()}
          isLoading={isLoadingStations()}
          onStationChange={onStationChange}
        />
      </h1>

      <TemperatureDisplay
        result={result()}
        resultTemperature={resultTemperature()}
        tempMin={String(tempMin() ?? "")}
        timeMin={timeMin()}
        tempMax={String(tempMax() ?? "")}
        timeMax={timeMax()}
        tempAvg={String(tempAvg() ?? "")}
        timeUpdated={timeUpdated()}
        isLoading={isLoadingData()}
        isStale={false}
        labels={percentile_labels}
        values={vrednosti}
        descriptions={opisi}
      />

      <ErrorMessage error={dataError() || ""} onRetry={retryLoadingData} />

      <ErrorMessage
        error={stationsError() || ""}
        onRetry={retryLoadingStations}
      />
      {/* ✅ INSERT: test-only SeasonalScatter chart (uses current station + today's MM-DD) */}
      <Show when={isTest()}>
        <div class="mt-10">
          <SeasonalHistogramRobust
            stationId={selectedStation()?.station_id ?? 14}
            center_mmdd={mmdd}
            todayTemp={(() => {
              const temp = tempAvg() ? +tempAvg()! : null;
              console.log(
                "Histogram todayTemp:",
                temp,
                "station:",
                selectedStation()?.station_id
              );
              return temp;
            })()}
            title={`Distribution around ${mmdd}`}
          />
        </div>
        <div class="mt-10">
          <SeasonalHistogram
            stationId={selectedStation()?.station_id ?? 14}
            center_mmdd={mmdd}
            todayTemp={(() => {
              const temp = tempAvg() ? +tempAvg()! : null;
              console.log(
                "Histogram todayTemp:",
                temp,
                "station:",
                selectedStation()?.station_id
              );
              return temp;
            })()}
            title={`Distribution around ${mmdd}`}
          />
        </div>
        <div class="mt-6">
          <SeasonalScatterRobust
            stationId={selectedStation()?.station_id ?? 14}
            center_mmdd={mmdd}
            todayTemp={(() => {
              const temp = tempAvg() ? +tempAvg()! : null;
              console.log(
                "Scatter todayTemp:",
                temp,
                "station:",
                selectedStation()?.station_id
              );
              return temp;
            })()}
            title={prettyTitle}
          />
        </div>
        <div class="mt-6">
          <SeasonalScatter
            stationId={selectedStation()?.station_id ?? 14}
            center_mmdd={mmdd}
            todayTemp={(() => {
              const temp = tempAvg() ? +tempAvg()! : null;
              console.log(
                "Scatter todayTemp:",
                temp,
                "station:",
                selectedStation()?.station_id
              );
              return temp;
            })()}
            title={prettyTitle}
          />
        </div>
      </Show>
    </div>
  );
}
