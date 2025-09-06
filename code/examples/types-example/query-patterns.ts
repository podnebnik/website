import { useQuery, useMutation, QueryClient } from "@tanstack/solid-query";
import { WeatherStation } from "./types";
import { apiClient } from "./api-integration";

/**
 * TypeScript Example: Query Keys Factory Pattern
 * 
 * This demonstrates how to create type-safe, hierarchical query keys
 * for TanStack Query using TypeScript's 'as const' assertions and
 * readonly tuple types for optimal type inference and autocompletion.
 */

// 1. Query key factory for consistent caching
export const queryKeys = {
  // Weather stations - using 'as const' for literal type inference
  weatherStations: ["weather-stations"] as const,
  weatherStationsAll: () => [...queryKeys.weatherStations, "all"] as const,
  weatherStationsActive: () => [...queryKeys.weatherStations, "active"] as const,
  
  // Temperature data with parameters - demonstrates function composition
  temperatureData: (stationId: string) => ["temperature-data", stationId] as const,
  temperatureDataRange: (stationId: string, startDate: string, endDate: string) =>
    [...queryKeys.temperatureData(stationId), "range", startDate, endDate] as const,
    
  // Analysis data - nested key hierarchies
  analysis: ["analysis"] as const,
  stationAnalysis: (stationId: string) => [...queryKeys.analysis, "station", stationId] as const
} as const;

// TypeScript Example: Extract query key types for type safety
// type WeatherStationsQueryKey = ReturnType<QueryKeys['weatherStationsAll']>;
// type TemperatureDataQueryKey = ReturnType<QueryKeys['temperatureData']>;

/**
 * TypeScript Example: Custom Hook with Comprehensive Type Safety
 * 
 * Demonstrates:
 * - Explicit return type annotations
 * - Generic type constraints
 * - Error boundary patterns
 * - Conditional query enabling
 */

