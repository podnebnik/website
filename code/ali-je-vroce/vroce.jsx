import { Show, onMount } from "solid-js";
import { vrednosti, opisi, percentile_labels } from "./constants.mjs";

// Import custom hooks
import { useWeatherData } from "./hooks/useWeatherData.js";

// Import components
import { StationSelector } from "./components/StationSelector.jsx";
import { TemperatureDisplay } from "./components/TemperatureDisplay.jsx";
import { ErrorMessage } from "./components/ErrorMessage.jsx";
import { LoadingIndicator } from "./components/LoadingIndicator.jsx";

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
        onStationChange,
        retryLoadingData,
        retryLoadingStations
    } = useWeatherData();

    // Initialize data when component mounts
    onMount(() => {
        initialize();
    });


    return (
        <div class="text-center">
            <p class="font-normal text-5xl font-sans text-balance">
                Ali je danes vroče <StationSelector
                    stations={stations()}
                    selectedStation={selectedStation()}
                    stationPrefix={stationPrefix()}
                    isLoading={isLoadingStations()}
                    onStationChange={onStationChange}
                />
            </p>

            {/* Temperature Display */}
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
                labels={percentile_labels}
                values={vrednosti}
                descriptions={opisi}
            />

            {/* Global loading indicator */}
            <LoadingIndicator
                isLoading={isLoadingData() || isLoadingStations()}
                message={isLoadingStations() ? 'Nalaganje postaj...' : 'Nalaganje podatkov o temperaturi...'}
                class="mt-4"
            />

            {/* Error messages */}
            <ErrorMessage
                error={dataError()}
                onRetry={retryLoadingData}
            />

            <ErrorMessage
                error={stationsError()}
                onRetry={retryLoadingStations}
            />
        </div>
    );
}
