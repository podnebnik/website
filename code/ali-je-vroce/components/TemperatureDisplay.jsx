import { Show, createUniqueId, createEffect } from "solid-js";
import { IsItHotDot } from "../../components/is-it-hot-dot.jsx";
import { announce } from "../utils/a11y.js";

/**
 * TemperatureDisplay component shows the temperature data and related statistics.
 * It displays minimum, average, and maximum temperatures along with their timestamps,
 * and provides a visual and textual representation of how hot it is based on percentile data.
 *
 * @param {Object} props - Component props
 * @param {string} props.result - The percentile result ('p00', 'p05', etc.)
 * @param {string} props.resultTemperature - The formatted temperature string with unit
 * @param {string} props.tempMin - Minimum temperature
 * @param {string} props.timeMin - Time when minimum temperature was recorded
 * @param {string} props.tempMax - Maximum temperature
 * @param {string} props.timeMax - Time when maximum temperature was recorded
 * @param {string} props.tempAvg - Average temperature
 * @param {string} props.timeUpdated - Last update time
 * @param {boolean} props.isLoading - Whether data is currently loading
 * @param {Object} props.labels - Object containing textual labels for percentiles
 * @param {Object} props.values - Object containing main temperature result values
 * @param {Object} props.descriptions - Object containing descriptions for percentiles
 * @param {boolean} props.isKeyboardUser - Whether the user is navigating with keyboard
 * @returns {JSX.Element} The rendered component
 */
export function TemperatureDisplay(props) {
    // Generate unique IDs for accessibility
    const temperatureRegionId = createUniqueId();
    const loadingId = createUniqueId();
    const resultId = createUniqueId();
    const descriptionId = createUniqueId();
    const statsListId = createUniqueId();
    const contextId = createUniqueId();
    const lastUpdatedId = createUniqueId();

    // Announce temperature results when data is loaded
    createEffect((prevLoading) => {
        const isLoading = props.isLoading;
        const result = props.result;

        if (prevLoading && !isLoading && result) {
            const announcement = `Podatki so naloženi. Rezultat: ${props.values[result]}. ${props.descriptions[result]}. Povprečna temperatura je ${props.tempAvg} °C.`;
            announce(announcement, 'polite');
        }

        return isLoading;
    }, props.isLoading);

    return (
        <Show
            when={!props.isLoading}
            fallback={
                <div
                    class="font-black text-6xl h-20 flex items-center justify-center"
                    aria-live="polite"
                    aria-busy="true"
                    id={loadingId}
                >
                    <div
                        class="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3"
                        aria-hidden="true"
                    ></div>
                    <span class="text-gray-400">Nalaganje podatkov...</span>
                </div>
            }
        >
            <section
                aria-labelledby={temperatureRegionId}
                class="temperature-data focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                tabindex="0"
                aria-live="polite"
            >
                <h2 id={temperatureRegionId} class="sr-only">Podatki o temperaturi</h2>

                <div role="status" aria-live="polite" aria-atomic="true">
                    <p id={resultId} class="font-black text-6xl" aria-label={`Rezultat: ${props.values[props.result]}`}>
                        <Show when={props.result !== ""} fallback={
                            <span aria-live="assertive">Ni podatkov</span>
                        }>
                            <IsItHotDot
                                color={props.result}
                                class="mr-8"
                                aria-hidden="true"
                                role="presentation"
                            />{" "}
                            <span>{props.values[props.result]}</span>
                        </Show>
                    </p>
                    <p id={descriptionId} class="text-4xl font-semibold" aria-live="polite">{props.descriptions[props.result]}</p>
                </div>

                <div
                    id={statsListId}
                    class="flex justify-center gap-12 text-xl mt-4"
                    role="list"
                    aria-label="Podrobni podatki o temperaturi"
                >
                    <div class="flex flex-col" role="listitem" aria-label="Minimalna temperatura">
                        <span class="text-gray-400 text-sm leading-6">minimum</span>
                        <span class="high-contrast-text">{props.tempMin} °C</span>
                        <span class="text-gray-400 text-sm leading-6">{props.timeMin}</span>
                    </div>
                    <div
                        class="flex flex-col"
                        role="listitem"
                        aria-label="Povprečna temperatura"
                    >
                        <span class="text-gray-400 text-sm leading-6">&nbsp;</span>
                        <span class="font-bold high-contrast-text">{props.tempAvg} °C</span>
                        <span class="text-gray-400 text-sm leading-6">povprečje zadnjih 24h</span>
                    </div>
                    <div class="flex flex-col" role="listitem" aria-label="Maksimalna temperatura">
                        <span class="text-gray-400 text-sm leading-6">maksimum</span>
                        <span class="high-contrast-text">{props.tempMax} °C</span>
                        <span class="text-gray-400 text-sm leading-6">{props.timeMax}</span>
                    </div>
                </div>
            </section>

            <p
                id={contextId}
                class={`text-normal font-sans mt-4 ${props.isKeyboardUser ? 'focus-visible:outline-2 focus-visible:outline-blue-600' : ''}`}
                role="contentinfo"
                tabindex="0"
            >
                V <span class="font-semibold">{props.labels[props.result]}</span> vseh
                zabeleženih dni od leta 1950 v 15-dnevnem obdobju okoli današnjega dneva je bila povprečna dnevna temperatura nižja kot{" "}
                <span class="font-semibold high-contrast-text">{props.resultTemperature}</span>.
            </p>

            <p
                id={lastUpdatedId}
                class="text-gray-400 text-sm leading-6 italic mt-2"
                role="contentinfo"
                aria-label="Čas zadnje posodobitve"
                aria-live="polite"
            >
                Zadnja posodobitev: {props.timeUpdated}
            </p>
        </Show>
    );
}
