/**
 * Utilities for optimistic UI updates to improve perceived performance
 * These functions help predict data while actual requests are in progress
 */

import type { ProcessedTemperatureData } from '../../types/models.js';

/**
 * Generates an optimistic data object for a station change
 * This provides a placeholder while actual data is being fetched
 * 
 * @param newStationId - The ID of the station being changed to
 * @param {Object} previousData - Previous data for another station, used as baseline
 * @param {Object} queryClient - The TanStack Query client to check for cached data
 * @param {Function} queryKeys - The query keys factory function
 * @returns {Object} An optimistic data object that can be shown while loading
 */
export function generateOptimisticWeatherData(newStationId: number, previousData: ProcessedTemperatureData | null, queryClient: any, queryKeys: any) {
    // First try to get data from cache if available
    const cachedData = queryClient.getQueryData(queryKeys.weatherData(newStationId));

    if (cachedData) {
        // If we have cached data, use it but mark it as potentially stale
        return {
            ...cachedData,
            timeUpdated: `${cachedData.timeUpdated} (osvežujem...)`
        };
    }

    // If no cached data, generate placeholder based on previous data
    // This is just a placeholder until real data arrives
    if (!previousData) {
        return null;
    }

    return {
        resultValue: 'p40', // Assume average value as placeholder
        resultTemperatureValue: '...',
        tempMin: '...',
        timeMin: '...',
        tempMax: '...',
        timeMax: '...',
        tempAvg: '...',
        timeUpdated: 'Nalagam sveže podatke...',
    };
}
