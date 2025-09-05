import { useQuery, useMutation, QueryClient } from "@tanstack/solid-query";
import { WeatherStation } from "../../types/weather";
import { apiClient } from "./api-integration";

// 1. Query key factory for consistent caching
export const queryKeys = {
  // Weather stations
  weatherStations: ["weather-stations"] as const,
  weatherStationsAll: () => [...queryKeys.weatherStations, "all"] as const,
  weatherStationsActive: () => [...queryKeys.weatherStations, "active"] as const,
  
  // Temperature data
  temperatureData: (stationId: string) => ["temperature-data", stationId] as const,
  temperatureDataRange: (stationId: string, startDate: string, endDate: string) =>
    [...queryKeys.temperatureData(stationId), "range", startDate, endDate] as const,
    
  // Analysis data
  analysis: ["analysis"] as const,
  stationAnalysis: (stationId: string) => [...queryKeys.analysis, "station", stationId] as const
};

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
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,    // 1 hour (was cacheTime)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    throwOnError: false,
    enabled: true
  }));
}

// 3. Custom hook for temperature data with parameters
export function useTemperatureData(stationId: string, enabled = true) {
  return useQuery(() => ({
    queryKey: queryKeys.temperatureData(stationId),
    queryFn: async () => {
      const result = await apiClient.fetchData(`temperature_data.json?station_id=${stationId}&_size=100`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: enabled && Boolean(stationId),
    staleTime: 15 * 60 * 1000, // 15 minutes for temperature data
    gcTime: 30 * 60 * 1000,    // 30 minutes
    retry: 2,
    refetchOnWindowFocus: true
  }));
}

// 4. Custom hook with date range filtering
export function useTemperatureDataRange(
  stationId: string,
  startDate: string,
  endDate: string,
  enabled = true
) {
  return useQuery(() => ({
    queryKey: queryKeys.temperatureDataRange(stationId, startDate, endDate),
    queryFn: async () => {
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
    enabled: enabled && Boolean(stationId) && Boolean(startDate) && Boolean(endDate),
    staleTime: 60 * 60 * 1000, // 1 hour for historical data
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1
  }));
}

// 5. Mutation for data updates/actions
export function useUpdateStationPreference() {
  return useMutation(() => ({
    mutationFn: async (stationId: string): Promise<void> => {
      // Save to localStorage or send to API
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("preferred-station", stationId);
      }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: (data: void, variables: string) => {
      console.log(`Updated preferred station to: ${variables}`);
    },
    onError: (error: Error) => {
      console.error("Failed to update station preference:", error);
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

// 8. Error handling utilities
export function isNetworkError(error: unknown): error is Error & { cause?: string } {
  return error instanceof Error && (
    error.message.includes("Network") ||
    error.message.includes("fetch") ||
    error.message.includes("Failed to fetch")
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Neznan error je nastopil";
}

// 9. Query status utilities
export function isQueryStale<T>(query: any): boolean {
  return query.isStale;
}

export function getQueryAge<T>(query: any): number | null {
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
