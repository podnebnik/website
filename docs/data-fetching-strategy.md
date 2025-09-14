---
title: "Data Fetching and Caching Strategy Guide"
created: "2025-07-07"
updated: "2025-09-14"
author: "Jaka Daneu"
contributors: ["Copilot - Claude Sonnet 4"]
status: "Active"
audience: "Developers"
purpose: "Technical documentation of our TanStack Query v5 data fetching architecture"
tags: ["tanstack-query", "typescript", "solidjs", "caching", "architecture"]
---

# Data Fetching and Caching Strategy Guide

## Table of Contents

1. [Overview](#overview)
2. [Current Implementation Status](#current-implementation-status)
3. [Core Components](#core-components)
4. [Query Keys Structure](#query-keys-structure)
5. [Caching Configuration](#caching-configuration)
6. [Persistence Layer](#persistence-layer)
7. [Prefetching Strategy](#prefetching-strategy)
8. [Error Handling](#error-handling)
9. [Performance Optimizations](#performance-optimizations)
10. [TanStack Query v5 Migration](#tanstack-query-v5-migration)
11. [Future Improvements](#future-improvements)

## Overview

This document outlines our approach to data fetching, caching, and state management in the Podnebnik weather application. We use **TanStack Query v5** with **SolidJS** and **TypeScript** to implement a robust data layer with offline support, aggressive prefetching, and optimized user experience.

Our strategy focuses on:

- **User-perceived performance**: Making the application feel fast through prefetching and cache
- **Offline resilience**: Maintaining functionality even with unstable connections
- **Resource efficiency**: Minimizing unnecessary network requests
- **Data freshness**: Balancing cache usage with up-to-date data
- **Type safety**: Full TypeScript integration with runtime validation for API responses
- **Modern patterns**: Leveraging TanStack Query v5's latest features and best practices

## Current Implementation Status

✅ **Fully Implemented:**

- TypeScript integration with comprehensive type system
- TanStack Query v5 with SolidJS adapter
- Query client configuration with specialized defaults
- Persistence layer with localStorage
- Prefetching strategies for stations and weather data
- Error handling with categorization
- Historical data queries for seasonal analysis

✅ **Recently Updated:**

- Migration from `.jsx` to `.tsx` file extensions
- Updated to TanStack Query v5 API (`cacheTime` → `gcTime`, `keepPreviousData` → `placeholderData`)
- Enhanced type safety with runtime validation

## Core Components

### 1. TypeScript Integration

Our data fetching layer is fully typed with TypeScript, providing compile-time safety and excellent developer experience:

```typescript
// Type-safe API responses based on actual API analysis
import {
  VremenarStationDetailsResponse,
  ProcessedStation,
  ProcessedTemperatureData,
  HistoricalTemperatureData,
} from "/code/types/index.js";

// Runtime validation with type guards
import { validateStationsResponse } from "/code/types/guards.js";

const fetchStations = async (): Promise<ProcessedStation[]> => {
  const response = await fetch("/api/stations");
  const data = await response.json();

  // Validate at runtime
  const validation = validateStationsResponse(data);
  if (!validation.success) {
    throw new Error(`Invalid API response: ${validation.error}`);
  }

  return processStations(validation.data);
};
```

### 2. Query Client (TanStack Query v5)

The core of our data fetching strategy is a singleton `QueryClient` instance exported from `QueryProvider.tsx`. This ensures consistent cache across the application and prevents cache fragmentation.

```tsx
// QueryProvider.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
```

### 3. Query Hooks with TypeScript

Custom hooks encapsulate specific data fetching logic while providing a consistent interface with full TypeScript support:

```tsx
// hooks/queries.ts (TypeScript)
import { useQuery, UseQueryResult } from "@tanstack/solid-query";
import type {
  ProcessedTemperatureData,
  ProcessedStation,
} from "../../types/models.js";

export function useWeatherQuery(
  stationId: string
): UseQueryResult<ProcessedTemperatureData, CategorizedError> {
  const persistor = createLocalStoragePersistor();

  return useQuery(() => {
    const cachedData = persistor.getPersistedQuery(
      queryKeys.weatherData(stationId)
    );

    return {
      queryKey: queryKeys.weatherData(stationId),
      queryFn: async ({ signal }) => {
        // Implementation with network request and fallback to persistence
        return requestData(stationId, signal);
      },
      placeholderData: cachedData, // v5: replaces keepPreviousData
    };
  });
}
```

````

### 4. Prefetching Utilities

Utilities for proactively loading data before it's needed:

```tsx
// utils/prefetching.ts (TypeScript)
export function prefetchStationData(queryClient: QueryClient, stationId: string): Promise<ProcessedTemperatureData | undefined> {
  // Check cache before fetching
  const existingQuery = queryClient.getQueryState(queryKeys.weatherData(stationId));
  if (existingQuery && !existingQuery.isStale) return Promise.resolve(existingQuery.data);

  return queryClient.prefetchQuery({
    queryKey: queryKeys.weatherData(stationId),
    queryFn: () => requestData(stationId).then(result => processTemperatureData(result)),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
````

### 5. Persistence Layer

A custom persistence layer that saves and retrieves data from localStorage:

```tsx
// utils/persistence.ts (TypeScript)
export function createLocalStoragePersistor() {
  return {
    persistQuery: <T,>(queryKey: QueryKey, data: T): void => {
      // Save to localStorage with timestamp
    },
    getPersistedQuery: <T,>(queryKey: QueryKey): T | undefined => {
      // Retrieve and validate freshness
    },
    cleanupExpiredQueries: (): void => {
      // Remove expired entries
    },
  };
}
```

## Query Keys Structure

We use a factory pattern to create consistent, type-safe query keys:

```typescript
// types/queries.ts
export const queryKeys = {
  // Station-related queries
  stations: () => ["stations"] as const,

  // Weather data queries
  weatherData: (stationId: number) => ["weatherData", stationId] as const,

  // Historical data queries (newly implemented)
  historicalData: (stationId: number, centerMmdd: string, windowDays: number) =>
    ["historicalData", stationId, centerMmdd, windowDays] as const,
} as const;

/**
 * All possible query keys in the application (derived from factory)
 */
export type AppQueryKey = ReturnType<
  (typeof queryKeys)[keyof typeof queryKeys]
>;
```

This structure enables:

- Precise cache invalidation
- **Full TypeScript type safety** with `as const` assertions
- Consistent references across components
- Clear debugging in Query DevTools
- **Compile-time validation** of query key structure
- Support for new query types like historical data

## Caching Configuration

We use different caching configurations for different types of data:

### Weather Data

```typescript
queryClient.setQueryDefaults(["weatherData"], {
  staleTime: 1000 * 60 * 15, // 15 minutes - consider data fresh
  gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache (v5: renamed from cacheTime)
  refetchInterval: 1000 * 60 * 15, // Background refresh every 15 minutes
  refetchIntervalInBackground: true, // Even when tab not focused
  placeholderData: (previousData) => previousData, // v5: replaces keepPreviousData
});
```

### Station List

```typescript
queryClient.setQueryDefaults(["stations"], {
  staleTime: 1000 * 60 * 30, // 30 minutes - stations change rarely
  gcTime: 1000 * 60 * 60, // 1 hour (v5: renamed from cacheTime)
  retry: 2,
});
```

### Historical Data (New)

```typescript
queryClient.setQueryDefaults(["historicalData"], {
  staleTime: 1000 * 60 * 15, // 15 minutes - historical data rarely changes
  retry: 2,
  gcTime: 1000 * 60 * 60 * 4, // 4 hours - keep cached data longer since historical data is stable
  refetchOnMount: false, // Historical data is stable, no need to refetch on mount
  refetchOnWindowFocus: false, // Historical data is stable, no need to refetch on focus
  refetchOnReconnect: true, // Still refetch on reconnect for reliability
});
```

## Persistence Layer

Our persistence strategy involves:

1. **Selective Persistence**: Only specific query types are persisted
2. **Event-based Storage**: Cache is updated on query updates
3. **Timestamp-based Expiration**: Cached data has TTL
4. **Restoration on Load**: App hydrates from cache on startup

Key persistence code:

```typescript
// Set up event listeners to save queries to localStorage
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.query?.state?.data) {
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
```

## Prefetching Strategy

We implement multi-layered prefetching:

### 1. Initial Load Prefetching

- Stations list loaded immediately
- Popular weather stations prefetched with slight delay
- Historical data for popular stations prefetched for TODAY labels

```typescript
// In QueryProvider.tsx
onMount(() => {
  prefetchStationsData(queryClient);

  setTimeout(() => {
    prefetchPopularStations(queryClient);
  }, 2000);

  // Prefetch historical data for popular stations to ensure TODAY labels work consistently
  setTimeout(() => {
    prefetchPopularStationsHistoricalData(queryClient);
  }, 4000); // 4 second delay - after weather data is prefetched
});
```

### 2. Interaction-based Prefetching

- Dropdown open triggers prefetch of first 5 visible stations
- Item hover/focus triggers prefetch of specific station data
- Debounced to prevent request flooding

```typescript
// In StationSelector.tsx
onOpenChange={(isOpen: boolean) => {
  if (isOpen) {
    const visibleStations = props.stations.slice(0, 5).map(station => station.station_id);
    visibleStations.forEach(stationId => {
      setTimeout(() => debouncedPrefetch(stationId), 50 * Math.random());
    });
  }
}}

// For each item
onMouseEnter={() => debouncedPrefetch(stationId)}
onFocus={() => debouncedPrefetch(stationId)}
```

## Error Handling

Our error handling strategy includes:

1. **Error Categorization**: Network vs. unknown errors
2. **Graceful Degradation**: Fallback to cached data when possible
3. **Retry Mechanism**: Configurable retry counts
4. **User Feedback**: Error messages with appropriate context in Slovenian

```typescript
// hooks/queries.ts
function categorizeError(
  error: unknown,
  context: string = ""
): CategorizedError {
  // Type guard to ensure we have an Error object
  const errorObj = error instanceof Error ? error : new Error(String(error));

  if (!navigator.onLine) {
    return {
      type: "network",
      message: "Ni povezave z internetom",
      originalError: errorObj,
      context,
    };
  }

  if (
    errorObj.message?.includes("Failed to fetch") ||
    errorObj instanceof TypeError
  ) {
    return {
      type: "network",
      message: "Napaka pri povezavi s strežnikom",
      originalError: errorObj,
      context,
    };
  }

  return {
    type: "unknown",
    message: `Napaka: ${errorObj.message || "Neznana napaka"}`,
    originalError: errorObj,
    context,
  };
}
```

## Performance Optimizations

Key performance optimization techniques:

1. **Debouncing**: Prevents excessive API calls during rapid user interactions

   ```typescript
   const debouncedPrefetch = debounce((stationId: string) => {
     prefetchStationData(queryClient, stationId);
   }, 200);
   ```

2. **Cache Checking**: Avoids redundant requests

   ```typescript
   const existingQuery = queryClient.getQueryState(
     queryKeys.weatherData(stationId)
   );
   if (existingQuery && !existingQuery.isStale)
     return Promise.resolve(existingQuery.data);
   ```

3. **Request Staggering**: Prevents request flooding

   ```typescript
   setTimeout(() => debouncedPrefetch(stationId), 50 * Math.random());
   ```

4. **Placeholder Data**: Shows cached data immediately while refreshing
   ```typescript
   placeholderData: (previousData) => previousData, // v5: replaces keepPreviousData
   ```

## TanStack Query v5 Migration

We have successfully migrated to TanStack Query v5. Key changes implemented:

### API Changes

- ✅ `cacheTime` → `gcTime`
- ✅ `keepPreviousData` → `placeholderData: (previousData) => previousData`
- ✅ Single object syntax for all hooks
- ✅ TypeScript improvements with better error types
- ✅ Window focus refetching now uses `visibilitychange` event exclusively

### New Features Utilized

- **Enhanced TypeScript Support**: Full type safety with `Error` as default error type
- **Improved Performance**: Better memory management and garbage collection
- **Modern Browser Support**: Leveraging latest browser APIs for better performance

## Future Improvements

### 1. Implement Service Worker for Offline Support

While our localStorage persistence provides basic offline capabilities, a service worker would offer more robust offline support:

```javascript
// Example implementation with Workbox
workbox.routing.registerRoute(
  /\/api\/weather/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "weather-data",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);
```

### 2. Implement Cache Prioritization

Not all data is equally important. We could implement priority levels for cache items:

```typescript
// Example prioritization implementation
function persistQuery(
  queryKey: QueryKey,
  data: unknown,
  priority: "low" | "normal" | "high" = "normal"
) {
  // Check available storage
  const storageEstimate = await navigator.storage.estimate();
  const availableSpace = storageEstimate.quota - storageEstimate.usage;

  // If storage is limited, only keep high priority items
  if (availableSpace < LOW_STORAGE_THRESHOLD) {
    if (priority !== "high") return;
  }

  // Store with priority metadata
  localStorage.setItem(
    key,
    JSON.stringify({
      data,
      timestamp: Date.now(),
      priority,
    })
  );
}
```

### 3. Implement Background Synchronization

Use the Background Sync API to update data when connectivity is restored:

```typescript
// Register sync event
navigator.serviceWorker.ready.then((registration) => {
  registration.sync.register("sync-weather-data");
});

// In service worker
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-weather-data") {
    event.waitUntil(syncWeatherData());
  }
});
```

### 4. Leverage TanStack Query v5 New Features

Consider implementing these v5 features:

- **Infinite Queries with maxPages**: For paginated historical data
- **Suspense Hooks**: Use `useSuspenseQuery` for components that always need data
- **Enhanced Optimistic Updates**: Simplified optimistic UI patterns

```typescript
// Example: Suspense query for critical data
const { data: stations } = useSuspenseQuery({
  queryKey: queryKeys.stations(),
  queryFn: loadStations,
});
// data is never undefined with suspense queries
```

### 5. Implement Data Streaming for Real-time Updates

For more real-time weather updates, consider using WebSockets or Server-Sent Events:

```typescript
// Example of integrating SSE with TanStack Query
function useRealtimeWeatherQuery(stationId: string) {
  const queryClient = useQueryClient();

  onMount(() => {
    const eventSource = new EventSource(`/api/weather-stream/${stationId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      queryClient.setQueryData(queryKeys.weatherData(stationId), data);
    };

    onCleanup(() => eventSource.close());
  });

  return useWeatherQuery(stationId);
}
```

### 6. Implement Analytics for Cache Effectiveness

Track and analyze how effectively the cache is serving users:

```typescript
function trackCacheEffectiveness() {
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "updated") {
      const fromCache =
        event.action.type === "success" &&
        event.action.dataUpdatedAt === event.query.state.dataUpdatedAt;

      analytics.track("query_result", {
        queryKey: JSON.stringify(event.query.queryKey),
        fromCache: fromCache,
        loadTime:
          event.query.state.dataUpdatedAt -
          event.query.state.fetchMeta.fetchStart,
      });
    }
  });
}
```

---

This guide reflects our current TanStack Query v5 implementation with TypeScript and outlines potential improvements. As our application evolves, we'll continue to refine these strategies to provide the best possible user experience.
