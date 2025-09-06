import { STAGING_VREMENAR_API_URL } from "../constants.ts";

// TODO: Did we forgot to remove this file or we plan to use it and forgot about it?

/**
 * Interface for batch request options
 */
export interface BatchRequestOptions {
    signal?: AbortSignal;
    timeout?: number;
}

/**
 * Interface for station data (based on what the API returns)
 */
export interface StationData {
    [key: string]: any; // Flexible structure for station data
}

/**
 * Interface for batch fetch result
 */
export interface BatchFetchResult {
    success: boolean;
    data?: Record<string, StationData>;
    error?: string;
}

/**
 * Interface for batch promise waiter
 */
interface BatchWaiter {
    resolve: (value: StationData) => void;
    reject: (reason: Error) => void;
}

/**
 * Interface for batch data structure
 */
interface BatchData {
    stationIds: Set<number>;
    waiters: Map<number, BatchWaiter[]>;
    controller: AbortController;
    timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Interface for batch API response
 */
interface BatchApiResponse {
    stations: Array<{
        id: string;
        [key: string]: any;
    }>;
}

/**
 * A Map to track pending batch requests by batch ID
 */
const pendingBatches = new Map<string, BatchData>();

/**
 * A utility for batching multiple station data requests together
 * to reduce network overhead when multiple pieces of data are needed
 */

/**
 * Fetch data for multiple stations in a single network request
 */
export async function batchFetchStationData(
    stationIds: number[], 
    options: BatchRequestOptions = {}
): Promise<BatchFetchResult> {
    if (!stationIds || !stationIds.length) {
        return { success: false, error: "No station IDs provided" };
    }

    try {
        // Format the query string for the request
        const queryString = stationIds.map(id => `id=METEO-${id}`).join('&');
        const requestUrl = `${STAGING_VREMENAR_API_URL}/stations/batch?${queryString}`;

        // Make the API request with the given options
        const response = await fetch(requestUrl, {
            signal: options.signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Batch request failed with status ${response.status}`);
        }

        // Parse and process the response
        const batchData: BatchApiResponse = await response.json();

        if (!batchData || !batchData.stations) {
            throw new Error("Invalid batch response format");
        }

        // Process the batch response into individual station data
        const processedData: Record<string, StationData> = {};

        // Convert the response data into the expected format for each station
        for (const stationData of batchData.stations) {
            const stationId = stationData.id.replace('METEO-', ''); // Extract numeric ID

            // Format the data for this station
            processedData[stationId] = {
                // We'd map the batch response format to our expected data format here
                // This would depend on the actual API response structure
                ...stationData
            };
        }

        return {
            success: true,
            data: processedData
        };
    } catch (error) {
        // If the request was aborted, propagate the abort error
        if (error instanceof Error && error.name === 'AbortError') {
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch batch data';
        console.error('Error in batch fetch:', error);
        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Queue a station for the next batch request
 */
export function queueBatchRequest(
    stationId: number, 
    options: BatchRequestOptions = {}
): Promise<StationData> {
    const timeout = options.timeout || 50; // Default 50ms batch window

    // Create a promise that will resolve with the station's data
    return new Promise<StationData>((resolve, reject) => {
        // If no active batch exists, create one
        if (!pendingBatches.has('current')) {
            const batchData: BatchData = {
                stationIds: new Set<number>(),
                waiters: new Map<number, BatchWaiter[]>(),
                controller: new AbortController(),
                timeoutId: null
            };

            // Set up the timeout to execute the batch
            batchData.timeoutId = setTimeout(() => {
                executeBatch();
            }, timeout);

            pendingBatches.set('current', batchData);
        }

        const batch = pendingBatches.get('current')!;

        // Add this station to the batch
        batch.stationIds.add(stationId);

        // Register this promise to be resolved when the batch completes
        if (!batch.waiters.has(stationId)) {
            batch.waiters.set(stationId, []);
        }
        batch.waiters.get(stationId)!.push({ resolve, reject });

        // If the request has an abort signal, listen for abort events
        if (options.signal) {
            options.signal.addEventListener('abort', () => {
                // Remove this station from the batch if possible
                batch.stationIds.delete(stationId);

                // Reject this specific waiter
                reject(new DOMException('Aborted', 'AbortError'));
            });
        }
    });
}

/**
 * Execute the current batch request
 */
async function executeBatch(): Promise<void> {
    // Get the current batch
    const batch = pendingBatches.get('current');
    if (!batch) return;

    // Remove it from the pending batches
    pendingBatches.delete('current');

    // Clear the timeout to prevent double-execution
    if (batch.timeoutId) {
        clearTimeout(batch.timeoutId);
    }

    try {
        // Convert the Set to an array for the request
        const stationIds = Array.from(batch.stationIds);

        // No stations to fetch
        if (stationIds.length === 0) return;

        // Make the batch request
        const result = await batchFetchStationData(stationIds, {
            signal: batch.controller.signal
        });

        if (result.success && result.data) {
            // Resolve each waiter with its station data
            for (const [stationId, waiters] of batch.waiters.entries()) {
                const stationData = result.data[stationId.toString()];
                if (stationData) {
                    waiters.forEach(({ resolve }) => resolve(stationData));
                } else {
                    waiters.forEach(({ reject }) => reject(new Error(`No data found for station ${stationId}`)));
                }
            }
        } else {
            // Reject all waiters with the error
            const errorMessage = result.error || 'Unknown batch request error';
            for (const waiters of batch.waiters.values()) {
                waiters.forEach(({ reject }) => reject(new Error(errorMessage)));
            }
        }
    } catch (error) {
        // Reject all waiters with the error
        const errorToReject = error instanceof Error ? error : new Error('Unknown batch execution error');
        for (const waiters of batch.waiters.values()) {
            waiters.forEach(({ reject }) => reject(errorToReject));
        }
    }
}
