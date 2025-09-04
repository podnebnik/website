/**
 * Application-specific TanStack Query types for the Podnebnik website
 * Leverages built-in TanStack Query types and adds app-speci// =============================================================================
// PERSISTENCE TYPES (Application-specific)
// ============================================================================= */

import { 
  QueryKey, 
} from '@tanstack/solid-query';
import { 
  ProcessedTemperatureData,
  ProcessedStation 
} from './api.js';

// =============================================================================
// APPLICATION QUERY KEY FACTORY
// =============================================================================

/**
 * Centralized query key factory for type safety and consistency
 * TanStack Query recommends using query key factories for better organization
 */
export const queryKeys = {
  // Station-related queries
  stations: () => ['stations'] as const,
  
  // Weather data queries  
  weatherData: (stationId: number) => ['weatherData', stationId] as const,
  
  // Add more query types as needed
  // percentiles: (stationId: number, date: string) => ['percentiles', stationId, date] as const,
} as const;

/**
 * All possible query keys in the application (derived from factory)
 */
export type AppQueryKey = ReturnType<typeof queryKeys[keyof typeof queryKeys]>;

// =============================================================================
// APPLICATION-SPECIFIC DATA TYPES
// =============================================================================

/**
 * Stations query data type (what our stations query returns)
 */
export type StationsQueryData = ProcessedStation[];

/**
 * Weather data query result type (what our weather query returns)
 */
export type WeatherDataQueryData = ProcessedTemperatureData;

// =============================================================================
// ERROR CATEGORIZATION (Application-specific)
// =============================================================================

/**
 * Application-specific error categorization for better UX
 * This goes beyond TanStack Query's basic Error type
 */
export interface CategorizedError {
  type: 'network' | 'aborted' | 'validation' | 'unknown';
  message: string;           // User-friendly message in Slovenian
  originalError?: Error;     // Original error for debugging
  context?: string;          // Additional context (e.g., station ID)
}

/**
 * Error categorization function type
 */
export type ErrorCategorizeFn = (error: Error, context?: string) => CategorizedError;

// =============================================================================
// QUERY OPTIONS HELPERS
// =============================================================================

/**
 * Pre-configured query options for stations
 * Uses TanStack Query's queryOptions helper for type safety
 */
export function stationsQueryOptions() {
  return {
    queryKey: queryKeys.stations(),
    staleTime: 1000 * 60 * 30,     // 30 minutes
    gcTime: 1000 * 60 * 60,        // 1 hour (renamed from cacheTime in v5)
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  } as const;
}

/**
 * Pre-configured query options for weather data
 * Implements aggressive SWR (stale-while-revalidate) pattern
 */
export function weatherDataQueryOptions(stationId: number) {
  return {
    queryKey: queryKeys.weatherData(stationId),
    staleTime: 1000 * 60 * 15,     // 15 minutes
    gcTime: 1000 * 60 * 60 * 2,    // 2 hours for offline support
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnStale: true,
    refetchInterval: 1000 * 60 * 15, // 15 minutes background refresh
    refetchIntervalInBackground: true,
    enabled: !!stationId,            // Only run if stationId exists
  } as const;
}

// =============================================================================
// PERSISTENCE TYPES (Application-specific)
// =============================================================================

/**
 * Local storage persistor interface for offline support
 */
export interface LocalStoragePersistor {
  getPersistedQuery: <T>(queryKey: QueryKey) => T | null;
  persistQuery: <T>(queryKey: QueryKey, data: T) => void;  // Keep original method name
  removePersistedQuery: (queryKey: QueryKey) => void;
  clearAllPersistedQueries: () => void;
  cleanupExpiredQueries: () => void;  // Clean up only expired entries
}

/**
 * Persisted query data structure
 */
export interface PersistedQueryData<T = any> {
  data: T;
  timestamp: number;
  queryKey: QueryKey;
  version?: string; // For data migration
}

// =============================================================================
// HOOK RETURN TYPES (Extends TanStack Query types)
// =============================================================================
// PERSISTENCE TYPES (Application-specific)
// =============================================================================

/**
 * Local storage persistor interface for offline support
 */
export interface PopularStation {
  stationId: number;
  priority: number;
  reason?: string; // Why this station is popular
}

/**
 * Prefetching strategy configuration
 */
export interface PrefetchConfig {
  popularStations: PopularStation[];
  maxConcurrentPrefetches: number;
  prefetchTimeout: number;
  enabled: boolean;
}

// =============================================================================
// ADVANCED QUERY PATTERNS
// =============================================================================

/**
 * Batch request configuration for efficiency
 */
export interface BatchRequestConfig {
  maxBatchSize: number;
  batchTimeout: number;
  retryCount: number;
  enabled: boolean;
}

/**
 * Optimistic update configuration
 */
export interface OptimisticUpdateConfig<T> {
  queryKey: QueryKey;
  updateFn: (oldData: T | undefined) => T;
  rollbackFn?: (oldData: T | undefined) => T;
  successMessage?: string;
  errorMessage?: string;
}

// =============================================================================
// DEVTOOLS AND DEBUGGING
// =============================================================================

/**
 * Query debugging information
 */
export interface QueryDebugInfo {
  queryKey: QueryKey;
  status: string;
  fetchStatus: string;
  lastUpdated: number;
  dataUpdateCount: number;
  errorUpdateCount: number;
}

/**
 * Application query client configuration
 * Extends TanStack Query's defaults with app-specific settings
 */
export interface AppQueryClientConfig {
  enableDevtools: boolean;
  enablePersistence: boolean;
  enablePrefetching: boolean;
  enableBatching: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}
