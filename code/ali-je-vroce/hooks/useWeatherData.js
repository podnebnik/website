import { createSignal, createResource, createEffect, batch } from "solid-js";
import { createStore } from "solid-js/store";
import { requestData, loadStations } from "../helpers.mjs";
import { DEFAULT_STATION } from "../constants.mjs";

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
 * Saves data to the cache
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
 * Custom hook for fetching and managing weather data and stations
 * 
 * @returns {Object} An object containing data, loading states, error states, and functions to manage them
 */
export function useWeatherData() {
    // Try to load last selected station from local storage
    const cachedStation = getCachedData('selectedStation');
    const cachedStations = getCachedData('stations');

    // Create a store for all state rather than individual signals
    const [state, setState] = createStore({
        // Station data
        selectedStation: cachedStation || DEFAULT_STATION,
        stationPrefix: cachedStation?.prefix || 'v',
        stations: cachedStations || [{ 'station_id': 1495, 'name_locative': 'Ljubljani', 'prefix': 'v' }],

        // Temperature display state
        result: '',
        resultTemperature: '',
        tempMin: '',
        timeMin: '',
        tempMax: '',
        timeMax: '',
        tempAvg: '',
        timeUpdated: '',

        // Loading and error states
        isLoadingStations: false,
        stationsError: null,
        isLoadingData: false,
        dataError: null
    });

    // Create a memoized fetcher function for stations that only runs once
    const fetchStations = async () => {
        // Try to get from cache first
        if (cachedStations) {
            console.log('Using cached stations data');
            return { stations: cachedStations, success: true };
        }

        try {
            const result = await loadStations();
            if (result.success) {
                // Cache the successful result
                setCachedData('stations', result.stations);
            }
            return result;
        } catch (error) {
            console.error('Error in fetchStations:', error);
            return { success: false, error: 'Napaka pri nalaganju postaj.' };
        }
    };

    // Create a resource for stations data
    const [stationsData, { refetch: refetchStations }] = createResource(
        fetchStations,
        { initialValue: { success: false, stations: state.stations } }
    );

    // Create a memoized fetcher function for weather data that depends on the selected station
    const fetchWeatherData = async (stationId) => {
        if (!stationId) return null;

        // Use a cache key based on station ID
        const cacheKey = `weatherData_${stationId}`;
        const cachedData = getCachedData(cacheKey, 10); // 10 minute cache for weather data

        if (cachedData) {
            console.log(`Using cached weather data for station ${stationId}`);
            return cachedData;
        }

        try {
            const result = await requestData(stationId);
            if (result.success) {
                // Cache the successful result
                setCachedData(cacheKey, result);
            }
            return result;
        } catch (error) {
            console.error('Error in fetchWeatherData:', error);
            return { success: false, error: 'Napaka pri nalaganju podatkov o temperaturi.' };
        }
    };

    // Create a resource for weather data that responds to station changes
    const [weatherData, { refetch: refetchWeather }] = createResource(
        () => state.selectedStation.value,
        fetchWeatherData
    );

    // Update loading states based on resource loading status
    createEffect(() => {
        setState('isLoadingStations', stationsData.loading);
    });

    createEffect(() => {
        setState('isLoadingData', weatherData.loading);
    });

    // Process stations data when it changes
    createEffect(() => {
        const data = stationsData();
        if (!data) return;

        if (data.success) {
            setState('stations', data.stations);
            setState('stationsError', null);
        } else {
            setState('stationsError', data.error || 'Unknown error');
        }
    });

    // Process weather data when it changes
    createEffect(() => {
        const data = weatherData();
        if (!data || !data.success) {
            if (data) {
                setState('dataError', data.error || 'Unknown error');
            }
            return;
        }

        setState('dataError', null);

        // Use batch to group multiple updates together for better performance
        batch(() => {
            const {
                resultValue,
                resultTemperatureValue,
                tempMin,
                timeMin,
                tempMax,
                timeMax,
                tempAvg,
                timeUpdated,
            } = data.data;

            setState({
                resultTemperature: `${resultTemperatureValue} °C`,
                tempMin,
                timeMin,
                tempMax,
                timeMax,
                tempAvg,
                timeUpdated,
                result: resultValue
            });
        });
    });

    /**
     * Handles station change selection
     * @param {Object} station - Selected station object
     */
    function onStationChange(station) {
        batch(() => {
            setState({
                stationPrefix: station.prefix,
                selectedStation: station
            });
        });

        // Save selected station to local storage
        setCachedData('selectedStation', station);
    }

    /**
     * Initializes data by triggering resources to load
     */
    function initialize() {
        // Resources will automatically load when created
        // Nothing to do here as the createResource calls handle initialization
    }

    /**
     * Retries loading temperature data
     */
    function retryLoadingData() {
        setState('dataError', null);
        refetchWeather();
    }

    /**
     * Retries loading stations list
     */
    function retryLoadingStations() {
        setState('stationsError', null);
        refetchStations();
    }

    // Return derived values directly from the store for better reactivity
    return {
        // Station data
        stations: () => state.stations,
        selectedStation: () => state.selectedStation,
        stationPrefix: () => state.stationPrefix,
        isLoadingStations: () => state.isLoadingStations || stationsData.loading,
        stationsError: () => state.stationsError,

        // Temperature data
        isLoadingData: () => state.isLoadingData || weatherData.loading,
        dataError: () => state.dataError,
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
