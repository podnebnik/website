# API Analysis Report: Actual vs JSDoc Types

## Overview

This document compares the actual API responses from Datasette and Vremenar services with the existing JSDoc type definitions in `code/ali-je-vroce/types.js`. Based on this analysis, new TypeScript interfaces will be created that accurately reflect the real data structures.

## Datasette API Analysis

### Temperature Stations Endpoint

**Actual Response Structure:**

```
GET /temperature/temperature~2Eslovenia_stations.json
```

**Real Response Fields:**

```json
{
  "database": "temperature",
  "table": "temperature.slovenia_stations",
  "is_view": false,
  "human_description_en": "",
  "rows": [
    [
      1,
      "Bilje",
      "Nova Gorica",
      "v Novi Gorici",
      1402,
      "NOVA-GOR_BILJE",
      55,
      13.628606,
      45.895872
    ]
  ],
  "truncated": false,
  "filtered_table_rows_count": 15,
  "expanded_columns": [],
  "expandable_columns": [],
  "columns": [
    "rowid",
    "official_name",
    "name",
    "name_locative",
    "station_id",
    "xml_id",
    "elevation",
    "longitude",
    "latitude"
  ],
  "primary_keys": [],
  "units": {},
  "query": {
    "sql": "select...",
    "params": {}
  },
  "facet_results": {},
  "suggested_facets": [],
  "next": null,
  "next_url": null,
  "private": false,
  "allow_execute_sql": true,
  "query_ms": 5.586458999459865
}
```

**JSDoc vs Reality Comparison:**

| Field            | JSDoc Type                                           | Real Structure                                                             | Notes                                                  |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `rows`           | `StationRow[]` as `[number, number, string, string]` | `[number, string, string, string, number, string, number, number, number]` | **MISMATCH**: Real rows have 9 fields, JSDoc assumes 4 |
| Station data     | Missing longitude, latitude, elevation               | Full geographic data available                                             | **INCOMPLETE**: JSDoc missing critical fields          |
| Response wrapper | Only documents `rows`                                | Full Datasette response structure                                          | **INCOMPLETE**: Missing meta, query, pagination        |

### Temperature Percentiles Endpoint

**Actual Response Structure:**

```
GET /temperature/temperature~2Eslovenia_historical~2Edaily~2Eaverage_percentiles.json
```

**Real Response Fields:**

```json
{
  "columns": [
    "rowid",
    "station_id",
    "date",
    "p00",
    "p05",
    "p20",
    "p40",
    "p50",
    "p60",
    "p80",
    "p95",
    "p100"
  ],
  "rows": [
    [
      1,
      1008,
      "2025-07-01",
      13.4,
      17.6,
      20.0,
      21.6,
      22.1,
      22.9,
      24.5,
      26.7,
      28.9
    ]
  ]
}
```

**JSDoc vs Reality:**

- **MISSING**: No JSDoc types exist for percentile responses
- **Used in code**: The helpers.mjs expects this structure but lacks proper typing

## Vremenar API Analysis

### Station Details Endpoint

**Actual Response Structure:**

```
GET /stations/details/METEO-{stationId}?country=si
```

**Real Response:**

```json
{
  "station": {
    "id": "METEO-1495",
    "name": "Ljubljana",
    "coordinate": {
      "latitude": 46.0655,
      "longitude": 14.5124,
      "altitude": 299.0
    },
    "zoom_level": 7.5,
    "forecast_only": false,
    "alerts_area": "SI009"
  },
  "condition": {
    "observation": "recent",
    "timestamp": "1756965600000",
    "icon": "prevCloudy_day",
    "temperature": 15.0
  },
  "statistics": {
    "timestamp": "1756968000000",
    "temperature_average_24h": 19.0,
    "temperature_average_48h": 18.5,
    "temperature_min_24h": 14.7,
    "temperature_max_24h": 24.8,
    "timestamp_temperature_min_24h": "1756957200000",
    "timestamp_temperature_max_24h": "1756909200000"
  }
}
```

**JSDoc vs Reality:**

- **MISSING**: No JSDoc types exist for Vremenar responses
- **Used extensively**: The helpers.mjs relies heavily on `dataAverage.statistics.*` fields

## Processed Data Structures

### Station Processing (from helpers.mjs)

**Current Processing Logic:**

```javascript
// From loadStations() function
for (let row of dataStations["rows"]) {
  let name_list = row[3].split(" "); // Uses name_locative field
  stationsList.push({
    station_id: row[1], // Actually row[4] in real data!
    name_locative: name_list.slice(1).join(" "),
    prefix: name_list[0],
  });
}
```

**Critical Bug Found:**

- JSDoc assumes `station_id` is at `row[1]`, but actual data has it at `row[4]`
- This is likely causing runtime errors that weren't caught due to lack of type checking

## Key Findings

1. **JSDoc Inaccuracy**: Existing JSDoc types don't match actual API responses
2. **Missing Types**: Critical API responses (Vremenar, percentiles) have no type definitions
3. **Array Index Bugs**: Hardcoded array indices in JSDoc don't match real data structure
4. **Incomplete Coverage**: Only covers basic station data, missing full API metadata

## Recommendations for TypeScript Implementation

1. **Create accurate interfaces** based on actual API responses, not JSDoc
2. **Add full Datasette response wrapper types** for proper metadata handling
3. **Define complete Vremenar response types** for weather data
4. **Use proper field names** instead of array index assumptions
5. **Add runtime validation** to catch API response changes
6. **Fix existing bugs** found during this analysis

## Priority Fixes

1. **Station ID Bug**: Fix array index mismatch in station processing
2. **Missing Vremenar Types**: Add types for the most used API
3. **Percentile Response Types**: Add missing percentile data types
4. **Datasette Wrapper**: Complete response metadata types

