import { createSignal } from "solid-js";
import { requestData, loadStations } from "../helpers.mjs";
import { DEFAULT_STATION } from "../constants.mjs";

/**
 * Custom hook for fetching and managing weather data and stations
 * 
 * @returns {Object} An object containing data, loading states, error states, and functions to manage them
 */
export function useWeatherData() {
    // Station data
    const [stations, setStations] = createSignal([{ 'station_id': 1495, 'name_locative': 'Ljubljani', 'prefix': 'v' }]);
    const [selectedStation, setSelectedStation] = createSignal(DEFAULT_STATION);
    const [stationPrefix, setStationPrefix] = createSignal('v');
    const [isLoadingStations, setIsLoadingStations] = createSignal(true);
    const [stationsError, setStationsError] = createSignal(null);

    // Temperature data
    const [isLoadingData, setIsLoadingData] = createSignal(true);
    const [dataError, setDataError] = createSignal(null);
    const [result, setResult] = createSignal('');
    const [resultTemperature, setResultTemperature] = createSignal('');
    const [tempMin, setTempMin] = createSignal('');
    const [timeMin, setTimeMin] = createSignal('');
    const [tempMax, setTempMax] = createSignal('');
    const [timeMax, setTimeMax] = createSignal('');
    const [tempAvg, setTempAvg] = createSignal('');
    const [timeUpdated, setTimeUpdated] = createSignal('');

    /**
     * Updates all temperature data signals from API response
     * @param {Object} data - Temperature data from API
     */
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

    /**
     * Fetches temperature data for a given station
     * @param {number} stationId - ID of the weather station
     */
    async function fetchStationData(stationId) {
        setIsLoadingData(true);
        setDataError(null);

        try {
            const results = await requestData(stationId);
            if (!results.success) {
                setDataError('Napaka pri nalaganju podatkov o temperaturi.');
                console.error('Failed to load data for station:', results.error);
            } else {
                updateData(results.data);
            }
        } catch (error) {
            setDataError('Napaka pri nalaganju podatkov o temperaturi.');
            console.error('Error loading data:', error);
        } finally {
            setIsLoadingData(false);
        }
    }

    /**
     * Fetches the list of available stations
     */
    async function fetchStations() {
        setIsLoadingStations(true);
        setStationsError(null);

        try {
            const stationsList = await loadStations();
            if (!stationsList.success) {
                setStationsError('Napaka pri nalaganju postaj.');
                console.error('Failed to load stations:', stationsList.error);
            } else {
                setStations(stationsList.stations);
            }
        } catch (error) {
            setStationsError('Napaka pri nalaganju postaj.');
            console.error('Error loading stations:', error);
        } finally {
            setIsLoadingStations(false);
        }
    }

    /**
     * Handles station change selection
     * @param {Object} station - Selected station object
     */
    async function onStationChange(station) {
        setStationPrefix(station.prefix);
        setSelectedStation(station);
        await fetchStationData(station.value);
    }

    /**
     * Initializes data by loading both stations and temperature data
     */
    async function initialize() {
        await fetchStationData(selectedStation().value);
        await fetchStations();
    }

    /**
     * Retries loading temperature data
     */
    function retryLoadingData() {
        fetchStationData(selectedStation().value);
    }

    /**
     * Retries loading stations list
     */
    function retryLoadingStations() {
        fetchStations();
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
