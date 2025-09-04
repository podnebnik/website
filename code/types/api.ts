/**
 * API response types for external services used by the Podnebnik website
 * These types are based on actual API responses and should be validated at runtime
 */

import { ISODateString, Coordinates, BaseEntity } from './common.js';

// Datasette API Types (for climate data)
export interface DatasetteMeta {
  database: string;
  table: string;
  query_ms: number;
  rows: number;
  columns: string[];
}

export interface DatasetteResponse<T = Record<string, any>> {
  rows: T[];
  truncated: boolean;
  ok: boolean;
  next?: string;
  meta?: DatasetteMeta;
}

// Temperature Station Types
export interface TemperatureStation extends BaseEntity {
  name: string;
  shortName?: string;
  coordinates: Coordinates;
  elevation?: number;
  region?: string;
  active: boolean;
  lastUpdate?: ISODateString;
}

export interface TemperatureReading {
  stationId: string;
  timestamp: ISODateString;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
}

// Vremenar API Types (weather service)
export interface VremenarStation {
  id: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  altitude: number;
  county: string;
  river?: string;
}

export interface VremenarWeatherData {
  station: string;
  valid: ISODateString;
  temperature?: number;
  temperatureGround?: number;
  dewPoint?: number;
  humidity?: number;
  pressure?: number;
  pressureMsl?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  precipitation?: number;
  precipitationAccumulated?: number;
  visibility?: number;
  cloudCover?: number;
  sunshine?: number;
  solarRadiation?: number;
}

export interface VremenarResponse<T> {
  data: T[];
  meta: {
    station: string;
    generated: ISODateString;
    count: number;
  };
}

// API Error Types
export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, any>;
  status?: number;
}

// Generic API Response wrapper
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: ApiErrorResponse };

// Query parameter types for common API calls
export interface StationQueryParams {
  region?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface WeatherQueryParams {
  station: string;
  from?: ISODateString;
  to?: ISODateString;
  limit?: number;
}

export interface TemperatureQueryParams {
  station: string;
  startDate?: ISODateString;
  endDate?: ISODateString;
  aggregation?: 'hourly' | 'daily' | 'monthly';
}
