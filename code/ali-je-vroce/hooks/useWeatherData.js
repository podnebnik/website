import { createSignal, createEffect, batch } from "solid-js";
import { createStore } from "solid-js/store";
import { DEFAULT_STATION } from "../constants.mjs";
import { useStationsQuery, useWeatherQuery, queryKeys } from './queries';
import { useQueryClient } from '@tanstack/solid-query';
import { requestData } from '../helpers.mjs';

/**
 * Saves data to local storage with timestamp
 * 
 * @param {string} key - The key to store data under
 * @param {any} data - The data to store
 */
function setCachedData(key, data) {
    try {
        const item = {
            timestamp: new Date().getTime(),
            data
        };
        localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
        console.warn('Error writing to cache:', error);
    }
}

/**
 * Retrieves cached data from local storage
 * 
 * @param {string} key - The key to retrieve data for
 * @param {number} maxAgeMinutes - Maximum age of cache in minutes
 * @returns {any|null} The cached data or null if no valid cache exists
 */
function getCachedData(key, maxAgeMinutes = 30) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const { timestamp, data } = JSON.parse(item);
        const now = new Date().getTime();
        const maxAge = maxAgeMinutes * 60 * 1000;

        // Check if cache is still valid
        if (now - timestamp > maxAge) {
            localStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (error) {
        console.warn('Error reading from cache:', error);
        return null;
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

    // Try to load last selected station from local storage
    const cachedStation = getCachedData('selectedStation');

    // Use a signal for reactive station ID
    const [stationId, setStationId] = createSignal((cachedStation || DEFAULT_STATION).value);

    // Create a store for UI state
    const [state, setState] = createStore({
        // Station data
        selectedStation: cachedStation || DEFAULT_STATION,
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
     * Handles station change selection
     * @param {Object} station - Selected station object
     */
    function onStationChange(station) {
        // Save selected station to local storage first
        setCachedData('selectedStation', station);

        // Update the state and signal
        batch(() => {
            setState({
                stationPrefix: station.prefix,
                selectedStation: station
            });

            // Update the station ID signal
            setStationId(station.value);
        });

        // Directly fetch data for the new station and update state
        // This is a backup approach in case the reactive query update doesn't work
        requestData(station.value).then(result => {
            if (result.success) {
                const data = result.data;
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
            }
        });
    }

    /**
     * Initializes data by triggering resources to load
     */
    function initialize() {
        // TanStack Query handles initialization automatically
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
        isLoadingData: () => weatherQuery.isPending,
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
