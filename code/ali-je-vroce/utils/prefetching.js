import { queryKeys } from "../hooks/queries.js";
import { requestData } from "../helpers.mjs";

/**
 * Popular weather stations in Slovenia that are frequently accessed by users
 * Using these IDs for prefetching to improve perceived performance
 */
export const POPULAR_STATION_IDS = [
    1495, // Ljubljana
    1491, // Maribor
    1025, // Celje
    1447  // Novo mesto
];

/**
 * Prefetches weather data for popular stations to improve user experience
 * This function can be called on initial load or during idle periods
 * 
 * @param {Object} queryClient - The TanStack Query client instance
 * @returns {Promise<Array>} - Promise that resolves when all prefetch operations complete
 */
export function prefetchPopularStations(queryClient) {

    return Promise.all(
        POPULAR_STATION_IDS.map(id =>
            queryClient.prefetchQuery({
                queryKey: queryKeys.weatherData(id),
                queryFn: () => requestData(id).then(result => {
                    if (!result.success) {
                        throw new Error(result.error || `Failed to prefetch data for station ${id}`);
                    }
                    return result.data;
                }),
                staleTime: 1000 * 60 * 5, // 5 minutes
            })
        )
    );
}

/**
 * Prefetches all stations list data
 * This is useful to call during initialization to ensure stations are available quickly
 * 
 * @param {Object} queryClient - The TanStack Query client instance
 * @returns {Promise} - Promise that resolves when prefetch operation completes
 */
export function prefetchStationsData(queryClient) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.stations(),
        queryFn: async () => {
            const { loadStations } = await import('../helpers.mjs');
            const result = await loadStations();
            if (!result.success) {
                throw new Error(result.error || 'Failed to prefetch stations list');
            }
            return result.stations;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
}
