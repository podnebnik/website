import { Show, createUniqueId, createEffect, Component } from "solid-js";
import { IsItHotDot } from "../../components/is-it-hot-dot.jsx";
import { announce } from "../utils/a11y.js";
import { LoadingSkeleton } from "./Skeletons.tsx";
import { StalenessIndicator } from "./StalenessIndicator.tsx";
import type { TemperatureDisplayProps } from "../../types/components.js";

/**
 * TemperatureDisplay component shows the temperature data and related statistics.
 * It displays minimum, average, and maximum temperatures along with their timestamps,
 * and provides a visual and textual representation of how hot it is based on percentile data.
 */
export const TemperatureDisplay: Component<TemperatureDisplayProps> = (props) => {
    // Generate unique IDs for accessibility
    const temperatureRegionId = createUniqueId();
    const resultId = createUniqueId();
    const descriptionId = createUniqueId();
    const statsListId = createUniqueId();
    const contextId = createUniqueId();
    const lastUpdatedId = createUniqueId();

    // Announce temperature results when data is loaded
    createEffect((prevLoading?: boolean) => {
        const isLoading = props.isLoading;
        const result = props.result;

        if (prevLoading && !isLoading && result) {
            const announcement = `Podatki so naloženi. Rezultat: ${props.values[result]}. ${props.descriptions[result]}. Povprečna temperatura je ${props.tempAvg} °C.`;
            announce(announcement, 'polite');
        } else if (isLoading && !prevLoading) {
            // Announce when loading starts
            announce('Nalaganje podatkov o temperaturi...', 'polite');
        }

        return isLoading;
    }, props.isLoading);

    return (
        <>
            <section
                aria-labelledby={temperatureRegionId}
                class="temperature-data focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                tabIndex={0}
                aria-live="polite"
            >
                <h2 id={temperatureRegionId} class="sr-only">Podatki o temperaturi</h2>

                <div role="status" aria-live="polite" aria-atomic="true" aria-busy={!props.isLoading}>
                    <Show when={!props.isLoading} fallback={
                        <div aria-label="Nalaganje temperature">
                            <LoadingSkeleton type="main" />
                        </div>
                    }
                    >
                        <p id={resultId} class="font-black text-6xl flex items-center justify-center gap-8" aria-label={`Rezultat: ${props.values[props.result]}`}>
                            <IsItHotDot
                                color={props.result as "p00" | "p05" | "p20" | "p40" | "p60" | "p80" | "p95"}
                                class="size-[72px] inline-block"
                            />
                            {" "}
                            <span>{props.values[props.result]}</span>
                        </p>
                    </Show>

                    <Show when={!props.isLoading} fallback={
                        <div aria-label="Nalaganje opisa temperature">
                            <LoadingSkeleton type="description" />
                        </div>
                    } >
                        <p id={descriptionId} class="text-4xl font-semibold" aria-live="polite">
                            {props.descriptions[props.result]}
                        </p>
                    </Show>
                </div>

                <div
                    id={statsListId}
                    class="flex justify-center gap-12 text-xl mt-4"
                    role="list"
                    aria-label="Podrobni podatki o temperaturi"
                >
                    <Show
                        when={!props.isLoading}
                        fallback={
                            <div class="flex justify-center gap-12" aria-label="Nalaganje podrobnih podatkov o temperaturi">
                                <LoadingSkeleton type="stats" />
                            </div>
                        }
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
                    </Show>
                </div>
            </section>

            <Show
                when={!props.isLoading}
                fallback={
                    <div aria-label="Nalaganje kontekstnih podatkov">
                        <LoadingSkeleton type="context" />
                    </div>
                }
            >
                <p
                    id={contextId}
                    class="text-normal font-sans mt-4"
                    role="contentinfo"
                    tabIndex="0"
                >
                    V <span class="font-semibold">{props.labels[props.result]}</span> vseh
                    zabeleženih dni od leta 1950 v 15-dnevnem obdobju okoli današnjega dneva je bila povprečna dnevna temperatura nižja kot{" "}
                    <span class="font-semibold high-contrast-text">{props.resultTemperature}</span>.
                </p>
            </Show>

            <Show
                when={!props.isLoading}
                fallback={
                    <div aria-label="Nalaganje podatkov o času posodobitve">
                        <LoadingSkeleton type="lastUpdated" />
                    </div>
                }
            >
                <p
                    id={lastUpdatedId}
                    class="text-gray-400 text-sm leading-6 italic mt-2 flex items-center justify-center gap-2"
                    role="contentinfo"
                    aria-label="Čas zadnje posodobitve"
                    aria-live="polite"
                >
                    Zadnja posodobitev: <time dateTime={props.timeUpdated}>{props.timeUpdated}</time>
                    <StalenessIndicator isStale={props.isStale} />
                </p>
            </Show>
        </>
    );
};

export default TemperatureDisplay;
