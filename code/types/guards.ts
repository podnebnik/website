/**
 * Type guards and validation utilities for runtime type checking
 * These functions help validate API responses and ensure type safety at runtime
 */

import { 
  TemperatureStationRow,
  TemperaturePercentileRow,
  VremenarStationDetailsResponse,
  DatasetteResponse,
} from './api-raw.js';
import { ProcessedTemperatureData, ProcessedStation } from './models.js';
import { AppError, ErrorCategory } from './common.js';

// =============================================================================
// BASIC TYPE GUARDS
// =============================================================================

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is an object (and not null or array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// =============================================================================
// DATASETTE API GUARDS
// =============================================================================

/**
 * Validate Datasette response structure
 */
export function isDatasetteResponse(value: unknown): value is DatasetteResponse {
  if (!isObject(value)) return false;
  
  const response = value as any;
  return (
    isString(response.database) &&
    isString(response.table) &&
    isBoolean(response.is_view) &&
    isString(response.human_description_en) &&
    isArray(response.rows) &&
    isBoolean(response.truncated) &&
    isNumber(response.filtered_table_rows_count) &&
    isArray(response.columns) &&
    isArray(response.primary_keys) &&
    isObject(response.query) &&
    isNumber(response.query_ms)
  );
}

/**
 * Validate temperature station row structure
 * Expected: [rowid, official_name, name, name_locative, station_id, xml_id, elevation, longitude, latitude]
 */
export function isTemperatureStationRow(value: unknown): value is TemperatureStationRow {
  if (!isArray(value) || value.length !== 9) return false;
  
  const [rowid, officialName, name, nameLocative, stationId, xmlId, elevation, longitude, latitude] = value;
  
  return (
    isNumber(rowid) &&
    isString(officialName) &&
    isString(name) &&
    isString(nameLocative) &&
    isNumber(stationId) &&
    isString(xmlId) &&
    isNumber(elevation) &&
    isNumber(longitude) &&
    isNumber(latitude)
  );
}

/**
 * Validate temperature percentile row structure
 * Expected: [rowid, station_id, date, p00, p05, p20, p40, p50, p60, p80, p95, p100]
 */
export function isTemperaturePercentileRow(value: unknown): value is TemperaturePercentileRow {
  if (!isArray(value) || value.length !== 12) return false;
  
  const [rowid, stationId, date, ...percentiles] = value;
  
  return (
    isNumber(rowid) &&
    isNumber(stationId) &&
    isString(date) &&
    percentiles.every(isNumber)
  );
}

// =============================================================================
// VREMENAR API GUARDS
// =============================================================================

/**
 * Validate Vremenar station details response
 */
export function isVremenarStationDetailsResponse(value: unknown): value is VremenarStationDetailsResponse {
  if (!isObject(value)) return false;
  
  const response = value as any;
  
  return (
    isObject(response.station) &&
    isString(response.station.id) &&
    isString(response.station.name) &&
    isObject(response.station.coordinate) &&
    isNumber(response.station.coordinate.latitude) &&
    isNumber(response.station.coordinate.longitude) &&
    isNumber(response.station.coordinate.altitude) &&
    
    isObject(response.condition) &&
    isString(response.condition.timestamp) &&
    isNumber(response.condition.temperature) &&
    
    isObject(response.statistics) &&
    isString(response.statistics.timestamp) &&
    isNumber(response.statistics.temperature_average_24h) &&
    isNumber(response.statistics.temperature_min_24h) &&
    isNumber(response.statistics.temperature_max_24h) &&
    isString(response.statistics.timestamp_temperature_min_24h) &&
    isString(response.statistics.timestamp_temperature_max_24h)
  );
}

// =============================================================================
// PROCESSED DATA GUARDS
// =============================================================================

/**
 * Validate processed station data
 */
export function isProcessedStation(value: unknown): value is ProcessedStation {
  if (!isObject(value)) return false;
  
  const station = value as any;
  
  return (
    isNumber(station.station_id) &&
    isString(station.name_locative) &&
    isString(station.prefix)
  );
}

/**
 * Validate processed temperature data
 */
export function isProcessedTemperatureData(value: unknown): value is ProcessedTemperatureData {
  if (!isObject(value)) return false;
  
  const data = value as any;
  
  return (
    isString(data.resultValue) &&
    isNumber(data.resultTemperatureValue) &&
    isNumber(data.tempMin) &&
    isString(data.timeMin) &&
    isNumber(data.tempMax) &&
    isString(data.timeMax) &&
    isNumber(data.tempAvg) &&
    isString(data.timeUpdated)
  );
}

// =============================================================================
// ERROR GUARDS
// =============================================================================

/**
 * Validate error category
 */
export function isErrorCategory(value: unknown): value is ErrorCategory {
  return value === 'network' || value === 'validation' || value === 'unknown';
}

/**
 * Validate AppError structure
 */
export function isAppError(value: unknown): value is AppError {
  if (!isObject(value)) return false;
  
  const error = value as any;
  
  return (
    isErrorCategory(error.category) &&
    isString(error.message) &&
    (error.details === undefined || isString(error.details)) &&
    (error.timestamp === undefined || error.timestamp instanceof Date)
  );
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate and transform temperature station row
 */
export function validateTemperatureStationRow(row: unknown): TemperatureStationRow | null {
  if (isTemperatureStationRow(row)) {
    return row;
  }
  console.warn('Invalid temperature station row:', row);
  return null;
}

/**
 * Validate and transform Datasette response
 */
export function validateDatasetteResponse<T = any[]>(response: unknown): DatasetteResponse<T> | null {
  if (isDatasetteResponse(response)) {
    return response as DatasetteResponse<T>;
  }
  console.warn('Invalid Datasette response:', response);
  return null;
}

/**
 * Validate Vremenar response
 */
export function validateVremenarResponse(response: unknown): VremenarStationDetailsResponse | null {
  if (isVremenarStationDetailsResponse(response)) {
    return response;
  }
  console.warn('Invalid Vremenar response:', response);
  return null;
}

// =============================================================================
// ARRAY VALIDATION UTILITIES
// =============================================================================

/**
 * Validate array of items using a type guard
 */
export function validateArray<T>(
  items: unknown[], 
  guard: (item: unknown) => item is T
): T[] {
  return items.filter(guard);
}

/**
 * Validate all items in array and return validation result
 */
export function validateAllItems<T>(
  items: unknown[], 
  guard: (item: unknown) => item is T
): { valid: T[]; invalid: unknown[]; success: boolean } {
  const valid: T[] = [];
  const invalid: unknown[] = [];
  
  items.forEach(item => {
    if (guard(item)) {
      valid.push(item);
    } else {
      invalid.push(item);
    }
  });
  
  return {
    valid,
    invalid,
    success: invalid.length === 0
  };
}

// =============================================================================
// API RESPONSE VALIDATION
// =============================================================================

/**
 * Validate complete stations API response
 */
export function validateStationsResponse(response: unknown) {
  const datasetteResponse = validateDatasetteResponse(response);
  if (!datasetteResponse) {
    return { success: false, error: 'Invalid Datasette response structure' };
  }
  
  const validation = validateAllItems(datasetteResponse.rows, isTemperatureStationRow);
  if (!validation.success) {
    console.warn(`Found ${validation.invalid.length} invalid station rows`);
  }
  
  return {
    success: true,
    data: {
      ...datasetteResponse,
      rows: validation.valid
    },
    warnings: validation.invalid.length > 0 ? ['Some station rows were invalid'] : []
  };
}

/**
 * Validate weather data API response
 */
export function validateWeatherResponse(response: unknown) {
  const vremenarResponse = validateVremenarResponse(response);
  if (!vremenarResponse) {
    return { success: false, error: 'Invalid Vremenar response structure' };
  }
  
  return {
    success: true,
    data: vremenarResponse
  };
}

// =============================================================================
// DEVELOPMENT HELPERS
// =============================================================================

/**
 * Assert that a value matches a type guard (throws in development)
 */
export function assertType<T>(
  value: unknown, 
  guard: (value: unknown) => value is T,
  errorMessage?: string
): asserts value is T {
  if (!guard(value)) {
    const message = errorMessage || `Type assertion failed`;
    console.error(message, value);
    throw new Error(message);
  }
}

/**
 * Create a validation function that logs warnings but doesn't throw
 */
export function createSafeValidator<T>(
  guard: (value: unknown) => value is T,
  fallback: T
) {
  return function(value: unknown): T {
    if (guard(value)) {
      return value;
    }
    console.warn('Validation failed, using fallback:', { value, fallback });
    return fallback;
  };
}
