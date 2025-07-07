/**
 * Data persistence utilities for caching query data
 * This improves offline support and reduces unnecessary network requests
 */

/**
 * Creates a persistor that saves TanStack Query cache to localStorage
 * 
 * @returns {Object} A persistor object that can store and retrieve query cache
 */
// For debugging - can be called in browser console to test persistence
export function testPersistor() {
    const persistor = createLocalStoragePersistor();
    // Test with sample data
    persistor.persistQuery(['test-data'], { message: 'Test data persisted successfully' });
    return "Test data saved to localStorage - check for key 'ali-je-vroce-cache-test-data'";
}

export function createLocalStoragePersistor() {
    // Storage key for query cache data
    const CACHE_KEY_PREFIX = 'ali-je-vroce-cache';
    // Maximum age of cached data (1 hour)
    const MAX_CACHE_AGE = 1000 * 60 * 60;
    console.log('Creating localStorage persistor with prefix:', CACHE_KEY_PREFIX);

    return {
        /**
         * Persists query data to localStorage
         * 
         * @param {Object} data - Query data to persist
         */
        persistQuery: (queryKey, data) => {
            console.log('Persisting query data:', queryKey);
            try {
                if (!data) {
                    console.warn('No data provided for persistence');
                    return;
                }

                // Convert queryKey to a string for storage
                const key = Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey);
                const storageKey = `${CACHE_KEY_PREFIX}-${key}`;

                // Add timestamp for cache expiration
                const persistData = {
                    data,
                    timestamp: Date.now()
                };

                // Store in localStorage - with additional debug checks
                try {
                    // Try a simple localStorage test first
                    localStorage.setItem('test-persistence', 'Test ' + Date.now());

                    // Convert to JSON with error handling
                    let jsonData;
                    try {
                        jsonData = JSON.stringify(persistData);
                        console.log(`Data serialized successfully (${jsonData.length} bytes)`);
                    } catch (jsonError) {
                        console.error('Failed to serialize data to JSON:', jsonError);
                        return;
                    }

                    // Now try to store the actual data
                    localStorage.setItem(storageKey, jsonData);

                    console.log('Successfully persisted data to localStorage key:', storageKey);

                    // Verify it worked
                    const verificationCheck = localStorage.getItem(storageKey);
                    if (verificationCheck) {
                        console.log('Verification successful - data is in localStorage');
                    } else {
                        console.warn('Verification failed - data not found in localStorage after saving');
                    }
                } catch (storageError) {
                    console.error('LocalStorage operation failed:', storageError);
                    // Try with a smaller payload to see if it's a quota issue
                    try {
                        localStorage.setItem(`${CACHE_KEY_PREFIX}-test-minimal`, JSON.stringify({ test: 'minimal data' }));
                        console.log('Small test data stored successfully, might be a quota issue');
                    } catch (e) {
                        console.error('Even small data storage failed, localStorage might be disabled:', e);
                    }
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
            console.log('Retrieving persisted query data for:', queryKey);
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
            console.log('Cleaning up expired cache entries from localStorage');
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
