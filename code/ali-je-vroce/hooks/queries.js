import { useQuery, QueryClient } from '@tanstack/solid-query';
import { requestData, loadStations } from '../helpers.mjs';

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
 * 
 * @returns {Object} TanStack Query result for stations data
 */
export function useStationsQuery() {
    return useQuery(() => ({
        queryKey: queryKeys.stations(),
        queryFn: async () => {
            try {
                const result = await loadStations();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to load stations');
                }
                return result.stations;
            } catch (error) {
                throw categorizeError(error, 'stations');
            }
        },
        // Using defaults from queryClient.setQueryDefaults for 'stations'
    }));
}

/**
 * Custom hook for fetching weather data for a specific station
 * With improved revalidation strategy for fresher data
 * 
 * @param {number} stationId - The ID of the station to fetch data for
 * @returns {Object} TanStack Query result for weather data
 */
export function useWeatherQuery(stationId) {
    // Using this format with the callback to ensure reactive dependencies
    // are properly tracked
    return useQuery(() => ({
        queryKey: queryKeys.weatherData(stationId),
        queryFn: async ({ signal }) => {
            try {
                if (!stationId) return null;
                
                const result = await requestData(stationId, { signal });
                if (!result.success) {
                    throw new Error(result.error || `Failed to load data for station ${stationId}`);
                }
                return result.data;
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw { type: 'aborted', message: 'Request was cancelled' };
                }
                throw categorizeError(error, `weather-${stationId}`);
            }
        },
        enabled: !!stationId,
        // Automatic background refreshes for fresher data
        refetchInterval: 1000 * 60 * 10, // Refresh every 10 minutes
        refetchIntervalInBackground: true, // Continue refreshing even when tab is not focused
        // Using defaults from queryClient.setQueryDefaults for 'weatherData'
    }));
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
                staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
                retry: 2,
                refetchOnWindowFocus: "always",
                refetchOnMount: "always",
                refetchOnReconnect: "always",
                refetchOnStale: true,
                refetchInterval: 1000 * 60 * 10, // Refresh every 10 minutes
                refetchIntervalInBackground: true, // Continue refreshing even when tab is not focused
                cacheTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
            }
        );
    }
    
    return _queryClient;
}
