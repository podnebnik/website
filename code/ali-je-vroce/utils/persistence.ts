/**
 * Data persistence utilities for caching query data
 * This improves offline support and reduces unnecessary network requests
 */
import { CACHE_KEY_PREFIX } from '../constants';
import type { QueryKey } from '@tanstack/solid-query';
import type { LocalStoragePersistor, PersistedQueryData } from '../../types/';

/**
 * Creates a persistor that saves TanStack Query cache to localStorage
 * 
 * @returns A persistor object that can store and retrieve query cache with type safety
 */
export function createLocalStoragePersistor(): LocalStoragePersistor {
    // Maximum age of cached data (1 hour)
    const MAX_CACHE_AGE = 1000 * 60 * 60;

    return {
        /**
         * Persists query data to localStorage with generic type support
         */
        persistQuery: <T>(queryKey: QueryKey, data: T): void => {
            try {
                if (!data) return;

                // Convert queryKey to a string for storage
                const key = Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey);
                const storageKey = `${CACHE_KEY_PREFIX}-${key}`;

                // Create persisted data structure
                const persistData: PersistedQueryData<T> = {
                    data,
                    timestamp: Date.now(),
                    queryKey
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
         * Retrieves query data from localStorage with generic type support
         */
        getPersistedQuery: <T>(queryKey: QueryKey): T | null => {
            try {
                // Convert queryKey to a string for storage lookup
                const key = Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey);
                const storageKey = `${CACHE_KEY_PREFIX}-${key}`;

                // Get data from localStorage
                const storedItem = localStorage.getItem(storageKey);
                if (!storedItem) return null;

                // Parse the stored data
                const persistedData: PersistedQueryData<T> = JSON.parse(storedItem);

                // Check if data is expired
                const isExpired = Date.now() - persistedData.timestamp > MAX_CACHE_AGE;
                if (isExpired) {
                    // Clean up expired data
                    localStorage.removeItem(storageKey);
                    return null;
                }

                return persistedData.data;
            } catch (error) {
                console.warn('Failed to retrieve persisted query data:', error);
                return null;
            }
        },

        /**
         * Removes a specific persisted query from localStorage
         */
        removePersistedQuery: (queryKey: QueryKey): void => {
            try {
                const key = Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey);
                const storageKey = `${CACHE_KEY_PREFIX}-${key}`;
                localStorage.removeItem(storageKey);
            } catch (error) {
                console.warn('Failed to remove persisted query:', error);
            }
        },

        /**
         * Removes all persisted queries and cleans up expired cache entries
         */
        clearAllPersistedQueries: (): void => {
            try {
                // Get all localStorage keys
                const keys = Object.keys(localStorage);

                // Filter keys that match our cache prefix
                const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

                // Remove all cache entries
                cacheKeys.forEach(key => {
                    localStorage.removeItem(key);
                });
            } catch (error) {
                console.warn('Error clearing persisted queries:', error);
            }
        },

        /**
         * Removes only expired cache entries from localStorage
         */
        cleanupExpiredQueries: (): void => {
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
                        const persistedData: PersistedQueryData = JSON.parse(storedItem);
                        const isExpired = Date.now() - persistedData.timestamp > MAX_CACHE_AGE;

                        if (isExpired) {
                            localStorage.removeItem(key);
                        }
                    } catch {
                        // If we can't parse it, remove it
                        localStorage.removeItem(key);
                    }
                });
            } catch (error) {
                console.warn('Error cleaning up expired queries:', error);
            }
        }
    };
}
