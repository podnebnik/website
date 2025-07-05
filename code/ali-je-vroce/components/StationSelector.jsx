import { Show, createUniqueId, createEffect } from "solid-js";
import { Select } from "@kobalte/core/select";
import { createKeyboardHandler, announce } from "../utils/a11y.js";

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
    // Create unique IDs for accessibility
    const selectId = createUniqueId();
    const labelId = `${selectId}-label`;
    const descriptionId = createUniqueId();

    // Keyboard navigation handler
    const handleKeyDown = createKeyboardHandler({
        onEnter: () => {
            // The Kobalte Select handles Enter key internally
        },
        onEscape: () => {
            // The Kobalte Select handles Escape key internally
        },
        onArrowDown: () => {
            // Announce instruction for screen reader users when opening dropdown with keyboard
            announce('Uporabite puščice gor in dol za premikanje po seznamu in Enter za izbiro lokacije', 'polite');
        }
    });

    // Announce when stations are loaded
    createEffect((prevLoading) => {
        const isLoading = props.isLoading;
        if (prevLoading && !isLoading) {
            announce('Seznam postaj je naložen', 'polite');
        }
        return isLoading;
    }, props.isLoading);

    return (
        <span class="font-normal" role="region" aria-label="Izbira lokacije">
            <span aria-hidden="true">{props.stationPrefix}&nbsp;</span>
            <Select
                options={props.stations.map(station => ({
                    value: station.station_id,
                    label: station.name_locative,
                    prefix: station.prefix,
                }))}
                optionValue="value"
                optionTextValue="label"
                value={props.selectedStation}
                onChange={(value) => {
                    props.onStationChange(value);
                }}
                disabled={props.isLoading}
                disallowEmptySelection={true}
                id={selectId}
                name="location-selector"
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                aria-busy={props.isLoading}
                itemComponent={props => (
                    <Select.Item
                        item={props.item}
                        class="flex items-center justify-between py-2 relative select-none outline-none 
                              hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2
                              data-[selected]:bg-blue-100 data-[selected]:text-blue-900 forced-colors:hc-interactive"
                        aria-label={`Izberi lokacijo ${props.item.rawValue.label}`}
                        tabIndex="0"
                    >
                        <Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel>
                        <Select.ItemIndicator>
                            <span aria-hidden="true">✓</span>
                            <span class="sr-only">izbrano</span>
                        </Select.ItemIndicator>
                    </Select.Item>
                )}
            >
                <Select.Label id={labelId} class="sr-only">Izberite lokacijo</Select.Label>
                <span id={descriptionId} class="sr-only">
                    Izberi mesto za prikaz temperaturnih podatkov. Za odpiranje menija pritisnite Enter ali Space.
                </span>
                <Select.HiddenSelect />
                <Select.Trigger
                    class="select font-bold appearance-none inline-block bg-transparent rounded-none 
                           leading-[64px] hover:cursor-pointer transition-all duration-300
                           focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                    aria-live="polite"
                    onKeyDown={handleKeyDown}
                >
                    <Show when={!props.isLoading} fallback={
                        <span class="flex items-center" aria-live="polite">
                            <span class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2" aria-hidden="true"></span>
                            <span>Nalaganje lokacij...</span>
                            <span class="sr-only">Prosimo počakajte, nalagamo seznam lokacij</span>
                        </span>
                    }>
                        <Select.Value>{state => state.selectedOption().label}</Select.Value>
                    </Show>
                </Select.Trigger>
                ?
                <Select.Portal>
                    <Select.Content
                        class="bg-muted text-white px-2 py-2 max-w-fit high-contrast-border"
                        role="listbox"
                        aria-label="Izberite lokacijo"
                    >
                        <Show when={props.isLoading} fallback={
                            <>
                                <span class="sr-only" aria-live="assertive">
                                    Seznam lokacij je odprt. Uporabite puščice za navigacijo, Enter za izbiro, in Escape za zapiranje.
                                </span>
                                <Select.Listbox class="max-h-80 overflow-auto p-2 max-w-fit" />
                            </>
                        }>
                            <div class="p-4 flex items-center justify-center" aria-live="polite">
                                <div class="w-5 h-5 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-3" aria-hidden="true"></div>
                                <p class="text-white">Nalaganje postaj...</p>
                            </div>
                        </Show>
                    </Select.Content>
                </Select.Portal>
            </Select>
        </span>
    );
}
