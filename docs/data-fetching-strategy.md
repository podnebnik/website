# Data Fetching and Caching Strategy Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Query Keys Structure](#query-keys-structure)
4. [Caching Configuration](#caching-configuration)
5. [Persistence Layer](#persistence-layer)
6. [Prefetching Strategy](#prefetching-strategy)
7. [Error Handling](#error-handling)
8. [Performance Optimizations](#performance-optimizations)
9. [Improvement Suggestions](#improvement-suggestions)

## Overview

This document outlines our approach to data fetching, caching, and state management in the Podnebnik weather application. We use TanStack Query (formerly React Query) with SolidJS to implement a robust data layer with offline support, aggressive prefetching, and optimized user experience.

Our strategy focuses on:

- **User-perceived performance**: Making the application feel fast through prefetching and cache
- **Offline resilience**: Maintaining functionality even with unstable connections
- **Resource efficiency**: Minimizing unnecessary network requests
- **Data freshness**: Balancing cache usage with up-to-date data

## Core Components

### 1. Query Client

The core of our data fetching strategy is a singleton `QueryClient` instance exported from `QueryProvider.jsx`. This ensures consistent cache across the application and prevents cache fragmentation.

```jsx
// QueryProvider.jsx
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

### 2. Query Hooks

Custom hooks encapsulate specific data fetching logic while providing a consistent interface:

```jsx
// queries.js
export function useWeatherQuery(stationId) {
  const persistor = createLocalStoragePersistor();
  
  return useQuery(() => {
    const cachedData = persistor.getPersistedQuery(queryKeys.weatherData(stationId));
    
    return {
      queryKey: queryKeys.weatherData(stationId),
      queryFn: async ({ signal }) => {
        // Implementation with network request and fallback to persistence
      },
      placeholderData: cachedData,
      keepPreviousData: true,
    };
  });
}
```

### 3. Prefetching Utilities

Utilities for proactively loading data before it's needed:

```jsx
// prefetching.js
export function prefetchStationData(queryClient, stationId) {
  // Check cache before fetching
  const existingQuery = queryClient.getQueryState(queryKeys.weatherData(stationId));
  if (existingQuery && !existingQuery.isStale) return Promise.resolve(existingQuery.data);
  
  return queryClient.prefetchQuery({
    queryKey: queryKeys.weatherData(stationId),
    queryFn: () => requestData(stationId).then(result => {...}),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### 4. Persistence Layer

A custom persistence layer that saves and retrieves data from localStorage:

```jsx
// persistence.js
export function createLocalStoragePersistor() {
  return {
    persistQuery: (queryKey, data) => {
      // Save to localStorage with timestamp
    },
    getPersistedQuery: (queryKey) => {
      // Retrieve and validate freshness
    },
    cleanupCache: () => {
      // Remove expired entries
    }
  };
}
```

## Query Keys Structure

We use a factory pattern to create consistent query keys:

```javascript
export const queryKeys = {
  stations: () => ['stations'],
  weatherData: (stationId) => ['weatherData', stationId],
};
```

This structure enables:
- Precise cache invalidation
- Type safety
- Consistent references across components
- Clear debugging in Query DevTools

## Caching Configuration

We use different caching configurations for different types of data:

### Weather Data
```javascript
queryClient.setQueryDefaults(['weatherData'], {
  staleTime: 1000 * 60 * 15,        // 15 minutes - consider data fresh
  cacheTime: 1000 * 60 * 60 * 24,   // 24 hours - keep in cache
  refetchInterval: 1000 * 60 * 15,  // Background refresh every 15 minutes
  refetchIntervalInBackground: true, // Even when tab not focused
  keepPreviousData: true,           // Key for SWR pattern
});
```

### Station List
```javascript
queryClient.setQueryDefaults(['stations'], {
  staleTime: 1000 * 60 * 30,  // 30 minutes - stations change rarely
  cacheTime: 1000 * 60 * 60,  // 1 hour
  retry: 2,
});
```

## Persistence Layer

Our persistence strategy involves:

1. **Selective Persistence**: Only specific query types are persisted
2. **Event-based Storage**: Cache is updated on query updates
3. **Timestamp-based Expiration**: Cached data has TTL
4. **Restoration on Load**: App hydrates from cache on startup

Key persistence code:
```javascript
// Set up event listeners to save queries to localStorage
queryClient.getQueryCache().subscribe(event => {
  if (event.type === 'updated' && event.query?.state?.data) {
    const queryKey = event.query.queryKey;
    
    if (queryKey[0] === 'stations' || queryKey[0] === 'weatherData') {
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

```javascript
// In QueryProvider.jsx
onMount(() => {
  prefetchStationsData(queryClient);
  
  setTimeout(() => {
    prefetchPopularStations(queryClient);
  }, 2000);
});
```

### 2. Interaction-based Prefetching
- Dropdown open triggers prefetch of first 5 visible stations
- Item hover/focus triggers prefetch of specific station data
- Debounced to prevent request flooding

```javascript
// In StationSelector.jsx
onOpenChange={(isOpen) => {
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
4. **User Feedback**: Error messages with appropriate context

```javascript
function categorizeError(error, context = '') {
  if (!navigator.onLine) {
    return { type: 'network', message: 'Ni povezave z internetom', originalError: error };
  }
  
  if (error.message?.includes('Failed to fetch') || error instanceof TypeError) {
    return { type: 'network', message: 'Napaka pri povezavi s strežnikom', originalError: error };
  }
  
  return {
    type: 'unknown',
    message: `Napaka: ${error.message || 'Neznana napaka'}`,
    originalError: error
  };
}
```

## Performance Optimizations

Key performance optimization techniques:

1. **Debouncing**: Prevents excessive API calls during rapid user interactions
   ```javascript
   const debouncedPrefetch = debounce((stationId) => {
     prefetchStationData(queryClient, stationId);
   }, 200);
   ```

2. **Cache Checking**: Avoids redundant requests
   ```javascript
   const existingQuery = queryClient.getQueryState(queryKeys.weatherData(stationId));
   if (existingQuery && !existingQuery.isStale) return Promise.resolve(existingQuery.data);
   ```

3. **Request Staggering**: Prevents request flooding
   ```javascript
   setTimeout(() => debouncedPrefetch(stationId), 50 * Math.random());
   ```

4. **Placeholder Data**: Shows cached data immediately while refreshing
   ```javascript
   placeholderData: cachedData,
   keepPreviousData: true,
   ```

## Improvement Suggestions

### 1. Implement Service Worker for Offline Support

While our localStorage persistence provides basic offline capabilities, a service worker would offer more robust offline support:

```javascript
// Example implementation with Workbox
workbox.routing.registerRoute(
  /\/api\/weather/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'weather-data',
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

```javascript
// Example prioritization implementation
function persistQuery(queryKey, data, priority = 'normal') {
  // Check available storage
  const storageEstimate = await navigator.storage.estimate();
  const availableSpace = storageEstimate.quota - storageEstimate.usage;
  
  // If storage is limited, only keep high priority items
  if (availableSpace < LOW_STORAGE_THRESHOLD) {
    if (priority !== 'high') return;
  }
  
  // Store with priority metadata
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now(),
    priority
  }));
}
```

### 3. Implement Background Synchronization

Use the Background Sync API to update data when connectivity is restored:

```javascript
// Register sync event
navigator.serviceWorker.ready.then(registration => {
  registration.sync.register('sync-weather-data');
});

// In service worker
self.addEventListener('sync', event => {
  if (event.tag === 'sync-weather-data') {
    event.waitUntil(syncWeatherData());
  }
});
```

### 4. Implement Query Invalidation Strategies

Currently, our app relies primarily on staleTime for refetching. We could implement more sophisticated invalidation:

```javascript
// Example: Invalidate weather data after user action
function updateUserPreferences(preferences) {
  // Update preferences
  const result = await saveUserPreferences(preferences);
  
  // Invalidate affected queries
  if (preferences.temperatureUnit !== previousUnit) {
    queryClient.invalidateQueries({
      predicate: query => query.queryKey[0] === 'weatherData',
    });
  }
  
  return result;
}
```

### 5. Implement Data Streaming for Real-time Updates

For more real-time weather updates, consider using WebSockets or Server-Sent Events:

```javascript
// Example of integrating SSE with TanStack Query
function useRealtimeWeatherQuery(stationId) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/weather-stream/${stationId}`);
    
    eventSource.onmessage = event => {
      const data = JSON.parse(event.data);
      queryClient.setQueryData(['weatherData', stationId], data);
    };
    
    return () => eventSource.close();
  }, [stationId, queryClient]);
  
  return useWeatherQuery(stationId);
}
```

### 6. Implement Memory Usage Monitoring

Monitor and optimize memory usage, especially for large datasets:

```javascript
// Example memory usage monitoring
const MEMORY_THRESHOLD = 50 * 1024 * 1024; // 50MB

function monitorMemoryUsage() {
  if ('memory' in performance) {
    const memoryInfo = performance.memory;
    if (memoryInfo.usedJSHeapSize > MEMORY_THRESHOLD) {
      console.warn('Memory usage high, pruning cache...');
      queryClient.getQueryCache().clear();
    }
  }
}

// Check periodically
setInterval(monitorMemoryUsage, 60000);
```

### 7. Implement Data Normalization

For more complex data structures, consider normalizing data to avoid duplication:

```javascript
// Example: Normalized data store
const normalizedCache = {
  stations: {
    byId: {
      '1495': { id: '1495', name: 'Ljubljana', /* other data */ },
      '1491': { id: '1491', name: 'Maribor', /* other data */ },
    },
    allIds: ['1495', '1491']
  },
  weatherData: {
    byId: {
      '1495': { /* weather data */ },
      '1491': { /* weather data */ },
    }
  }
};

// Custom serialize/deserialize functions for query client
```

### 8. Implement Analytics for Cache Effectiveness

Track and analyze how effectively the cache is serving users:

```javascript
function trackCacheEffectiveness() {
  queryClient.getQueryCache().subscribe(event => {
    if (event.type === 'updated') {
      const fromCache = event.action.type === 'success' && event.action.dataUpdatedAt === event.query.state.dataUpdatedAt;
      
      analytics.track('query_result', {
        queryKey: JSON.stringify(event.query.queryKey),
        fromCache: fromCache,
        loadTime: event.query.state.dataUpdatedAt - event.query.state.fetchMeta.fetchStart
      });
    }
  });
}
```

### 9. Implement Rate Limiting for API Requests

To prevent overwhelming the API:

```javascript
class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 1000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requestTimestamps = [];
  }
  
  canMakeRequest() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      time => now - time < this.timeWindow
    );
    
    return this.requestTimestamps.length < this.maxRequests;
  }
  
  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(5, 1000); // 5 requests per second

// In queryFn
if (!rateLimiter.canMakeRequest()) {
  await new Promise(resolve => setTimeout(resolve, 200));
}
rateLimiter.recordRequest();
```

### 10. Implement Pagination Support

For handling large datasets:

```javascript
function usePaginatedStationsQuery(page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ['stations', 'paginated', page, pageSize],
    queryFn: () => fetchStations({ page, pageSize }),
    keepPreviousData: true,
  });
}
```

---

This guide reflects our current approach to data fetching and caching while outlining potential improvements. As our application evolves, we'll continue to refine these strategies to provide the best possible user experience.
