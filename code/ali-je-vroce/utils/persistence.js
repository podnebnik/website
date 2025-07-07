/**
 * Data persistence utilities for caching query data
 * This improves offline support and reduces unnecessary network requests
 */

/**
 * Creates a persistor that saves TanStack Query cache to localStorage
 * 
 * @returns {Object} A persistor object that can store and retrieve query cache
 */
export function createLocalStoragePersistor() {
    // Storage key for query cache data
    const CACHE_KEY_PREFIX = 'ali-je-vroce-cache';
    // Maximum age of cached data (1 hour)
    const MAX_CACHE_AGE = 1000 * 60 * 60;

    return {
        /**
         * Persists query data to localStorage
         * 
         * @param {Object} data - Query data to persist
         */
        persistQuery: (queryKey, data) => {
            try {
                if (!data) return;

                // Convert queryKey to a string for storage
                const key = Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey);
                const storageKey = `${CACHE_KEY_PREFIX}-${key}`;

                // Add timestamp for cache expiration
                const persistData = {
                    data,
                    timestamp: Date.now()
                };

                // Store in localStorage
                try {
                    const jsonData = JSON.stringify(persistData);
                    localStorage.setItem(storageKey, jsonData);
                } catch (storageError) {
                    console.warn('LocalStorage operation failed:', storageError);
                }
            } catch (error) {
                console.warn('Failed to persist query data to localStorage:', error);
            }
        },

        /**
         * Retrieves query data from localStorage if available and not expired
         * 
         * @param {Array|string} queryKey - The query key to retrieve data for
         * @returns {Object|null} The stored data or null if not found/expired
         */
        getPersistedQuery: (queryKey) => {
            try {
                // Convert queryKey to a string for storage lookup
                const key = Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey);
                const storageKey = `${CACHE_KEY_PREFIX}-${key}`;

                // Get data from localStorage
                const storedItem = localStorage.getItem(storageKey);
                if (!storedItem) return null;

                // Parse the stored data
                const { data, timestamp } = JSON.parse(storedItem);

                // Check if data is expired
                const isExpired = Date.now() - timestamp > MAX_CACHE_AGE;
                if (isExpired) {
                    // Clean up expired data
                    localStorage.removeItem(storageKey);
                    return null;
                }

                return data;
            } catch (error) {
                console.warn('Failed to retrieve persisted query data:', error);
                return null;
            }
        },

        /**
         * Removes expired cache entries from localStorage
         */
        cleanupCache: () => {
            try {
                // Get all localStorage keys
                const keys = Object.keys(localStorage);

                // Filter keys that match our cache prefix
                const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

                // Check each cache entry for expiration
                cacheKeys.forEach(key => {
                    const storedItem = localStorage.getItem(key);
                    if (!storedItem) return;

                    try {
                        const { timestamp } = JSON.parse(storedItem);
                        const isExpired = Date.now() - timestamp > MAX_CACHE_AGE;

                        if (isExpired) {
                            localStorage.removeItem(key);
                        }
                    } catch {
                        // If we can't parse it, remove it
                        localStorage.removeItem(key);
                    }
                });
            } catch (error) {
                console.warn('Error cleaning up cache:', error);
            }
        }
    };
}
