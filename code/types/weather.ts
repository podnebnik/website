/**
 * Weather-specific types for the Podnebnik website
 * Focused on weather station data, temperature readings, and weather conditions
 */

import { ISODateString, Coordinates, BaseEntity } from './common.js';
import { VremenarStationDetailsResponse } from './api-raw.js';
import {
  ProcessedTemperatureData,
  TemperaturePercentiles,
  StationSelectOption as StationSelectOptionModel,
} from './models.js';

// =============================================================================
// WEATHER STATION TYPES
// =============================================================================

/**
 * Generic weather station interface
 */
export interface WeatherStation extends BaseEntity {
  name: string;
  shortName?: string;
  coordinates: Coordinates;
  elevation?: number;
  region?: string;
  active: boolean;
  lastUpdate?: ISODateString;
}

/**
 * Station data from Datasette API
 * Based on actual response: [rowid, station_id, name, name_locative]
 */
export interface StationData {
  rowid: number;
  station_id: number;
  name: string;
  name_locative: string;
}

/**
 * Weather reading/measurement data
 */
export interface WeatherReading {
  stationId: string;
  timestamp: ISODateString;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
  precipitation?: number;
}

// =============================================================================
// TEMPERATURE ANALYSIS TYPES
// =============================================================================

/**
 * Temperature statistics for a given time period
 */
export interface TemperatureStatistics {
  average: number;
  minimum: number;
  maximum: number;
  range: number;
  period: '24h' | '48h' | '7d' | '30d';
  timestamp: ISODateString;
}

/**
 * Percentile ranking for temperature comparison
 */
export type PercentileRank = 'p00' | 'p05' | 'p20' | 'p40' | 'p50' | 'p60' | 'p80' | 'p95' | 'p100';

/**
 * Temperature comparison result
 */
export interface TemperatureComparison {
  currentTemperature: number;
  historicalPercentile: PercentileRank;
  percentileTemperature: number;
  isHot: boolean;          // Whether current temp is considered "hot"
  rankDescription: string; // Human-readable description in Slovenian
}

// =============================================================================
// WEATHER CONDITIONS
// =============================================================================

/**
 * Weather condition categories
 */
export type WeatherCondition = 
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'overcast'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'storm'
  | 'unknown';

/**
 * Weather observation with condition
 */
export interface WeatherObservation {
  stationId: string;
  timestamp: ISODateString;
  condition: WeatherCondition;
  temperature: number;
  description?: string;
  icon?: string;
}

// =============================================================================
// APPLICATION-SPECIFIC TYPES (Ali Je Vroče)
// =============================================================================

/**
 * Station selector option for UI components
 */
// Use canonical processed/UI types from models.ts (internal alias)
type StationSelectOption = StationSelectOptionModel;

/**
 * Complete weather app state data
 */
export interface WeatherAppData {
  selectedStation: StationSelectOption;
  currentWeather: VremenarStationDetailsResponse;
  temperatureAnalysis: ProcessedTemperatureData;
  historicalPercentiles: TemperaturePercentiles;
  lastUpdated: Date;
}

/**
 * Weather data loading states for UI
 */
export type WeatherDataState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: WeatherAppData }
  | { status: 'error'; error: string };

// =============================================================================
// TIME FORMATTING TYPES
// =============================================================================

/**
 * Time reference for weather data display
 */
export type TimeReference = 'danes' | 'včeraj' | 'absolute';

/**
 * Formatted time display
 */
export interface FormattedTime {
  time: string;           // e.g., "14:30"
  reference: TimeReference;
  display: string;        // e.g., "danes ob 14:30"
}

// =============================================================================
// CHART DATA TYPES
// =============================================================================

/**
 * Temperature chart data point
 */
// Temperature chart types come from `models.ts` when needed by components

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Weather data validation result
 */
export interface WeatherDataValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  lastChecked: Date;
}

/**
 * Data quality indicators
 */
export interface DataQuality {
  completeness: number;   // 0-1, percentage of expected data points
  freshness: number;      // Hours since last update
  accuracy: 'high' | 'medium' | 'low' | 'unknown';
}
