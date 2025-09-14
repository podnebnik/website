# TanStack Query Architecture - Weather Data Management

## Overview

The weather application uses three specialized TanStack Query hooks to handle different types of data with distinct characteristics and requirements. This document explains the purpose, configuration, and interaction patterns of these queries.

## The Three Query Types

### 1. `useStationsQuery()` - Weather Station Metadata

**Purpose**: Fetches the list of all available weather stations in Slovenia.

**Data Source**: Datasette API (`temperature/temperature~2Eslovenia_stations.json`)

**Why we need it**:

- Provides the dropdown list of locations users can select from
- Contains station metadata (ID, name, location descriptions)
- This data is relatively static - stations don't change frequently

**Configuration**:

```typescript
queryClient.setQueryDefaults(["stations"], {
  staleTime: 1000 * 60 * 30, // 30 minutes - stations don't change often
  retry: 2,
  gcTime: 1000 * 60 * 60, // 1 hour
});
```

**Key Features**:

- ✅ **Persistence**: Saved to localStorage for offline access
- ✅ **Prefetching**: Loaded immediately when app starts
- ✅ **Offline support**: Falls back to cached data when network fails
- ✅ **Error recovery**: Retry with exponential backoff

**Usage**:

```typescript
const { data: stations, isLoading, error } = useStationsQuery();
```

### 2. `useWeatherQuery(stationId)` - Current Weather Data

**Purpose**: Fetches current temperature data for a specific station (24-hour min/max/average) and compares it to historical percentiles.

**Data Sources**:

- Vremenar API (current weather)
- Datasette API (historical percentiles)

**Why we need it**:

- Shows today's temperature statistics for the selected station
- Compares current temperatures to historical percentiles
- Determines if it's "hot" based on historical context
- This is live data that changes throughout the day

**Configuration**:

```typescript
queryClient.setQueryDefaults(["weatherData"], {
  staleTime: 1000 * 60 * 15, // 15 minutes - consider data fresh
  retry: 2,
  refetchInterval: 1000 * 60 * 15, // 15 minutes background refresh
  refetchIntervalInBackground: true,
  gcTime: 1000 * 60 * 60 * 24, // 24 hours for offline support
  placeholderData: (previousData) => previousData, // SWR pattern
});
```

**Key Features**:

- ✅ **Stale-While-Revalidate**: Shows cached data immediately while fetching fresh data
- ✅ **Background refresh**: Updates every 15 minutes
- ✅ **Persistence**: Saved to localStorage per station
- ✅ **Abort support**: Can cancel requests when switching stations
- ✅ **Optimistic updates**: Shows placeholder data during loading

**Usage**:

```typescript
const { data: weather, isLoading, error } = useWeatherQuery(stationId);
```

### 3. `useHistoricalDataQuery(stationId, centerMmdd, windowDays)` - Historical Temperature Data

