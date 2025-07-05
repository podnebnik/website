import { Show } from "solid-js";
import { IsItHotDot } from "../../components/is-it-hot-dot.jsx";

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
 * @returns {JSX.Element} The rendered component
 */
export function TemperatureDisplay(props) {
    return (
        <Show
            when={!props.isLoading}
            fallback={
                <div class="font-black text-6xl h-20 flex items-center justify-center">
                    <div class="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3"></div>
                    <span class="text-gray-400">Nalaganje podatkov...</span>
                </div>
            }
        >
            <p class="font-black text-6xl">
                <Show when={props.result !== ""} fallback="Ni podatkov">
                    <IsItHotDot color={props.result} class="mr-8" />{" "}
                </Show>
                {props.values[props.result]}
            </p>
            <p class="text-4xl font-semibold">{props.descriptions[props.result]}</p>

            <p class="flex justify-center gap-12 text-xl">
                <span class="flex flex-col">
                    <span class="text-gray-400 text-sm leading-6">minimum</span>
                    <span>{props.tempMin} °C</span>
                    <span class="text-gray-400 text-sm leading-6">{props.timeMin}</span>
                </span>
                <span class="flex flex-col">
                    <span class="text-gray-400 text-sm leading-6">&nbsp;</span>
                    <span class="font-bold">{props.tempAvg} °C</span>
                    <span class="text-gray-400 text-sm leading-6">povprečje zadnjih 24h</span>
                </span>
                <span class="flex flex-col">
                    <span class="text-gray-400 text-sm leading-6">maksimum</span>
                    <span>{props.tempMax} °C</span>
                    <span class="text-gray-400 text-sm leading-6">{props.timeMax}</span>
                </span>
            </p>

            <p class="text-normal font-sans">V <span class="font-semibold">{props.labels[props.result]}</span> vseh
                zabeleženih dni od leta 1950 v 15-dnevnem obdobju okoli današnjega dneva je bila povprečna dnevna temperatura nižja kot{" "}
                <span class="font-semibold">{props.resultTemperature}</span>.</p>

            <p class="text-gray-400 text-sm leading-6 italic mt-2">Zadnja posodobitev: {props.timeUpdated}</p>
        </Show>
    );
}
