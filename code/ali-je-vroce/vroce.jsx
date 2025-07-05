import { createSignal, Show, For, onMount, createEffect } from "solid-js";
import { Select } from "@kobalte/core/select";
import { IsItHotDot } from "../components/is-it-hot-dot.jsx";

import { requestData, loadStations } from "./helpers.mjs";
import { vrednosti, opisi, percentile_labels } from "./constants.mjs";
import { DEFAULT_STATION } from "./constants.mjs";

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
    // Loading states
    const [isLoadingData, setIsLoadingData] = createSignal(true);
    const [isLoadingStations, setIsLoadingStations] = createSignal(true);

    // Error states
    const [dataError, setDataError] = createSignal(null);
    const [stationsError, setStationsError] = createSignal(null);

    const [stations, setStations] = createSignal([{ 'station_id': 1495, 'name_locative': 'Ljubljani', 'prefix': 'v' }]);
    const [stationPrefix, setStationPrefix] = createSignal('v')
    const [selectedStation, setSelectedStation] = createSignal(DEFAULT_STATION);

    /**
     * Signal to hold the result of the temperature percentile comparison.
     * It indicates how the current average temperature compares to historical data.
     * Possible values are 'p00', 'p05', 'p20', 'p40', 'p60', 'p80', 'p95', or an empty string if no data is available.
     * @type {import('solid-js').Signal<PercentileKey>}
     * @see {@link https://solidjs.com/docs/api#createsignal}
     */
    const [result, setResult] = createSignal('');
    const [resultTemperature, setResultTemperature] = createSignal('');
    const [tempMin, setTempMin] = createSignal('');
    const [timeMin, setTimeMin] = createSignal('');
    const [tempMax, setTempMax] = createSignal('');
    const [timeMax, setTimeMax] = createSignal('');
    const [tempAvg, setTempAvg] = createSignal('');
    const [timeUpdated, setTimeUpdated] = createSignal('');

    function updateData({
        resultValue,
        resultTemperatureValue,
        tempMin,
        timeMin,
        tempMax,
        timeMax,
        tempAvg,
        timeUpdated,

    }) {
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
            console.error('Failed to load data for station:', results.error);
            setDataError('Napaka pri nalaganju podatkov o temperaturi.');
            setIsLoadingData(false);
            return;
        }
        updateData(results.data)
        const stationsList = await loadStations();
        if (!stationsList.success) {
            console.error('Failed to load stations:', stationsList.error);
            setStationsError('Napaka pri nalaganju postaj.');
            setIsLoadingStations(false);
            return;
        }
        setStations(stationsList.stations);
        setIsLoadingData(false);
        setIsLoadingStations(false);
    })

    async function onStationChange(station) {
        setStationPrefix(station.prefix);
        setSelectedStation(station);
        setIsLoadingData(true);
        const results = await requestData(station.value)
        if (!results.success) {
            console.error('Failed to load data for station:', results.error);
            setDataError('Napaka pri nalaganju podatkov o temperaturi.');
            setIsLoadingData(false);
            return;
        }
        updateData(results.data);
        setIsLoadingData(false);
    }


    return <div class="text-center">
        <p class="font-normal text-5xl font-sans text-balance">
            Ali je danes vroče {stationPrefix()}&nbsp;
            <Select
                options={stations().map(station => ({
                    value: station.station_id,
                    label: station.name_locative,
                    prefix: station.prefix,
                }))}
                optionValue="value"
                optionTextValue="label"
                value={selectedStation()}
                onChange={onStationChange}
                disabled={isLoadingStations()}
                disallowEmptySelection={true}
                itemComponent={props => (
                    <Select.Item item={props.item} class="flex items-center justify-between py-2 relative select-none outline-none hover:bg-gray-100 hover:text-black">
                        <Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel>
                        <Select.ItemIndicator>✓</Select.ItemIndicator>
                    </Select.Item>
                )}
            >
                <Select.Label class="sr-only">Izberite lokacijo</Select.Label>
                <Select.Trigger class="select font-bold appearance-none inline-block bg-transparent rounded-none focus:outline-hidden leading-[64px] hover:cursor-pointer transition-all duration-300">
                    <Show when={!isLoadingStations()} fallback={
                        <span class="flex items-center">
                            <span class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></span>
                            Nalaganje...
                        </span>
                    }>
                        <Select.Value>{state => state.selectedOption().label}</Select.Value>
                    </Show>
                </Select.Trigger>?
                <Select.Portal>
                    <Select.Content class="bg-muted text-white px-2 py-2 max-w-fit">
                        <Show when={isLoadingStations()} fallback={
                            <Select.Listbox class="max-h-80 overflow-auto p-2 max-w-fit" />
                        }>
                            <div class="p-4 flex items-center justify-center">
                                <div class="w-5 h-5 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-3"></div>
                                <p class="text-white">Nalaganje postaj...</p>
                            </div>
                        </Show>
                    </Select.Content>
                </Select.Portal>
            </Select>
        </p>
        <Show
            when={!isLoadingData() && !dataError()}
            fallback={
                <div class="font-black text-6xl h-20 flex items-center justify-center">
                    <Show when={!dataError() && isLoadingData()}>
                        <div class="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3"></div>
                        <span class="text-gray-400">Nalaganje podatkov...</span>
                    </Show>
                </div>
            }
        >
            <p class="font-black text-6xl">
                <Show when={result() !== ""} fallback="Ni podatkov">
                    <IsItHotDot color={result()} class="mr-8" />{" "}
                </Show>
                {vrednosti[result()]}
            </p>
            <p class="text-4xl font-semibold">{opisi[result()]}</p>

            <p class="flex justify-center gap-12 text-xl">
                <span class="flex flex-col">
                    <span class="text-gray-400 text-sm leading-6">minimum</span>
                    <span>{tempMin()} °C</span>
                    <span class="text-gray-400 text-sm leading-6">{timeMin()}</span>
                </span>
                <span class="flex flex-col">
                    <span class="text-gray-400 text-sm leading-6">&nbsp;</span>
                    <span class="font-bold">{tempAvg()} °C</span>
                    <span class="text-gray-400 text-sm leading-6">povprečje zadnjih 24h</span>
                </span>
                <span class="flex flex-col">
                    <span class="text-gray-400 text-sm leading-6">maksimum</span>
                    <span>{tempMax()} °C</span>
                    <span class="text-gray-400 text-sm leading-6">{timeMax()}</span>
                </span>
            </p>

            <p class="text-normal font-sans">V <span class="font-semibold">{percentile_labels[result()]}</span> vseh
                zabeleženih dni od leta 1950 v 15-dnevnem obdobju okoli današnjega dneva je bila povprečna dnevna temperatura nižja kot{" "}
                <span class="font-semibold">{resultTemperature()}</span>.</p>
        </Show>

        <p class="text-gray-400 text-sm leading-6 italic">Zadnja posodobitev: {timeUpdated()}</p>

        <Show when={isLoadingData() || isLoadingStations()}>
            <div class="mt-4 p-3 bg-gray-100 rounded-md animate-pulse">
                <div class="flex items-center justify-center">
                    <div class="w-6 h-6 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3"></div>
                    <p class="text-gray-700">{isLoadingStations() ? 'Nalaganje postaj...' : 'Nalaganje podatkov o temperaturi...'}</p>
                </div>
            </div>
        </Show>
        <Show when={dataError()}>
            <div class="mt-4 p-3 bg-red-100 rounded-md border border-red-300">
                <p class="text-red-600 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    {dataError()}
                </p>
                <button
                    class="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    onClick={() => {
                        setDataError(null);
                        onStationChange(selectedStation());
                    }}
                >
                    Poskusi znova
                </button>
            </div>
        </Show>
        <Show when={stationsError()}>
            <div class="mt-4 p-3 bg-red-100 rounded-md border border-red-300">
                <p class="text-red-600 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    {stationsError()}
                </p>
                <button
                    class="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    onClick={() => {
                        setStationsError(null);
                        setIsLoadingStations(true);
                        loadStations().then(stationsList => {
                            if (stationsList.success) {
                                setStations(stationsList.stations);
                                setStationsError(null);
                            } else {
                                setStationsError('Napaka pri nalaganju postaj.');
                            }
                            setIsLoadingStations(false);
                        });
                    }}
                >
                    Poskusi znova
                </button>
            </div>
        </Show>
    </div>;
}
