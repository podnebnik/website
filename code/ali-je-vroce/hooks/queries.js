import { useQuery } from '@tanstack/solid-query';
import { requestData, loadStations } from '../helpers.mjs';

/**
 * Query key factory helps organize and structure query keys
 */
export const queryKeys = {
    stations: () => ['stations'],
    weatherData: (stationId) => ['weatherData', stationId],
};

/**
 * Custom hook for fetching stations data
 * 
 * @returns {Object} TanStack Query result for stations data
 */
export function useStationsQuery() {
    return useQuery(() => ({
        queryKey: queryKeys.stations(),
        queryFn: async () => {
            const result = await loadStations();
            if (!result.success) {
                throw new Error(result.error || 'Failed to load stations');
            }
            return result.stations;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes - stations don't change often
        retry: 2,
    }));
}

/**
 * Custom hook for fetching weather data for a specific station
 * 
 * @param {number} stationId - The ID of the station to fetch data for
 * @returns {Object} TanStack Query result for weather data
 */
export function useWeatherQuery(stationId) {
    // Using this format with the callback to ensure reactive dependencies
    // are properly tracked
    return useQuery(() => ({
        queryKey: queryKeys.weatherData(stationId),
        queryFn: async () => {
            if (!stationId) return null;

            const result = await requestData(stationId);
            if (!result.success) {
                throw new Error(result.error || `Failed to load data for station ${stationId}`);
            }
            return result.data;
        },
        enabled: !!stationId,
        staleTime: 0, // Always fetch fresh data on mount/refetch
        retry: 2,
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
        refetchOnStale: true,
    }));
}
