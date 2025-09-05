import { Show, createUniqueId, createEffect, Component } from "solid-js";
import { Select } from "@kobalte/core/select";
import { createKeyboardHandler, announce } from "../utils/a11y.js";
import { getQueryClient } from "../hooks/queries.js";
import { prefetchStationData } from "../utils/prefetching.js";
import { debounce } from "../utils/debounce.js";
import type { StationSelectorProps } from "../../types/components.js";

// Get the singleton QueryClient instance
const queryClient = getQueryClient();

/**
 * StationSelector component handles the UI for selecting a weather station.
 * It displays a dropdown with available stations and handles loading and error states.
 * Provides full accessibility support and automatic data prefetching.
 */
export const StationSelector: Component<StationSelectorProps> = (props) => {
    // Create unique IDs for accessibility
    const selectId = createUniqueId();
    const labelId = `${selectId}-label`;
    const descriptionId = createUniqueId();

    // Create a debounced version of prefetching to prevent excessive API calls
    const debouncedPrefetch = debounce((stationId: number) => {
        prefetchStationData(queryClient, stationId);
    }, 200); // 200ms delay

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
    createEffect((prevLoading?: boolean) => {
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
                optionValue={(option: any) => option.value}
                optionTextValue={(option: any) => option.label}
                value={props.selectedStation}
                onChange={(value) => {
                    if (value) {
                        props.onStationChange(value);
                    }
                }}
                disabled={props.isLoading}
                disallowEmptySelection={true}
                id={selectId}
                name="location-selector"
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                aria-busy={props.isLoading}
                onOpenChange={(isOpen: boolean) => {
                    if (isOpen) {
                        // Prefetch the first few visible stations when dropdown opens
                        const visibleStations = props.stations.slice(0, 5).map(station => station.station_id);
                        visibleStations.forEach(stationId => {
                            // Use a short timeout to stagger requests and not block rendering
                            setTimeout(() => debouncedPrefetch(stationId), 50 * Math.random());
                        });
                    }
                }}
                itemComponent={(itemProps: any) => (
                    <Select.Item
                        item={itemProps.item}
                        class="flex items-center justify-between py-2 relative select-none outline-none 
                              hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2
                              data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900 data-[selected]:bg-blue-100 data-[selected]:text-blue-900 forced-colors:hc-interactive"
                        aria-label={`Izberi lokacijo ${itemProps.item.rawValue.label}`}
                        tabIndex="0"
                        onFocus={() => {
                            const stationId = itemProps.item.rawValue.value;
                            debouncedPrefetch(stationId);
                        }}
                        onMouseEnter={() => {
                            const stationId = itemProps.item.rawValue.value;
                            debouncedPrefetch(stationId);
                        }}
                    >
                        <Select.ItemLabel>{itemProps.item.rawValue.label}</Select.ItemLabel>
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
                    onKeyDown={handleKeyDown as any}
                >
                    <Show when={!props.isLoading} fallback={
                        <span class="flex items-center" aria-live="polite">
                            <span class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2" aria-hidden="true"></span>
                            <span>Nalaganje lokacij...</span>
                            <span class="sr-only">Prosimo počakajte, nalagamo seznam lokacij</span>
                        </span>
                    }>
                        <Select.Value>{(state: any) => state.selectedOption().label}</Select.Value>
                    </Show>
                </Select.Trigger>
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
};

export default StationSelector;
