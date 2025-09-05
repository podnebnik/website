/**
 * Error recovery utilities for more resilient data fetching with TypeScript support
 */

// Type definitions for error handling
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
}

export interface NetworkMonitorOptions {
  onOnline?: () => void;
  onOffline?: () => void;
}

export interface NetworkMonitor {
  setup: () => void;
  cleanup: () => void;
}

/**
 * Exponential backoff retry mechanism for failed requests
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const initialDelay = options.initialDelay || 1000;
  const maxDelay = options.maxDelay || 10000;
  const shouldRetry = options.shouldRetry || ((error: Error) => true); // Default to retry all errors

  let retryCount = 0;
  let lastError: Error | null = null;

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
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Check if we should retry this error
      if (!shouldRetry(err)) {
        console.info('Error not eligible for retry:', err);
        throw err;
      }

      // If we've reached max retries, throw the last error
      if (retryCount >= maxRetries) {
        console.warn(`Max retries (${maxRetries}) reached. Giving up.`, err);
        throw err;
      }

      retryCount++;
      console.warn(`Operation failed, scheduling retry ${retryCount}/${maxRetries}`, err);
    }
  }

  // This should never be reached due to the throw in the loop
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('Unexpected error in retryWithBackoff');
}

/**
 * Enhanced version of retryLoadingData that uses exponential backoff
 */
export async function retryLoadingWithBackoff<T>(
  refetchFn: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(
    () => refetchFn(),
    {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      shouldRetry: (error: Error) => {
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
 */
export function createNetworkMonitor(options: NetworkMonitorOptions = {}): NetworkMonitor {
  const { onOnline, onOffline } = options;

  // Event handlers
  const handleOnline = (): void => {
    console.info('Network connection restored');
    if (onOnline) onOnline();
  };

  const handleOffline = (): void => {
    console.warn('Network connection lost');
    if (onOffline) onOffline();
  };

  return {
    /**
     * Set up network monitoring
     */
    setup(): void {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    },

    /**
     * Clean up network monitoring
     */
    cleanup(): void {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}
