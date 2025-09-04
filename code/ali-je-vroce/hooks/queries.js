import { useQuery, QueryClient } from '@tanstack/solid-query';
import { requestData, loadStations } from '../helpers';
import { createLocalStoragePersistor } from '../utils/persistence';

/**
 * Query key factory helps organize and structure query keys
 */
export const queryKeys = {
    stations: () => ['stations'],
    weatherData: (stationId) => ['weatherData', stationId],
};

/**
 * Categorize error by type for better error handling
 * 
 * @param {Error} error - The error to categorize
 * @param {string} context - Optional context for the error
 * @returns {Object} Categorized error object with type and message
 */
function categorizeError(error, context = '') {
    if (!navigator.onLine) {
        return {
            type: 'network',
            message: 'Ni povezave z internetom',
            originalError: error
        };
    }

    if (error.message?.includes('Failed to fetch') || error instanceof TypeError) {
        return {
            type: 'network',
            message: 'Napaka pri povezavi s strežnikom',
            originalError: error
        };
    }

    return {
        type: 'unknown',
        message: `Napaka: ${error.message || 'Neznana napaka'}`,
        originalError: error
    };
}

/**
 * Custom hook for fetching stations data
 * With improved persistence and offline support
 * 
 * @returns {Object} TanStack Query result for stations data
 */
export function useStationsQuery() {
    // Create a persistor to check for cached data
    const persistor = createLocalStoragePersistor();

    return useQuery(() => ({
        queryKey: queryKeys.stations(),
        queryFn: async () => {
            try {
                // Try to get stations from network
                const result = await loadStations();
                if (!result.success) {
                    // If network request fails, try to get from persistence
                    const persistedStations = persistor.getPersistedQuery(['stations']);
                    if (persistedStations) {
                        console.info('Using persisted stations data from cache');
                        return persistedStations;
                    }

                    // If no persisted data, throw the original error
                    throw new Error(result.error || 'Failed to load stations');
                }
                return result.stations;
            } catch (error) {
                // Check for persisted data if network request fails
                const persistedStations = persistor.getPersistedQuery(['stations']);
                if (persistedStations) {
                    console.info('Using persisted stations data due to network error');
                    return persistedStations;
                }

                throw categorizeError(error, 'stations');
            }
        },
        // Using defaults from queryClient.setQueryDefaults for 'stations'
    }));
}

/**
 * Custom hook for fetching weather data for a specific station
 * With improved revalidation strategy and aggressive SWR pattern
 * 
 * @param {number} stationId - The ID of the station to fetch data for
 * @returns {Object} TanStack Query result for weather data
 */
export function useWeatherQuery(stationId) {
    // Create a persistor to check for cached data
    const persistor = createLocalStoragePersistor();

    // Using this format with the callback to ensure reactive dependencies
    // are properly tracked
    return useQuery(() => {
        // Get cached data for use as placeholder
        const cachedData = persistor.getPersistedQuery(queryKeys.weatherData(stationId));

        return {
            queryKey: queryKeys.weatherData(stationId),
            queryFn: async ({ signal }) => {
                try {
                    if (!stationId) return null;

                    const result = await requestData(stationId, { signal });
                    if (!result.success) {
                        // If network request fails, try to get from persistence
                        const persistedData = persistor.getPersistedQuery(queryKeys.weatherData(stationId));
                        if (persistedData) {
                            console.info(`Using persisted weather data for station ${stationId}`);
                            return persistedData;
                        }

                        throw new Error(result.error || `Failed to load data for station ${stationId}`);
                    }
                    return result.data;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        throw { type: 'aborted', message: 'Request was cancelled' };
                    }

                    // Check for persisted data if network request fails
                    const persistedData = persistor.getPersistedQuery(queryKeys.weatherData(stationId));
                    if (persistedData) {
                        console.info(`Using persisted weather data due to network error for station ${stationId}`);
                        return persistedData;
                    }

                    throw categorizeError(error, `weather-${stationId}`);
                }
            },
            enabled: !!stationId,
            // Use placeholderData for immediate rendering while fetching (key SWR feature)
            placeholderData: cachedData,
            // Always keep previous data visible while loading new data
            keepPreviousData: true,
        };
    });
}

/**
 * Export the query client singleton for direct access
 * This allows components to directly interact with the query cache
 * when needed outside of hooks
 */
import { queryClient as appQueryClient } from "../QueryProvider.jsx";

/**
 * Returns the singleton QueryClient instance from QueryProvider
 * This ensures all components use the same instance with the same cache
 * and the same persistence mechanisms
 * 
 * @returns {QueryClient} The application's singleton QueryClient instance
 */
export function getQueryClient() {
    return appQueryClient;
}
