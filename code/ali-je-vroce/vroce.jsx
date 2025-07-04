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
        updateData(results)
        const stationsList = await loadStations();
        setStations(stationsList);
    })

    function onStationChange(station) {
        setStationPrefix(station.prefix);
        setSelectedStation(station);
        requestData(station.value).then(updateData);
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
                    <Select.Value>{state => state.selectedOption().label}</Select.Value>
                </Select.Trigger>?
                <Select.Portal>
                    <Select.Content class="bg-muted text-white px-2 py-2 max-w-fit">
                        <Select.Listbox class="max-h-80 overflow-auto p-2 max-w-fit" />
                    </Select.Content>
                </Select.Portal>
            </Select>

        </p>
        <p></p>
        <p class="font-black text-6xl">
            <IsItHotDot color={result()} class="mr-8" />{" "}
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

        <p class="text-gray-400 text-sm leading-6 italic">Zadnja posodobitev: {timeUpdated()}</p>
    </div>;
}
