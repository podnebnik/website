/** @import * as Types "../types.js" */

import { queryKeys } from "../hooks/queries.js";
import { requestData } from "../helpers.mjs";
import { QueryClient } from "@tanstack/solid-query";

/**
 * Popular weather stations in Slovenia that are frequently accessed by users
 * Using these IDs for prefetching to improve perceived performance
 * @constant {number[]} POPULAR_STATION_IDS
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
 * @param {QueryClient} queryClient - The TanStack Query client instance
 * @returns {Promise<Array<Types.StationsResult>>} - Promise that resolves when all prefetch operations complete
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
 * Prefetches weather data for a specific station by its ID
 * Enhanced with better error handling and debugging
 * 
 * @param {QueryClient} queryClient - The TanStack Query client instance
 * @param {number} stationId - The ID of the station to prefetch data for
 * @returns {Promise<Types.StationsResult|null>} - Promise that resolves when prefetch operation completes
 */
export function prefetchStationData(queryClient, stationId) {
    console.log(`Prefetching data for station ${stationId}`);

    // Don't prefetch if already in cache and not stale
    const existingQuery = queryClient.getQueryState(queryKeys.weatherData(stationId));
    if (existingQuery && !existingQuery.isStale) {
        console.log(`Station ${stationId} data already in cache and fresh, skipping prefetch`);
        return Promise.resolve(existingQuery.data);
    }

    return queryClient.prefetchQuery({
        queryKey: queryKeys.weatherData(stationId),
        queryFn: () => requestData(stationId).then(result => {
            if (!result.success) {
                console.warn(`Failed to prefetch data for station ${stationId}:`, result.error);
                throw new Error(result.error || `Failed to prefetch data for station ${stationId}`);
            }
            console.log(`Successfully prefetched data for station ${stationId}`);
            return result.data;
        }),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Prefetches all stations list data
 * This is useful to call during initialization to ensure stations are available quickly
 * 
 * @param {QueryClient} queryClient - The TanStack Query client instance
 * @returns {Promise<Array<Types.ProcessedStation>>} - Promise that resolves when prefetch operation completes
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
