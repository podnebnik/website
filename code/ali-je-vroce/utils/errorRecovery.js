/**
 * Error recovery utilities for more resilient data fetching
 */

/**
 * Exponential backoff retry mechanism for failed requests
 * 
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if retry is needed
 * @returns {Promise<*>} Result of the operation
 */
export async function retryWithBackoff(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const initialDelay = options.initialDelay || 1000;
    const maxDelay = options.maxDelay || 10000;
    const shouldRetry = options.shouldRetry || ((error) => true); // Default to retry all errors

    let retryCount = 0;
    let lastError = null;

    while (retryCount <= maxRetries) {
        try {
            // If this is a retry, add a delay with exponential backoff
            if (retryCount > 0) {
                const delay = Math.min(initialDelay * Math.pow(2, retryCount - 1), maxDelay);
                console.info(`Retry attempt ${retryCount}/${maxRetries} after ${delay}ms delay`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Try the operation
            return await operation();
        } catch (error) {
            lastError = error;

            // Check if we should retry this error
            if (!shouldRetry(error)) {
                console.info('Error not eligible for retry:', error);
                throw error;
            }

            // If we've reached max retries, throw the last error
            if (retryCount >= maxRetries) {
                console.warn(`Max retries (${maxRetries}) reached. Giving up.`, error);
                throw error;
            }

            retryCount++;
            console.warn(`Operation failed, scheduling retry ${retryCount}/${maxRetries}`, error);
        }
    }

    // This should never be reached due to the throw in the loop
    throw lastError;
}

/**
 * Enhanced version of retryLoadingData that uses exponential backoff
 * 
 * @param {Function} refetchFn - The function to retry (usually query.refetch)
 * @param {Object} options - Retry options
 * @returns {Promise<*>} - Promise that resolves when data is loaded or max retries reached
 */
export async function retryLoadingWithBackoff(refetchFn, options = {}) {
    return retryWithBackoff(
        () => refetchFn(),
        {
            maxRetries: options.maxRetries || 3,
            initialDelay: options.initialDelay || 1000,
            maxDelay: options.maxDelay || 10000,
            shouldRetry: (error) => {
                // Don't retry aborted requests
                if (error.name === 'AbortError') return false;

                // Don't retry if we're offline
                if (!navigator.onLine) return false;

                return true;
            }
        }
    );
}

/**
 * Network status monitor to react to online/offline changes
 * 
 * @param {Object} options - Options for the monitor
 * @param {Function} options.onOnline - Callback when connection is restored
 * @param {Function} options.onOffline - Callback when connection is lost
 * @returns {Object} - Object with setup and cleanup methods
 */
export function createNetworkMonitor(options = {}) {
    const { onOnline, onOffline } = options;

    // Event handlers
    const handleOnline = () => {
        console.info('Network connection restored');
        if (onOnline) onOnline();
    };

    const handleOffline = () => {
        console.warn('Network connection lost');
        if (onOffline) onOffline();
    };

    return {
        /**
         * Set up network monitoring
         */
        setup() {
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
        },

        /**
         * Clean up network monitoring
         */
        cleanup() {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        }
    };
}
