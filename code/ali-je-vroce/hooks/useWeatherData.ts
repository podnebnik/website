import { createSignal, createEffect, batch, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { DEFAULT_STATION, CACHE_KEY_PREFIX } from "../constants";
import { useStationsQuery, useWeatherQuery, queryKeys } from './queries';
import { useQueryClient } from '@tanstack/solid-query';
import { requestData, loadStations } from '../helpers';
import { generateOptimisticWeatherData } from '../utils/optimistic';
import { retryWithBackoff, createNetworkMonitor } from '../utils/errorRecovery.js';

/**
 * Simplified localStorage helper for user preferences
 * Uses the same prefix as the query cache for consistency
 * 
 * @param {string} key - The key to store preference under
 * @param {any} value - The preference value to store
 */
function setPreference(key: string, value: unknown) {
    try {
        // Use the same prefix for consistency with the query cache
        const prefixedKey = `${CACHE_KEY_PREFIX}-${key}`;
        localStorage.setItem(prefixedKey, JSON.stringify(value));
    } catch (error) {
        console.warn('Error saving preference:', error);
    }
}

/**
 * Retrieves user preference from local storage
 * Uses the same prefix as the query cache for consistency
 * 
 * @param key - The key to retrieve preference for
 * @param defaultValue - Default value if preference doesn't exist
 * @returns  The preference value or defaultValue if not found
 */
function getPreference(key: string, defaultValue: {value: number,label: string, prefix: string} | null = null) {
    try {
        // First try with the new prefixed key
        const prefixedKey = `${CACHE_KEY_PREFIX}-${key}`;
        let item = localStorage.getItem(prefixedKey);

        // If not found, try the old unprefixed key for backward compatibility
        if (!item) {
            // Try the legacy hardcoded prefix (if we changed the constant)
            const legacyPrefixedKey = `ali-je-vroce-cache-${key}`;
            item = localStorage.getItem(legacyPrefixedKey);

            // If found with legacy prefixed key, migrate it
            if (item) {
                const parsedValue = JSON.parse(item);
                setPreference(key, parsedValue);
                localStorage.removeItem(legacyPrefixedKey);
                return parsedValue;
            }

            // Last resort: try completely unprefixed key
            item = localStorage.getItem(key);

            // If found with old key, migrate it to new prefixed format
            if (item) {
                const parsedValue = JSON.parse(item);
                setPreference(key, parsedValue);
                localStorage.removeItem(key); // Remove old key
                return parsedValue;
            }
        }

        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn('Error reading preference:', error);
        return defaultValue;
    }
}

/**
 * Custom hook for fetching and managing weather data and stations using TanStack Query
 * 
 * @returns {Object} An object containing data, loading states, error states, and functions to manage them
 */
/**
 * Custom hook for managing weather data and station selection with SolidJS and TanStack Query.
 *
 * Provides reactive state and utility functions for:
 * - Fetching and caching weather data for a selected station
 * - Managing station selection and optimistic UI updates
 * - Handling loading, error, and stale states for both stations and weather data
 * - Retrying failed requests with exponential backoff
 * - Monitoring network status to trigger automatic retries
 *
 * @returns {Object} An object containing:
 *   @property {Function} stations - Returns the list of available stations.
 *   @property {Function} selectedStation - Returns the currently selected station object.
 *   @property {Function} stationPrefix - Returns the prefix of the selected station.
 *   @property {Function} isLoadingStations - Returns true if stations are loading.
 *   @property {Function} stationsError - Returns the error message for stations loading, if any.
 *   @property {Function} isLoadingData - Returns true if weather data is loading or station is changing.
 *   @property {Function} dataError - Returns the error message for weather data loading, if any.
 *   @property {Function} result - Returns the main weather result value.
 *   @property {Function} resultTemperature - Returns the formatted temperature string.
 *   @property {Function} tempMin - Returns the minimum temperature.
 *   @property {Function} timeMin - Returns the time of minimum temperature.
 *   @property {Function} tempMax - Returns the maximum temperature.
 *   @property {Function} timeMax - Returns the time of maximum temperature.
 *   @property {Function} tempAvg - Returns the average temperature.
 *   @property {Function} timeUpdated - Returns the last update time for the data.
 *   @property {Function} isDataStale - Returns true if the weather data is stale.
 *   @property {Function} initialize - Initializes the hook and prefetches stations data.
 *   @property {Function} onStationChange - Handles station selection changes.
 *   @property {Function} retryLoadingData - Retries loading weather data with backoff.
 *   @property {Function} retryLoadingStations - Retries loading stations list with backoff.
 */
export function useWeatherData() {
    const queryClient = useQueryClient();
    const [isChanging, setIsChanging] = createSignal(false);

    const cachedStation = getPreference('selectedStation', DEFAULT_STATION);
    const [stationId, setStationId] = createSignal(String(cachedStation.value));

    const [state, setState] = createStore<{
        selectedStation: { value: number; label: string; prefix: string } | null;
        stationPrefix: string;
        result: string;
        resultTemperature: string;
        tempMin?: number;
        timeMin: string;
        tempMax?: number;
        timeMax: string;
        tempAvg?: number;
        timeUpdated: string;
    }>({
        // Station data
        selectedStation: cachedStation,
        stationPrefix: cachedStation?.prefix || 'v',

        // Temperature display state
        result: '',
        resultTemperature: "C",
        tempMin: undefined,
        timeMin: '',
        tempMax: undefined,
        timeMax: '',
        tempAvg: undefined,
        timeUpdated: ''
    });

    /**
     * Holds the current AbortController instance used to manage and cancel ongoing fetch requests.
     * @type {AbortController|null}
     */
    let currentController: AbortController | null  = null;

    const stationsQuery = useStationsQuery();
    const weatherQuery = useWeatherQuery(stationId());

    // Process weather data when it changes
    createEffect(() => {
        // Skip if data is loading or there's an error
        if (weatherQuery.isPending || weatherQuery.isError || !weatherQuery.data) return;

        const data = weatherQuery.data;
        console.log('Weather data updated:', data);

        batch(() => {
            setState({
                resultTemperature: `${data.resultTemperatureValue} °C`,
                tempMin: data.tempMin,
                timeMin: data.timeMin,
                tempMax: data.tempMax,
                timeMax: data.timeMax,
                tempAvg: data.tempAvg,
                timeUpdated: data.timeUpdated,
                result: data.resultValue
            });
        });
    });

    /**
     * Handles station change selection with improved data fetching, cancellation,
     * and optimistic updates for better user experience
     * @param {Object} station - Selected station object
     */
    /**
     * Handles the logic for when a weather station is changed by the user.
     * 
     * - Prevents redundant requests if the selected station is already active.
     * - Cancels any in-flight data fetch for a previous station.
     * - Saves the selected station to local storage for persistence.
     * - Generates and displays optimistic UI data based on cached or current data.
     * - Updates relevant state variables in a batched manner for performance.
     * - Fetches fresh weather data using the query client, ensuring consistency with hook-based data fetching.
     * - Handles loading state and error reporting, including aborting requests on station change.
     * 
     * @param station - The newly selected station object.
     * @param station.value - The unique identifier for the station.
     * @param station.label - The display name of the station.
     * @param station.prefix - The prefix or code for the station.
     */
    function onStationChange(station: { value: number; label: string; prefix: string }) {
        if (String(station.value) === stationId()) return;

        if (currentController) {
            currentController.abort();
        }

        currentController = new AbortController();

        // Save selected station to local storage
        setPreference('selectedStation', station);

        // Generate optimistic data based on current or cached data
        const previousData = weatherQuery.data;
        console.log('Previous data for optimistic update:', previousData);
        const optimisticData = generateOptimisticWeatherData(
            station.value,
            previousData ?? null,
            queryClient,
            queryKeys
        );

        // Set loading state for UI feedback
        setIsChanging(true);

        // Update state in a batch, including optimistic data if available
        batch(() => {
            setState({
                stationPrefix: station.prefix,
                selectedStation: station
            });

            // If we have optimistic data, show it immediately for better UX
            if (optimisticData) {
                setState({
                    resultTemperature: optimisticData.resultTemperatureValue ? `${optimisticData.resultTemperatureValue} °C` : '...',
                    tempMin: optimisticData.tempMin,
                    timeMin: optimisticData.timeMin,
                    tempMax: optimisticData.tempMax,
                    timeMax: optimisticData.timeMax,
                    tempAvg: optimisticData.tempAvg,
                    timeUpdated: optimisticData.timeUpdated,
                    result: optimisticData.resultValue
                });
            }

            // Update the station ID signal
            setStationId(String(station.value));
        });

        // Instead of directly calling the API, use the query client
        // This ensures consistency with the hook-based approach
        queryClient.fetchQuery({
            queryKey: queryKeys.weatherData(String(station.value)),
            queryFn: async () => {
                const result = await requestData(String(station.value), { signal: currentController?.signal });
                if (!result.success) {
                    const errorMessage = 'error' in result && result.error instanceof Error ? result.error.message : String('error' in result ? result.error : 'Unknown error');
                    throw new Error(errorMessage || `Failed to load data for station ${station.value}`);
                }
                return result.data;
            },
        })
            .then((data) => {
                // Update state with fetched data
                batch(() => {
                    setState({
                        resultTemperature: `${data.resultTemperatureValue} °C`,
                        tempMin: data.tempMin,
                        timeMin: data.timeMin,
                        tempMax: data.tempMax,
                        timeMax: data.timeMax,
                        tempAvg: data.tempAvg,
                        timeUpdated: data.timeUpdated,
                        result: data.resultValue
                    });
                });
            })
            .catch((error) => {
                // Only handle errors that aren't from cancellation
                if (error.name !== 'AbortError') {
                    console.error('Error fetching data:', error);
                }
            })
            .finally(() => {
                setIsChanging(false);
                currentController = null;
            });
    }

    /**
     * Initializes data by triggering resources to load
     */
    function initialize() {
        // TanStack Query handles initialization automatically
        // We can prefetch stations data if needed
        queryClient.prefetchQuery({
            queryKey: queryKeys.stations(),
            queryFn: async () => {
                const result = await loadStations();
                if (!result.success) {
                    const errorMessage = 'error' in result && result.error instanceof Error ? result.error.message : String('error' in result ? result.error : 'Unknown error');
                    throw new Error(errorMessage || 'Failed to load stations');
                }
                return result.stations;
            },
        });
    }

    /**
     * Retries loading temperature data with exponential backoff
     */
    function retryLoadingData() {
        retryWithBackoff(weatherQuery.refetch, {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            shouldRetry: () => true
        }).catch((error: unknown) => {
            console.warn('All retries for weather data failed:', error);
            // We could show a more specific error message here if needed
        });
    }

    /**
     * Retries loading stations list with exponential backoff
     */
    function retryLoadingStations() {
        retryWithBackoff(stationsQuery.refetch, {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            shouldRetry: () => true
        }).catch((error: unknown) => {
            console.warn('All retries for stations data failed:', error);
            // We could show a more specific error message here if needed
        });
    }

    // Set up network monitoring to automatically retry when connection is restored
    const networkMonitor = createNetworkMonitor({
        onOnline: () => {
            // When connection is restored, retry both data sources
            retryLoadingData();
            retryLoadingStations();
        },
        onOffline: () => {
            // We could show a notification about offline mode here
        }
    }) as { setup: () => void; cleanup: () => void };

    // Set up and clean up network monitoring
    onMount(() => {
        networkMonitor.setup();
    });

    onCleanup(() => {
        networkMonitor.cleanup();
    });

    // Return derived values and functions needed by components
    return {
        // Station data
        stations: () => stationsQuery.data || [],
        selectedStation: () => state.selectedStation,
        stationPrefix: () => state.stationPrefix,
        isLoadingStations: () => stationsQuery.isPending,
        stationsError: () => stationsQuery.isError ? stationsQuery.error?.message : null,

        // Temperature data
        isLoadingData: () => weatherQuery.isPending || isChanging(),
        dataError: () => weatherQuery.isError ? weatherQuery.error?.message : null,
        result: () => state.result,
        resultTemperature: () => state.resultTemperature,
        tempMin: () => state.tempMin,
        timeMin: () => state.timeMin,
        tempMax: () => state.tempMax,
        timeMax: () => state.timeMax,
        tempAvg: () => state.tempAvg,
        timeUpdated: () => state.timeUpdated,

        // SWR-related status
        isDataStale: () => weatherQuery.isStale && !weatherQuery.isPending && !weatherQuery.isError && weatherQuery.isFetching,

        // Functions
        initialize,
        onStationChange,
        retryLoadingData,
        retryLoadingStations
    };
}