## Migration Guide: From JSDoc to TypeScript

### Immediate Action Items

#### 1. Fix Critical Bug in Station Processing

**Current Code (helpers.mjs):**

```javascript
// BUG: Using wrong array index for station_id
for (let row of dataStations["rows"]) {
  let name_list = row[3].split(" ");
  stationsList.push({
    station_id: row[1], // ❌ WRONG! Should be row[4]
    name_locative: name_list.slice(1).join(" "),
    prefix: name_list[0],
  });
}
```

**Fixed Code:**

```typescript
// ✅ CORRECT: Use proper array indices based on actual API response
for (let row of dataStations.rows) {
  if (isTemperatureStationRow(row)) {
    const [
      rowid,
      officialName,
      name,
      nameLocative,
      stationId,
      xmlId,
      elevation,
      longitude,
      latitude,
    ] = row;
    const nameList = nameLocative.split(" ");
    stationsList.push({
      station_id: stationId, // ✅ CORRECT: row[4]
      name_locative: nameList.slice(1).join(" "),
      prefix: nameList[0],
    });
  }
}
```

#### 2. Replace JSDoc with TypeScript Imports

**Before (in helpers.mjs):**

```javascript
/**
 * @typedef {Object} ProcessedStation
 * @property {number} station_id
 * @property {string} name_locative
 * @property {string} prefix
 */
```

**After (in helpers.ts):**

```typescript
import {
  ProcessedStation,
  TemperatureStationsResponse,
} from "/code/types/index.js";
```

#### 3. Add Runtime Validation

**Before (unsafe):**

```javascript
const dataStations = await resultStations.json();
// No validation - assumes structure is correct
```

**After (with validation):**

```typescript
import { validateStationsResponse } from "/code/types/index.js";

const response = await resultStations.json();
const validation = validateStationsResponse(response);
if (!validation.success) {
  throw new Error(`Invalid stations response: ${validation.error}`);
}
const dataStations = validation.data;
```

### File-by-File Migration Plan

#### 1. `code/ali-je-vroce/types.js` → DELETE

- **Action**: Remove entirely
- **Replacement**: Import from `/code/types/index.js`
- **Reason**: All types have been recreated more accurately

#### 2. `code/ali-je-vroce/helpers.mjs` → `helpers.ts`

- **Critical Fix**: Station ID array index bug
- **Add**: Type annotations for all functions
- **Add**: Runtime validation for API responses
- **Add**: Proper error typing

#### 3. `code/ali-je-vroce/constants.mjs` → `constants.ts`

- **Add**: Type annotations for all constants
- **Replace**: JSDoc with proper TypeScript types

#### 4. `code/ali-je-vroce/hooks/queries.js` → `queries.ts`

- **Add**: TanStack Query generic types
- **Add**: Proper query key typing
- **Add**: Error categorization types

### Type Safety Improvements

#### 1. Replace Magic Numbers with Typed Access

**Before:**

```javascript
// Fragile: relies on array position
const stationId = row[1]; // Wrong index!
const name = row[2];
```

**After:**

```typescript
// Type-safe: destructured with validation
if (isTemperatureStationRow(row)) {
  const [rowid, officialName, name, nameLocative, stationId] = row;
  // Compiler ensures correct usage
}
```

#### 2. Add Compile-Time API Contract Validation

**Before:**

```javascript
// Runtime surprise if API changes
const temp = data.statistics.temperature_average_24h;
```

**After:**

```typescript
// Compile-time validation
if (isVremenarStationDetailsResponse(data)) {
  const temp = data.statistics.temperature_average_24h; // ✅ Type-safe
}
```

### Breaking Changes and Compatibility

#### 1. Array Index Changes

- **Impact**: `helpers.mjs` station processing
- **Fix**: Update array indices to match real API
- **Risk**: HIGH - this is a critical bug

#### 2. Import Path Changes

- **Impact**: All files importing from `types.js`
- **Fix**: Update to import from `/code/types/index.js`
- **Risk**: LOW - simple find/replace

#### 3. Function Signature Changes

- **Impact**: Functions now return properly typed objects
- **Fix**: Update consuming code to handle typed returns
- **Risk**: MEDIUM - may require code updates

### Testing Strategy

#### 1. Validate Against Real API Responses

```typescript
// Test with actual API calls
const response = await fetch("/temperature/stations");
const data = await response.json();
console.assert(isDatasetteResponse(data), "Response validation failed");
```

#### 2. Regression Testing

```typescript
// Ensure old behavior still works with new types
const oldResult = processStationDataOldWay(mockData);
const newResult = processStationDataNewWay(mockData);
console.assert(
  deepEqual(oldResult, newResult),
  "Migration broke functionality"
);
```

### Performance Considerations

#### 1. Runtime Validation Overhead

- **Impact**: Type guards add runtime checks
- **Mitigation**: Use only in development or at API boundaries
- **Benefit**: Catches API changes immediately

#### 2. Bundle Size

- **Impact**: TypeScript adds no runtime overhead
- **Benefit**: Better tree-shaking with explicit imports

### Rollback Plan

If migration causes issues:

1. **Quick Fix**: Rename `.ts` files back to `.js/.mjs`
2. **Medium Fix**: Restore from git before migration
3. **Long-term Fix**: Address specific TypeScript errors incrementally

### Success Metrics

1. **Bug Detection**: TypeScript catches the station ID bug at compile time
2. **Developer Experience**: IDE autocomplete works correctly
3. **Runtime Safety**: Type guards catch API response changes
4. **Maintainability**: New contributors understand interfaces immediately
