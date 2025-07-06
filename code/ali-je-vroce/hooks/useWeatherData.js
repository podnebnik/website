import { createSignal, createEffect, batch } from "solid-js";
import { createStore } from "solid-js/store";
import { DEFAULT_STATION } from "../constants.mjs";
import { useStationsQuery, useWeatherQuery, queryKeys, getQueryClient } from './queries';
import { useQueryClient } from '@tanstack/solid-query';
import { requestData, loadStations } from '../helpers.mjs';

/**
 * Simplified localStorage helper for user preferences
 * Only used for storing user preferences, not data caching
 * 
 * @param {string} key - The key to store preference under
 * @param {any} value - The preference value to store
 */
function setPreference(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Error saving preference:', error);
    }
}

/**
 * Retrieves user preference from local storage
 * 
 * @param {string} key - The key to retrieve preference for
 * @param {any} defaultValue - Default value if preference doesn't exist
 * @returns {any} The preference value or defaultValue if not found
 */
function getPreference(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
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
export function useWeatherData() {
    // Get the QueryClient from context
    const queryClient = useQueryClient();
    
    // Track if there's a station change in progress
    const [isChanging, setIsChanging] = createSignal(false);
    
    // Try to load last selected station from local storage
    const cachedStation = getPreference('selectedStation', DEFAULT_STATION);

    // Use a signal for reactive station ID
    const [stationId, setStationId] = createSignal(cachedStation.value);

    // Create a store for UI state
    const [state, setState] = createStore({
        // Station data
        selectedStation: cachedStation,
        stationPrefix: cachedStation?.prefix || 'v',

        // Temperature display state
        result: '',
        resultTemperature: '',
        tempMin: '',
        timeMin: '',
        tempMax: '',
        timeMax: '',
        tempAvg: '',
        timeUpdated: ''
    });
    
    // Track current fetch controller for cancellation
    let currentController = null;

    // Use TanStack Query hooks
    const stationsQuery = useStationsQuery();
    const weatherQuery = useWeatherQuery(stationId());

    // Process weather data when it changes
    createEffect(() => {
        // Skip if data is loading or there's an error
        if (weatherQuery.isPending || weatherQuery.isError || !weatherQuery.data) return;

        const data = weatherQuery.data;

        // Use batch to group multiple updates together for better performance
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
     * Handles station change selection with improved data fetching and cancellation
     * @param {Object} station - Selected station object
     */
    function onStationChange(station) {
        // Early return if same station
        if (station.value === stationId()) return;
        
        // Cancel any in-flight request
        if (currentController) {
            currentController.abort();
        }
        
        // Create a new AbortController for this request
        currentController = new AbortController();
        
        // Save selected station to local storage
        setPreference('selectedStation', station);
        
        // Set loading state for UI feedback
        setIsChanging(true);
        
        // Update state in a batch
        batch(() => {
            setState({
                stationPrefix: station.prefix,
                selectedStation: station
            });
            
            // Update the station ID signal
            setStationId(station.value);
        });
        
        // Instead of directly calling the API, use the query client
        // This ensures consistency with the hook-based approach
        queryClient.fetchQuery({
            queryKey: queryKeys.weatherData(station.value),
            queryFn: async () => {
                const result = await requestData(station.value, { signal: currentController.signal });
                if (!result.success) {
                    throw new Error(result.error || `Failed to load data for station ${station.value}`);
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
                    throw new Error(result.error || 'Failed to load stations');
                }
                return result.stations;
            },
        });
    }

    /**
     * Retries loading temperature data
     */
    function retryLoadingData() {
        weatherQuery.refetch();
    }

    /**
     * Retries loading stations list
     */
    function retryLoadingStations() {
        stationsQuery.refetch();
    }

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

        // Functions
        initialize,
        onStationChange,
        retryLoadingData,
        retryLoadingStations
    };
}
