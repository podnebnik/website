import { createSignal, createResource, createMemo, createEffect } from "solid-js";
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

    // Station data
    const [selectedStation, setSelectedStation] = createSignal(cachedStation || DEFAULT_STATION);
    const [stationPrefix, setStationPrefix] = createSignal(cachedStation?.prefix || 'v');

    // Temperature display state
    const [result, setResult] = createSignal('');
    const [resultTemperature, setResultTemperature] = createSignal('');
    const [tempMin, setTempMin] = createSignal('');
    const [timeMin, setTimeMin] = createSignal('');
    const [tempMax, setTempMax] = createSignal('');
    const [timeMax, setTimeMax] = createSignal('');
    const [tempAvg, setTempAvg] = createSignal('');
    const [timeUpdated, setTimeUpdated] = createSignal('');

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
    const [stationsData, { refetch: refetchStations, mutate: mutateStations }] = createResource(
        fetchStations
    );

    // Create a memoized fetcher function for weather data that depends on the selected station
    const fetchWeatherData = async (stationId) => {
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
    const [weatherData, { refetch: refetchWeather, mutate: mutateWeather }] = createResource(
        () => selectedStation().value,
        fetchWeatherData
    );

    // Process weather data when it changes
    createEffect(() => {
        const data = weatherData();
        if (!data || !data.success) return;

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

        setResultTemperature(`${resultTemperatureValue} °C`);
        setTempMin(tempMin);
        setTimeMin(timeMin);
        setTempMax(tempMax);
        setTimeMax(timeMax);
        setTempAvg(tempAvg);
        setTimeUpdated(timeUpdated);
        setResult(resultValue);
    });

    // Derived values
    const stations = createMemo(() => {
        const data = stationsData();
        return data && data.success ? data.stations : [{ 'station_id': 1495, 'name_locative': 'Ljubljani', 'prefix': 'v' }];
    });

    const isLoadingStations = createMemo(() => stationsData.loading);
    const stationsError = createMemo(() => {
        const data = stationsData();
        return (data && !data.success) ? data.error : null;
    });

    const isLoadingData = createMemo(() => weatherData.loading);
    const dataError = createMemo(() => {
        const data = weatherData();
        return (data && !data.success) ? data.error : null;
    });

    /**
     * Handles station change selection
     * @param {Object} station - Selected station object
     */
    function onStationChange(station) {
        setStationPrefix(station.prefix);
        setSelectedStation(station);

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
        refetchWeather();
    }

    /**
     * Retries loading stations list
     */
    function retryLoadingStations() {
        refetchStations();
    }

    return {
        // Station data
        stations,
        selectedStation,
        stationPrefix,
        isLoadingStations,
        stationsError,

        // Temperature data
        isLoadingData,
        dataError,
        result,
        resultTemperature,
        tempMin,
        timeMin,
        tempMax,
        timeMax,
        tempAvg,
        timeUpdated,

        // Functions
        initialize,
        onStationChange,
        retryLoadingData,
        retryLoadingStations
    };
}
