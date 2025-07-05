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
    // Track whether keyboard navigation is being used
    const [isKeyboardUser, setIsKeyboardUser] = createSignal(false);
    const [mainContentId] = createSignal('main-content');

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
        onStationChange: rawOnStationChange,
        retryLoadingData,
        retryLoadingStations
    } = useWeatherData();

    // Throttle the station change handler to prevent excessive API calls
    const onStationChange = throttle((station) => {
        rawOnStationChange(station);
        // Announce station change to screen readers
        announce(`Izbrana lokacija ${station.label}`, 'polite');
    }, 300);


    // Create named handler functions so we can properly remove them later
    const handleOnline = () => {
        announce('Povezava z internetom je vzpostavljena. Poskušam naložiti podatke.', 'polite');
        retryLoadingData();
        retryLoadingStations();
    };

    const handleOffline = () => {
        announce('Povezava z internetom je prekinjena. Nekateri podatki morda niso na voljo.', 'assertive');
    };

    // Initialize data when component mounts
    onMount(() => {
        initialize();

        // Handle offline status
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    });

    onCleanup(() => {
        // Cleanup event listeners with the same function references
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    });


    return (
        <>
            {/* Skip link for keyboard users */}
            <a
                href={`#${mainContentId()}`}
                class="skip-link"
                onFocus={() => setIsKeyboardUser(true)}
            >
                Preskoči na glavno vsebino
            </a>

            <main
                class="text-center outline-none"
                aria-label="Ali je danes vroče – podatki o temperaturi"
                tabIndex="-1"
            >
                <h1 class="not-prose font-normal text-5xl font-sans text-balance">
                    Ali je danes vroče <StationSelector
                        stations={stations()}
                        selectedStation={selectedStation()}
                        stationPrefix={stationPrefix()}
                        isLoading={isLoadingStations()}
                        onStationChange={onStationChange}
                        isKeyboardUser={isKeyboardUser()}
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
                    labels={percentile_labels}
                    values={vrednosti}
                    descriptions={opisi}
                    isKeyboardUser={isKeyboardUser()}
                />

                <LoadingIndicator
                    isLoading={isLoadingData() || isLoadingStations()}
                    message={isLoadingStations() ? 'Nalaganje postaj...' : 'Nalaganje podatkov o temperaturi...'}
                    class="mt-4"
                />

                <ErrorMessage
                    error={dataError()}
                    onRetry={retryLoadingData}
                />

                <ErrorMessage
                    error={stationsError()}
                    onRetry={retryLoadingStations}
                />
            </main>
        </>
    );
}
