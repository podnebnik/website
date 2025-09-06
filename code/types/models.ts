/**
 * Processed / UI-friendly types. These are derived from raw API shapes and
 * intended to be used by components and application logic.
 */

import { ISODateString } from './common.js';

// Percentile keys canonicalized
export type PercentileKey = 'p00' | 'p05' | 'p20' | 'p40' | 'p50' | 'p60' | 'p80' | 'p95' | 'p100';

// Processed station for UI components
export interface StationModel {
  station_id: number;
  name_locative: string;
  prefix: string;
}

// Keep old name for compatibility
export type ProcessedStation = StationModel;

// Processed percentile structure
export interface TemperaturePercentiles {
  stationId: number;
  date: ISODateString;
  percentiles: Record<PercentileKey, number>;
}

export interface ProcessedTemperatureData {
  resultValue: string;
  resultTemperatureValue: number;
  tempMin: number;
  timeMin: string;
  tempMax: number;
  timeMax: string;
  tempAvg: number;
  timeUpdated: string;
}

export interface StationSelectOption {
  value: number;
  label: string;
  prefix: string;
}

export interface TemperatureDataPoint {
  timestamp: number;
  temperature: number;
  label?: string;
}

export interface TemperatureChartData {
  series: TemperatureDataPoint[];
  title: string;
  subtitle?: string;
  yAxisLabel: string;
  color?: string;
}
