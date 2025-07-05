import { Show } from "solid-js";
import { Select } from "@kobalte/core/select";

/**
 * StationSelector component handles the UI for selecting a weather station.
 * It displays a dropdown with available stations and handles loading and error states.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.stations - Array of station objects
 * @param {Object} props.selectedStation - Currently selected station
 * @param {Function} props.onStationChange - Callback when station selection changes
 * @param {boolean} props.isLoading - Whether stations are currently loading
 * @param {string} props.stationPrefix - Prefix to display (e.g., "v" for "v Ljubljani")
 * @returns {JSX.Element} The rendered component
 */
export function StationSelector(props) {
    return (
        <span class="font-normal">
            {props.stationPrefix}&nbsp;
            <Select
                options={props.stations.map(station => ({
                    value: station.station_id,
                    label: station.name_locative,
                    prefix: station.prefix,
                }))}
                optionValue="value"
                optionTextValue="label"
                value={props.selectedStation}
                onChange={props.onStationChange}
                disabled={props.isLoading}
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
                    <Show when={!props.isLoading} fallback={
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
                        <Show when={props.isLoading} fallback={
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
        </span>
    );
}
