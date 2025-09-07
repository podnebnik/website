import { useQuery, UseQueryResult } from '@tanstack/solid-query';
import { requestData, loadStations, requestHistoricalWindow } from '../helpers';
import { createLocalStoragePersistor } from '../utils/persistence';
import type { ProcessedTemperatureData, ProcessedStation, HistoricalTemperatureData, HistoricalDataQueryParams } from '../../types/models.js';
import type { CategorizedError } from '../../types/queries.js';

/**
 * Query key factory helps organize and structure query keys
 */
export const queryKeys = {
    stations: () => ['stations'],
    weatherData: (stationId: string) => ['weatherData', stationId],
    historicalData: (stationId: number, centerMmdd: string, windowDays: number) => 
        ['historicalData', stationId, centerMmdd, windowDays],
};

/**
 * Categorize error by type for better error handling
 */
function categorizeError(error: unknown, context: string = ''): CategorizedError {
    // Type guard to ensure we have an Error object
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    if (!navigator.onLine) {
        return {
            type: 'network',
            message: 'Ni povezave z internetom',
            originalError: errorObj,
            context
        };
    }

    if (errorObj.message?.includes('Failed to fetch') || errorObj instanceof TypeError) {
        return {
            type: 'network',
            message: 'Napaka pri povezavi s strežnikom',
            originalError: errorObj,
            context
        };
    }

    return {
        type: 'unknown',
        message: `Napaka: ${errorObj.message || 'Neznana napaka'}`,
        originalError: errorObj,
        context
    };
}

/**
 * Custom hook for fetching stations data
 * With improved persistence and offline support
 * 
 * @returns TanStack Query result for stations data
 */
export function useStationsQuery(): UseQueryResult<ProcessedStation[], CategorizedError> {
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
                    const errorMessage = 'error' in result && result.error instanceof Error ? result.error.message : String('error' in result ? result.error : 'Unknown error');
                    throw new Error(errorMessage || 'Failed to load stations');
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
 * @param stationId - The ID of the station to fetch data for
 * @returns TanStack Query result for weather data
 */
export function useWeatherQuery(stationId: string): UseQueryResult<ProcessedTemperatureData | null, CategorizedError> {
    // Create a persistor to check for cached data
    const persistor = createLocalStoragePersistor();

    // Using this format with the callback to ensure reactive dependencies
    // are properly tracked
    return useQuery(() => {
        // Get cached data for use as placeholder
        const cachedData = persistor.getPersistedQuery<ProcessedTemperatureData>(queryKeys.weatherData(stationId));

        return {
            queryKey: queryKeys.weatherData(stationId),
            queryFn: async ({ signal }) => {
                try {
                    if (!stationId) return null;

                    const result = await requestData(stationId, { signal });
                    if (!result.success) {
                        // If network request fails, try to get from persistence
                        const persistedData = persistor.getPersistedQuery<ProcessedTemperatureData>(queryKeys.weatherData(stationId));
                        if (persistedData) {
                            console.info(`Using persisted weather data for station ${stationId}`);
                            return persistedData;
                        }

                        const errorMessage = 'error' in result && result.error instanceof Error ? result.error.message : String('error' in result ? result.error : 'Unknown error');
                        throw new Error(errorMessage || `Failed to load data for station ${stationId}`);
                    }
                    return result.data;
                } catch (error) {
                    // Type guard for error handling
                    const errorObj = error instanceof Error ? error : new Error(String(error));
                    
                    if (errorObj.name === 'AbortError') {
                        throw { type: 'aborted', message: 'Request was cancelled' };
                    }

                    // Check for persisted data if network request fails
                    const persistedData = persistor.getPersistedQuery<ProcessedTemperatureData>(queryKeys.weatherData(stationId));
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
 * Custom hook for fetching historical temperature data for seasonal charts
 * Wraps the requestHistoricalWindow function with TanStack Query for caching and error handling
 *
 * @param params - Historical data query parameters
 * @param params.station_id - The ID of the station to fetch data for
 * @param params.center_mmdd - Center date in MM-DD format (e.g., "07-15" for July 15th)
 * @param params.window_days - Number of days to include in the window around the center date
 * @returns TanStack Query result for historical temperature data
 * 
 * @example
 * ```typescript
 * const { data, isLoading, error } = useHistoricalDataQuery({
 *   station_id: 123,
 *   center_mmdd: "07-15",
 *   window_days: 30
 * });
 * ```
 */
export function useHistoricalDataQuery(params: HistoricalDataQueryParams): UseQueryResult<HistoricalTemperatureData, CategorizedError> {
    const { station_id, center_mmdd, window_days } = params;

    return useQuery(() => ({
        queryKey: queryKeys.historicalData(station_id, center_mmdd, window_days),
        queryFn: async ({ signal }) => {
            try {
                // Validate parameters
                if (!station_id || !center_mmdd || window_days <= 0) {
                    throw new Error('Neveljavni parametri za zgodovinske podatke');
                }

                // Call the existing requestHistoricalWindow function
                const result = await requestHistoricalWindow({
                    station_id,
                    center_mmdd,
                    window_days
                });

                return result;
            } catch (error) {
                // Type guard for error handling  
                const errorObj = error instanceof Error ? error : new Error(String(error));
                
                if (errorObj.name === 'AbortError' || signal?.aborted) {
                    throw { type: 'aborted', message: 'Zahteva je bila prekinjeta' };
                }

                throw categorizeError(error, `historical-${station_id}-${center_mmdd}-${window_days}`);
            }
        },
        enabled: !!station_id && !!center_mmdd && window_days > 0,
        // Historical data rarely changes, so we can use longer stale time
        staleTime: 1000 * 60 * 15, // 15 minutes as specified in task requirements
        // Keep cached data longer since historical data doesn't change often
        gcTime: 1000 * 60 * 60 * 4, // 4 hours
        // Don't refetch on mount/focus since historical data is stable
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true, // Still refetch on reconnect for reliability
    }));
}

/**
 * Export the query client singleton for direct access
 * This allows components to directly interact with the query cache
 * when needed outside of hooks
 */
// @ts-ignore - QueryProvider.tsx is the TypeScript version
import { queryClient as appQueryClient } from "../QueryProvider.tsx";

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
