import { VREMENAR_BASE_URL } from "../constants.mjs";

/**
 * A Map to track pending batch requests by batch ID
 */
const pendingBatches = new Map();

/**
 * A utility for batching multiple station data requests together
 * to reduce network overhead when multiple pieces of data are needed
 */

/**
 * Fetch data for multiple stations in a single network request
 * 
 * @param {number[]} stationIds - Array of station IDs to fetch data for
 * @param {Object} options - Request options
 * @param {AbortSignal} options.signal - Optional AbortController signal
 * @returns {Promise<Object>} Object mapping station IDs to their data
 */
export async function batchFetchStationData(stationIds, options = {}) {
    if (!stationIds || !stationIds.length) {
        return { success: false, error: "No station IDs provided" };
    }

    try {
        // Create a unique batch ID for this request
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Format the query string for the request
        const queryString = stationIds.map(id => `id=METEO-${id}`).join('&');
        const requestUrl = `${VREMENAR_BASE_URL}/stations/batch?${queryString}`;

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
        const batchData = await response.json();

        if (!batchData || !batchData.stations) {
            throw new Error("Invalid batch response format");
        }

        // Process the batch response into individual station data
        const processedData = {};

        // Convert the response data into the expected format for each station
        for (const stationData of batchData.stations) {
            const stationId = stationData.id.replace('METEO-', ''); // Extract numeric ID

            // Format the data for this station
            processedData[stationId] = {
                // We'd map the batch response format to our expected data format here
                // This would depend on the actual API response structure
            };
        }

        return {
            success: true,
            data: processedData
        };
    } catch (error) {
        // If the request was aborted, propagate the abort error
        if (error.name === 'AbortError') {
            throw error;
        }

        console.error('Error in batch fetch:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch batch data'
        };
    }
}

/**
 * Queue a station for the next batch request
 * 
 * @param {number} stationId - Station ID to queue
 * @param {Object} options - Batch options
 * @param {number} options.timeout - Timeout in ms before sending the batch (default: 50ms)
 * @param {AbortSignal} options.signal - AbortController signal
 * @returns {Promise<Object>} - Promise that resolves with the station data
 */
export function queueBatchRequest(stationId, options = {}) {
    const timeout = options.timeout || 50; // Default 50ms batch window

    // Create a promise that will resolve with the station's data
    return new Promise((resolve, reject) => {
        // If no active batch exists, create one
        if (!pendingBatches.has('current')) {
            const batchData = {
                stationIds: new Set(),
                waiters: new Map(),
                controller: new AbortController(),
                timeoutId: null
            };

            // Set up the timeout to execute the batch
            batchData.timeoutId = setTimeout(() => {
                executeBatch();
            }, timeout);

            pendingBatches.set('current', batchData);
        }

        const batch = pendingBatches.get('current');

        // Add this station to the batch
        batch.stationIds.add(stationId);

        // Register this promise to be resolved when the batch completes
        if (!batch.waiters.has(stationId)) {
            batch.waiters.set(stationId, []);
        }
        batch.waiters.get(stationId).push({ resolve, reject });

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
async function executeBatch() {
    // Get the current batch
    const batch = pendingBatches.get('current');
    if (!batch) return;

    // Remove it from the pending batches
    pendingBatches.delete('current');

    // Clear the timeout to prevent double-execution
    clearTimeout(batch.timeoutId);

    try {
        // Convert the Set to an array for the request
        const stationIds = Array.from(batch.stationIds);

        // No stations to fetch
        if (stationIds.length === 0) return;

        // Make the batch request
        const result = await batchFetchStationData(stationIds, {
            signal: batch.controller.signal
        });

        if (result.success) {
            // Resolve each waiter with its station data
            for (const [stationId, waiters] of batch.waiters.entries()) {
                const stationData = result.data[stationId];
                waiters.forEach(({ resolve }) => resolve(stationData));
            }
        } else {
            // Reject all waiters with the error
            for (const waiters of batch.waiters.values()) {
                waiters.forEach(({ reject }) => reject(new Error(result.error)));
            }
        }
    } catch (error) {
        // Reject all waiters with the error
        for (const waiters of batch.waiters.values()) {
            waiters.forEach(({ reject }) => reject(error));
        }
    }
}
