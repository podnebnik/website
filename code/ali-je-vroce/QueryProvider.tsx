import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/solid-query";
import { SolidQueryDevtools } from "@tanstack/solid-query-devtools";
import { Show, onMount, Component, JSX } from "solid-js";
import {
  prefetchPopularStations,
  prefetchStationsData,
  prefetchPopularStationsHistoricalData,
} from "./utils/prefetching.js";
import { createLocalStoragePersistor } from "./utils/persistence";
import { QueryProviderProps } from "../types/components";

// Create a client with specialized defaults for different query types
// Export the queryClient so it can be imported directly by other modules
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global defaults
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// Configure specific query defaults for stations
queryClient.setQueryDefaults(["stations"], {
  staleTime: 1000 * 60 * 30, // 30 minutes - stations don't change often
  retry: 2,
  gcTime: 1000 * 60 * 60, // 1 hour (renamed from cacheTime in TanStack Query v5)
});

// Configure specific query defaults for weather data with more aggressive SWR pattern
queryClient.setQueryDefaults(["weatherData"], {
  // Significantly increase staleTime to reduce immediate refetches
  staleTime: 1000 * 60 * 15, // 15 minutes - consider data fresh for longer

  retry: 2,

  // Always return cached data first (stale-while-revalidate pattern)
  refetchOnWindowFocus: true, // Changed from "always" to use the cached data first
  refetchOnMount: true, // Changed from "always" to use the cached data first
  refetchOnReconnect: true, // Changed from "always" to use the cached data first

  // Keep background refreshes for up-to-date data
  refetchInterval: 1000 * 60 * 15, // 15 minutes - less aggressive refreshing
  refetchIntervalInBackground: true, // Continue refreshing even when tab is not focused

  // Dramatically increase cache time for better offline support
  gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep data in cache much longer (renamed from cacheTime)

  // This is key for SWR pattern - always keep previous data visible while fetching
  placeholderData: (previousData) => previousData, // Updated from keepPreviousData in v5
});

// Configure specific query defaults for historical data
// Note: Historical data rarely changes since it represents past weather measurements.
// Future optimization opportunity: Consider increasing staleTime to several hours or even days
// for truly historical data (e.g., data older than current year).
queryClient.setQueryDefaults(["historicalData"], {
  staleTime: 1000 * 60 * 15, // 15 minutes - historical data rarely changes
  retry: 2,
  gcTime: 1000 * 60 * 60 * 4, // 4 hours - keep cached data longer since historical data is stable
  refetchOnMount: false, // Historical data is stable, no need to refetch on mount
  refetchOnWindowFocus: false, // Historical data is stable, no need to refetch on focus
  refetchOnReconnect: true, // Still refetch on reconnect for reliability
});

/**
 * QueryProvider component that wraps children with TanStack Query's QueryClientProvider
 * Also handles initial data prefetching for better user experience
 */
// Create a persistor instance outside the component to ensure it's created only once
const persistor = createLocalStoragePersistor();

export const QueryProvider: Component<QueryProviderProps> = (props) => {
  // Check if we're in development mode
  const isDev = (): boolean => {
    try {
      // Use a safer way to check for development mode
      return (
        typeof window !== "undefined" &&
        window.location &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.port === "8080")
      );
    } catch {
      return false;
    }
  };

  // When the component mounts, set up persistence and start prefetching data
  onMount(() => {
    // Clean up expired cache entries
    persistor.cleanupExpiredQueries();

    // Set up event listeners to save queries to localStorage
    const queryCache: QueryCache = queryClient.getQueryCache();
    queryCache.subscribe((event) => {
      // In TanStack Query v5, we should respond to the 'updated' event
      // which is fired when a query's data is updated with fresh data
      if (event.type === "updated" && event.query?.state?.data) {
        // Only persist certain queries
        const queryKey = event.query.queryKey;

        // Don't persist empty data
        if (!event.query.state.data) return;

        // Determine if query should be persisted
        if (queryKey[0] === "stations") {
          // Always persist stations list
          persistor.persistQuery(queryKey, event.query.state.data);
        } else if (queryKey[0] === "weatherData") {
          // Persist weather data for all stations
          persistor.persistQuery(queryKey, event.query.state.data);
        }
      }
    });

    // Add hydration logic to restore queries from persistence
    setTimeout(() => {
      try {
        // Restore stations data
        const stationsData = persistor.getPersistedQuery(["stations"]);
        if (stationsData) {
          queryClient.setQueryData(["stations"], stationsData);
        }

        // For weather data, we'd need to know the specific station IDs
        // This could be expanded to handle more complex scenarios
      } catch (err) {
        console.warn("Error hydrating query client from persistence:", err);
      }
    }, 0);

    // Prefetch stations list data immediately
    prefetchStationsData(queryClient);

    // Prefetch popular stations data with a small delay to prioritize visible UI
    setTimeout(() => {
      prefetchPopularStations(queryClient);
    }, 2000); // 2 second delay

    // Prefetch historical data for popular stations to ensure TODAY labels work consistently
    setTimeout(() => {
      prefetchPopularStationsHistoricalData(queryClient);
    }, 4000); // 4 second delay - after weather data is prefetched
  });

  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
      <Show when={props.enableDevtools !== false && isDev()}>
        <SolidQueryDevtools initialIsOpen={false} />
      </Show>
    </QueryClientProvider>
  ) as JSX.Element;
};
