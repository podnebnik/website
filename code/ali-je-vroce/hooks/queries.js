import { useQuery, QueryClient } from '@tanstack/solid-query';
import { requestData, loadStations } from '../helpers.mjs';
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

            // Using defaults from queryClient.setQueryDefaults for 'weatherData'
        };
    });
}

/**
 * Export the query client singleton for direct access
 * This allows components to directly interact with the query cache
 * when needed outside of hooks
 */
let _queryClient = null;

export function getQueryClient() {
    if (!_queryClient) {
        _queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: 1,
                    refetchOnMount: true,
                    refetchOnWindowFocus: true,
                    refetchOnReconnect: true,
                },
            },
        });

        // Set up the same defaults as in QueryProvider
        _queryClient.setQueryDefaults(
            ['stations'],
            {
                staleTime: 1000 * 60 * 30,
                retry: 2,
                cacheTime: 1000 * 60 * 60,
            }
        );

        _queryClient.setQueryDefaults(
            ['weatherData'],
            {
                // Significantly increase staleTime to reduce immediate refetches
                staleTime: 1000 * 60 * 15, // 15 minutes - consider data fresh for longer

                retry: 2,

                // Always return cached data first (stale-while-revalidate pattern)
                refetchOnWindowFocus: true, // Changed from "always" to use the cached data first
                refetchOnMount: true, // Changed from "always" to use the cached data first
                refetchOnReconnect: true, // Changed from "always" to use the cached data first
                refetchOnStale: true,

                // Keep background refreshes for up-to-date data
                refetchInterval: 1000 * 60 * 15, // 15 minutes - less aggressive refreshing
                refetchIntervalInBackground: true, // Continue refreshing even when tab is not focused

                // Dramatically increase cache time for better offline support
                cacheTime: 1000 * 60 * 60 * 24, // 24 hours - keep data in cache much longer

                // This is key for SWR pattern - always keep previous data visible while fetching
                keepPreviousData: true,
            }
        );

        // Initialize storage persistor
        const persistor = createLocalStoragePersistor();

        // Clean up expired cache entries
        persistor.cleanupCache();

        // Set up event listeners to save queries to localStorage
        _queryClient.getQueryCache().subscribe(event => {
            if (event.type === 'success' && event.query.state.data) {
                // Only persist certain queries
                const queryKey = event.query.queryKey;

                // Don't persist empty data
                if (!event.query.state.data) return;

                // Determine if query should be persisted
                if (queryKey[0] === 'stations') {
                    // Always persist stations list
                    persistor.persistQuery(queryKey, event.query.state.data);
                } else if (queryKey[0] === 'weatherData') {
                    // Only persist weather data for popular stations or if explicit
                    persistor.persistQuery(queryKey, event.query.state.data);
                }
            }
        });

        // Add hydration logic to restore queries from persistence
        setTimeout(() => {
            try {
                // Restore stations data
                const stationsData = persistor.getPersistedQuery(['stations']);
                if (stationsData) {
                    _queryClient.setQueryData(['stations'], stationsData);
                }

                // For weather data, we'd need to know the specific station IDs
                // This could be expanded to handle more complex scenarios
            } catch (err) {
                console.warn('Error hydrating query client from persistence:', err);
            }
        }, 0);
    }

    return _queryClient;
}
