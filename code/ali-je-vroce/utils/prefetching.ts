import { queryKeys } from "../hooks/queries.ts";
import { requestData, requestHistoricalWindow } from "../helpers.ts";
import { QueryClient } from "@tanstack/solid-query";
import type { ProcessedStation, ProcessedTemperatureData, HistoricalTemperatureData } from '../../types/models.js';

/**
 * Popular weather stations in Slovenia that are frequently accessed by users
 * Using these IDs for prefetching to improve perceived performance
 */
export const POPULAR_STATION_IDS: readonly number[] = [
    1495, // Ljubljana
    1491, // Maribor
    1025, // Celje
    1447  // Novo mesto
];

/**
 * Prefetches weather data for popular stations to improve user experience
 * This function can be called on initial load or during idle periods
 */
export function prefetchPopularStations(queryClient: QueryClient): Promise<(ProcessedTemperatureData | void)[]> {
    return Promise.all(
        POPULAR_STATION_IDS.map(id =>
            queryClient.prefetchQuery({
                queryKey: queryKeys.weatherData(String(id)),
                queryFn: async (): Promise<ProcessedTemperatureData> => {
                    const result = await requestData(String(id));
                    if (!result.success) {
                        const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
                        throw new Error(errorMessage || `Failed to prefetch data for station ${id}`);
                    }
                    return result.data;
                },
                staleTime: 1000 * 60 * 5, // 5 minutes
            }).catch((error: unknown) => {
                console.error(`Failed to prefetch station ${id}:`, error);
                // Return void to prevent promise rejection from breaking Promise.all
            })
        )
    );
}

/**
 * Prefetches weather data for a specific station by its ID
 * Enhanced with better error handling and debugging
 */
export function prefetchStationData(
    queryClient: QueryClient, 
    stationId: number
): Promise<ProcessedTemperatureData | void> {
    // Don't prefetch if already in cache and fresh (not stale)
    const existingQuery = queryClient.getQueryState(queryKeys.weatherData(String(stationId)));
    if (existingQuery && existingQuery.dataUpdatedAt && 
        Date.now() - existingQuery.dataUpdatedAt < 15 * 60 * 1000) { // 15 minutes stale time
        return Promise.resolve(existingQuery.data as ProcessedTemperatureData | undefined);
    }

    return queryClient.prefetchQuery({
        queryKey: queryKeys.weatherData(String(stationId)),
        queryFn: async (): Promise<ProcessedTemperatureData> => {
            const result = await requestData(String(stationId));
            if (!result.success) {
                console.warn(`Failed to prefetch data for station ${stationId}:`, result.error);
                const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
                throw new Error(errorMessage || `Failed to prefetch data for station ${stationId}`);
            }
            return result.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    }).catch((error: unknown) => {
        console.error(`Error prefetching station ${stationId}:`, error);
        // Return void to prevent promise rejection
    });
}

/**
 * Prefetches all stations list data
 * This is useful to call during initialization to ensure stations are available quickly
 */
export function prefetchStationsData(queryClient: QueryClient): Promise<ProcessedStation[] | void> {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.stations(),
        queryFn: async (): Promise<ProcessedStation[]> => {
            const { loadStations } = await import('../helpers.ts');
            const result = await loadStations();
            if (!result.success) {
                const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
                throw new Error(errorMessage || 'Failed to prefetch stations list');
            }
            return result.stations;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    }).catch((error: unknown) => {
        console.error('Error prefetching stations:', error);
        // Return void to prevent promise rejection
    });
}

/**
 * Prefetches historical data for a specific station and date window
 * This improves TODAY label consistency by ensuring historical data is available
 * when charts are rendered
 */
export function prefetchHistoricalData(
    queryClient: QueryClient,
    stationId: number,
    centerMmdd: string,
    windowDays: number = 14
): Promise<HistoricalTemperatureData | void> {
    // Don't prefetch if already in cache and fresh
    const existingQuery = queryClient.getQueryState(queryKeys.historicalData(stationId, centerMmdd, windowDays));
    if (existingQuery && existingQuery.dataUpdatedAt && 
        Date.now() - existingQuery.dataUpdatedAt < 15 * 60 * 1000) { // 15 minutes stale time
        return Promise.resolve(existingQuery.data as HistoricalTemperatureData | undefined);
    }

    return queryClient.prefetchQuery({
        queryKey: queryKeys.historicalData(stationId, centerMmdd, windowDays),
        queryFn: async (): Promise<HistoricalTemperatureData> => {
            const result = await requestHistoricalWindow({
                station_id: stationId,
                center_mmdd: centerMmdd,
                window_days: windowDays
            });
            return result;
        },
        staleTime: 1000 * 60 * 15, // 15 minutes - historical data is stable
    }).catch((error: unknown) => {
        console.error(`Error prefetching historical data for station ${stationId}:`, error);
        // Return void to prevent promise rejection
    });
}

/**
 * Prefetches historical data for popular stations around today's date
 * This ensures TODAY labels are consistent when users first visit the site
 */
export function prefetchPopularStationsHistoricalData(queryClient: QueryClient): Promise<(HistoricalTemperatureData | void)[]> {
    // Get today's MM-DD format
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayMmdd = `${mm}-${dd}`;

    return Promise.all(
        POPULAR_STATION_IDS.map(stationId =>
            prefetchHistoricalData(queryClient, stationId, todayMmdd, 14)
        )
    );
}