**Purpose**: Fetches historical temperature data for seasonal charts (e.g., temperature distribution around today's date over multiple years).

**Data Sources**:

- Primary: Custom API endpoint
- Fallback: Datasette API

**Why we need it**:

- Powers the seasonal histogram and scatter plot charts
- Shows temperature patterns around the current date historically
- Helps users understand if today's temperature is unusual for this time of year
- This data is truly historical - it doesn't change once recorded

**Configuration**:

```typescript
queryClient.setQueryDefaults(["historicalData"], {
  staleTime: 1000 * 60 * 15, // 15 minutes - historical data rarely changes
  retry: 2,
  gcTime: 1000 * 60 * 60 * 4, // 4 hours
  refetchOnMount: false, // Historical data is stable
  refetchOnWindowFocus: false, // Historical data is stable
  refetchOnReconnect: true, // Still refetch on reconnect for reliability
});
```

**Key Features**:

- ✅ **Stable data**: No unnecessary refetches since historical data doesn't change
- ✅ **Dual-source**: API first, Datasette fallback for reliability
- ✅ **Parameter validation**: Validates station ID, date format, and window size
- ✅ **Development optimization**: Direct Datasette access in dev mode

**Usage**:

```typescript
const {
  data: historical,
  isLoading,
  error,
} = useHistoricalDataQuery(
  stationId,
  "07-15", // MM-DD format
  30 // days around center date
);
```

## Query Orchestration

### Data Flow

```
1. App loads → useStationsQuery() fetches station list
2. User selects station → useWeatherQuery() fetches current data
3. Charts need historical context → useHistoricalDataQuery()
```

### Prefetching Strategy

The `QueryProvider` implements intelligent prefetching:

```typescript
onMount(() => {
  // 1. Immediate: Fetch stations list
  prefetchStationsData(queryClient);

  // 2. After 2s: Fetch popular stations weather data
  setTimeout(() => {
    prefetchPopularStations(queryClient);
  }, 2000);

  // 3. After 4s: Fetch historical data for popular stations
  setTimeout(() => {
    prefetchPopularStationsHistoricalData(queryClient);
  }, 4000);
});
```

### Persistence Strategy

Queries are selectively persisted to localStorage:

- **Stations**: Always persisted (essential for offline use)
- **Weather data**: Persisted per station (for quick switching)
- **Historical data**: Not persisted (large datasets, rarely reused)

### Error Recovery

Each query type has tailored error handling:

1. **Network-first with cache fallback**: Try network, fall back to cache
2. **Categorized errors**: User-friendly messages in Slovenian
3. **Retry strategies**: Exponential backoff with different retry counts
4. **Graceful degradation**: App remains functional with cached data

## Query Key Factory

Centralized query key management for cache invalidation and organization:

```typescript
export const queryKeys = {
  stations: () => ["stations"],
  weatherData: (stationId: string) => ["weatherData", stationId],
  historicalData: (
    stationId: number,
    centerMmdd: string,
    windowDays: number
  ) => ["historicalData", stationId, centerMmdd, windowDays],
};
```

## Performance Optimizations

### 1. Stale-While-Revalidate (SWR)

Weather data uses SWR pattern for instant UI updates:

- Show cached data immediately
- Fetch fresh data in background
- Update UI when fresh data arrives

### 2. Selective Prefetching

Only prefetch data likely to be used:

- Popular weather stations
- Current date's historical data
- Essential metadata (stations list)

### 3. Smart Cache Management

Different cache times based on data characteristics:

- **Stations**: 1 hour (rarely changes)
- **Weather**: 24 hours (for offline support)
- **Historical**: 4 hours (stable data)

### 4. Request Optimization

- AbortController support for canceling obsolete requests
- Parameter validation to prevent unnecessary API calls
- Conditional fetching based on data availability

## Development vs Production

### Development Mode

- Direct Datasette access for historical data (faster)
- Enhanced logging and debugging
- TanStack Query DevTools enabled

### Production Mode

- API-first with Datasette fallback
- Optimized caching strategies
- Error tracking and recovery

## Best Practices

### 1. Query Usage

```typescript
// ✅ Good: Use reactive dependencies
const weather = useWeatherQuery(() => selectedStation()?.station_id);

// ❌ Bad: Static dependencies
const weather = useWeatherQuery(stationId);
```

### 2. Error Handling

```typescript
// ✅ Good: Handle different error types
if (error?.type === "network") {
  // Show offline message
} else {
  // Show generic error
}
```

### 3. Loading States

```typescript
// ✅ Good: Use placeholder data for better UX
const { data, isLoading, isPlaceholderData } = useWeatherQuery(stationId);

if (isPlaceholderData) {
  // Show loading indicator on cached data
}
```

## Troubleshooting

### Common Issues

1. **Stale data showing**: Check `staleTime` configuration
2. **Too many requests**: Verify query key factory usage
3. **Cache not persisting**: Check localStorage availability
4. **Historical data not loading**: Verify parameter format

### Debug Tools

1. **TanStack Query DevTools**: Available in development
2. **Console logging**: Persistence and cache hits logged
3. **Network tab**: Monitor API requests and responses
4. **Error categorization**: Structured error information

## Migration Notes

When migrating from manual SolidJS state management to TanStack Query:

### From createResource to TanStack Query

```typescript
// ❌ Before: Manual createResource
const [data, { refetch, mutate }] = createResource(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// ✅ After: TanStack Query
const { data, refetch } = useQuery(() => ({
  queryKey: ["data"],
  queryFn: async () => {
    const response = await fetch("/api/data");
    return response.json();
  },
}));
```

### From createSignal + createEffect to Queries

```typescript
// ❌ Before: Manual state management
const [data, setData] = createSignal(null);
const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal(null);

createEffect(() => {
  setLoading(true);
  fetch("/api/data")
    .then((res) => res.json())
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
});

// ✅ After: TanStack Query (handles all states automatically)
const { data, isLoading, error } = useQuery(() => ({
  queryKey: ["data"],
  queryFn: async () => {
    const response = await fetch("/api/data");
    return response.json();
  },
}));
```

### Migration Checklist

1. **Replace manual state management**: Remove `createSignal` + `createEffect` patterns for server data
2. **Replace createResource**: Convert to `useQuery` for better caching and synchronization
3. **Remove manual loading states**: TanStack Query provides `isLoading`, `isFetching`, etc.
4. **Update error handling**: Use categorized errors and built-in error states
5. **Add query key factory**: Organize cache keys for better invalidation
6. **Configure cache settings**: Set appropriate `staleTime`, `gcTime` based on data characteristics
7. **Wrap with QueryProvider**: Ensure components are wrapped with `QueryClientProvider`

## Future Improvements

1. **Infinite queries**: For paginated historical data
2. **Optimistic updates**: For user preferences
3. **Background sync**: Sync cached data when online
4. **Smart prefetching**: ML-based user behavior prediction