// 2. Custom hook for weather stations with TanStack Query
export function useWeatherStations() {
  return useQuery(() => ({
    queryKey: queryKeys.weatherStationsAll(),
    queryFn: async (): Promise<WeatherStation[]> => {
      const result = await apiClient.fetchWeatherStations();
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - stations rarely change
    gcTime: 60 * 60 * 1000,    // 1 hour (was cacheTime in v4)
    retry: 3,
    retryDelay: (attemptIndex: number): number => Math.min(1000 * 2 ** attemptIndex, 30000),
    throwOnError: false, // Handle errors in UI components
    enabled: true
  }));
}

/**
 * TypeScript Example: Custom Hook with Parameters and Conditional Enabling
 * 
 * Demonstrates:
 * - Function overloading with default parameters
 * - Boolean type coercion with type guards
 * - Complex conditional logic with multiple boolean checks
 * - TanStack Query configuration with TypeScript generics
 */
// 3. Custom hook for temperature data with parameters
export function useTemperatureData(stationId: string, enabled: boolean = true) {
  return useQuery(() => ({
    queryKey: queryKeys.temperatureData(stationId),
    queryFn: async () => {
      const result = await apiClient.fetchData(`temperature_data.json?station_id=${stationId}&_size=100`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    // TypeScript: Boolean logic with type coercion - Boolean() ensures proper type
    enabled: enabled && Boolean(stationId),
    staleTime: 15 * 60 * 1000, // 15 minutes for temperature data
    gcTime: 30 * 60 * 1000,    // 30 minutes
    retry: 2,
    refetchOnWindowFocus: true
  }));
}

/**
 * TypeScript Example: Date Range Query with URL Parameters
 * 
 * Demonstrates:
 * - Multiple parameter validation with Boolean guards
 * - URLSearchParams API with type-safe parameter building
 * - Complex enabled condition with multiple boolean checks
 * - Different caching strategies based on data volatility
 */
// 4. Custom hook with date range filtering
export function useTemperatureDataRange(
  stationId: string,
  startDate: string,
  endDate: string,
  enabled: boolean = true // TypeScript: Explicit boolean type for parameter
) {
  return useQuery(() => ({
    queryKey: queryKeys.temperatureDataRange(stationId, startDate, endDate),
    queryFn: async () => {
      // TypeScript: URLSearchParams provides type-safe query string building
      const params = new URLSearchParams({
        station_id: stationId,
        start_date: startDate,
        end_date: endDate,
        _size: "1000"
      });
      
      const result = await apiClient.fetchData(`temperature_data.json?${params}`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      
      return result.data;
    },
    // TypeScript: Multiple boolean conditions with proper type coercion
    enabled: enabled && Boolean(stationId) && Boolean(startDate) && Boolean(endDate),
    staleTime: 60 * 60 * 1000, // 1 hour for historical data (less volatile)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - longer cache for historical data
    retry: 1 // Less retries for historical data
  }));
}

/**
 * TypeScript Example: TanStack Query Mutation Pattern
 * 
 * Demonstrates:
 * - Async function typing with Promise<void> return type
 * - Browser API type checking with 'typeof' guards
 * - Conditional execution based on environment detection
 * - Side effect patterns in mutation functions
 */
// 5. Mutation for data updates/actions
export function useUpdateStationPreference() {
  return useMutation(() => ({
    mutationFn: async (stationId: string): Promise<void> => {
      // TypeScript: Runtime type checking for browser APIs
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("preferred-station", stationId);
      }
      
      // Could also send to API endpoint here
      // await apiClient.updatePreference(stationId);
    },
    // TypeScript: Callback parameter typing with explicit types
    onSuccess: (_data: void, stationId: string) => {
      console.log(`Station preference updated to: ${stationId}`);
    },
    onError: (error: Error) => {
      console.error("Failed to update station preference:", error.message);
    }
  }));
}

// 6. Prefetching utility function
export function prefetchTemperatureData(
  queryClient: QueryClient,
  stationId: string
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.temperatureData(stationId),
    queryFn: async () => {
      const result = await apiClient.fetchData(`temperature_data.json?station_id=${stationId}&_size=50`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 15 * 60 * 1000
  });
}

// 7. Query invalidation helpers
export const queryInvalidation = {
  // Invalidate all weather station queries
  invalidateWeatherStations: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.weatherStations
    });
  },
  
  // Invalidate specific station's temperature data
  invalidateStationData: (queryClient: QueryClient, stationId: string) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.temperatureData(stationId)
    });
  },
  
  // Remove specific query from cache
  removeStationData: (queryClient: QueryClient, stationId: string) => {
    queryClient.removeQueries({
      queryKey: queryKeys.temperatureData(stationId)
    });
  }
};

// 8. Error handling utilities with TypeScript type guards and branded types
export function isNetworkError(error: unknown): error is Error & { cause?: string } {
  return error instanceof Error && (
    error.message.includes("Network") ||
    error.message.includes("fetch") ||
    error.message.includes("Failed to fetch")
  );
}

/**
 * TypeScript Example: Exhaustive Error Message Handling
 * 
 * Demonstrates type narrowing with unknown type and fallback patterns
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Neznan error je nastopil";
}

// TypeScript Example: Utility types for API response patterns
// type QueryStatus = "idle" | "pending" | "success" | "error";
type QueryMeta = {
  isStale: boolean;
  dataUpdatedAt?: number;
};

// 9. Query status utilities with precise interface contracts
export function isQueryStale(query: QueryMeta): boolean {
  return query.isStale;
}

export function getQueryAge(query: Pick<QueryMeta, 'dataUpdatedAt'>): number | null {
  if (query.dataUpdatedAt) {
    return Date.now() - query.dataUpdatedAt;
  }
  return null;
}

// 10. Background refetch configuration
export const backgroundRefetchConfig = {
  // Active data that changes frequently
  liveData: {
    refetchInterval: 5 * 60 * 1000,      // 5 minutes
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  },
  
  // Static/semi-static data
  staticData: {
    refetchInterval: 60 * 60 * 1000,     // 1 hour
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  },
  
  // Historical data
  historicalData: {
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  }
};
