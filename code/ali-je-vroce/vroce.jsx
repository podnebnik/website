import { onMount, createSignal, onCleanup } from "solid-js";
import { vrednosti, opisi, percentile_labels } from "./constants.mjs";

// Import custom hooks
import { useWeatherData } from "./hooks/useWeatherData.js";
import { throttle } from "./utils/debounce.js";
import { announce } from "./utils/a11y.js";

// Import components
import { StationSelector } from "./components/StationSelector.jsx";
import { TemperatureDisplay } from "./components/TemperatureDisplay.jsx";
import { ErrorMessage } from "./components/ErrorMessage.jsx";

// ✅ INSERT: SeasonalScatter (Highcharts #1)
import SeasonalScatter from "./charts/SeasonalScatter.jsx";
import SeasonalHistogram from "./charts/SeasonalHistogram.jsx";

/**
 * AliJeVroce is a Solid JS component that displays whether it is hot today in a selected location,
 * based on temperature statistics fetched from a remote API. It shows the minimum, average, and
 * maximum temperatures over the last 24 hours, their respective times, and compares the average
 * temperature to historical percentiles. The component also provides a textual and visual
 * representation of the result, along with the time of the last data update.
 *
 * @component
 * @returns {JSX.Element} The rendered component displaying temperature statistics and percentile comparison.
 */
export function AliJeVroce() {
  const [mainContentId] = createSignal("main-content");
  console.log("AliJeVroce component rendered");

  /**
   * Signal to hold the result of the temperature percentile comparison.
   * It indicates how the current average temperature compares to historical data.
   * Possible values are 'p00', 'p05', 'p20', 'p40', 'p60', 'p80', 'p95', or an empty string if no data is available.
   * @type {import('solid-js').Signal<PercentileKey>}
   * @see {@link https://solidjs.com/docs/api#createsignal}
   */
  const [result, setResult] = createSignal("");
  const [resultTemperature, setResultTemperature] = createSignal("");
  const [tempMin, setTempMin] = createSignal("");
  const [timeMin, setTimeMin] = createSignal("");
  const [tempMax, setTempMax] = createSignal("");
  const [timeMax, setTimeMax] = createSignal("");
  const [tempAvg, setTempAvg] = createSignal("");
  const [timeUpdated, setTimeUpdated] = createSignal("");

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

  function updateData({ resultValue, resultTemperatureValue }) {
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
    } = useWeatherData();

    const [isDataStale, setIsDataStale] = createSignal(false);
    {
      setResultTemperature(`${resultTemperatureValue} °C`);
      setTempMin(tempMin);
      setTimeMin(timeMin);
      setTempMax(tempMax);
      setTimeMax(timeMax);
      setTempAvg(tempAvg);
      setTimeUpdated(timeUpdated);
      setResult(resultValue);
    }

    onMount(async () => {
      const results = await requestData(selectedStation().value);
      if (!results.success) {
        console.error("Failed to load data for station:", results.error);
        return;
      }
      updateData(results.data);
      const stationsList = await loadStations();
      if (!stationsList.success) {
        console.error("Failed to load stations:", stationsList.error);
        return;
      }
      setStations(stationsList.stations);
    });

    async function onStationChange(station) {
      setStationPrefix(station.prefix);
      setSelectedStation(station);
      const results = await requestData(station.value);
      if (!results.success) {
        console.error("Failed to load data for station:", results.error);
        return;
      }
      updateData(results.data);
    }

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
          tempMin={tempMin()}
          timeMin={timeMin()}
          tempMax={tempMax()}
          timeMax={timeMax()}
          tempAvg={tempAvg()}
          timeUpdated={timeUpdated()}
          isLoading={isLoadingData() || dataError() !== null}
          isStale={isDataStale()}
          labels={percentile_labels}
          values={vrednosti}
          descriptions={opisi}
        />

        <ErrorMessage error={dataError()} onRetry={retryLoadingData} />

        <ErrorMessage error={stationsError()} onRetry={retryLoadingStations} />
        {/* ✅ INSERT: test-only SeasonalScatter chart (uses current station + today's MM-DD) */}
        <Show when={isTest()}>
          <div class="mt-10">
            <SeasonalHistogram
              stationId={selectedStation()?.value ?? DEFAULT_STATION}
              center_mmdd={mmdd}
              todayTemp={+tempAvg() || null}
              title={`Distribution around ${mmdd}`}
            />
          </div>
          <div class="mt-6">
            <SeasonalScatter
              stationId={selectedStation()?.value ?? DEFAULT_STATION}
              center_mmdd={mmdd}
              todayTemp={+tempAvg() || null} // 🔥 pass current daily average from API
              title={prettyTitle}
            />
          </div>
        </Show>
      </div>
    );
  }
}
