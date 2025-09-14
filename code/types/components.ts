/**
 * TypeScript interfaces for SolidJS component props throughout the website
 */

import { JSX } from 'solid-js';
import { ProcessedStation } from './models.js';
import * as Highcharts from 'highcharts';

// Base component props
export interface BaseComponentProps {
  class?: string;
  classList?: Record<string, boolean>;
  style?: JSX.CSSProperties | string;
  children?: JSX.Element;
}

// Weather App Component Props
export interface StationSelectorProps extends BaseComponentProps {
  stations: ProcessedStation[];
  selectedStation: ProcessedStation | null;
  onStationChange: (station: ProcessedStation) => void;
  isLoading: boolean;
  stationPrefix?: string;
}

export interface TemperatureDisplayProps extends BaseComponentProps {
  result: string; // Percentile result key (e.g., 'p00', 'p05')
  resultTemperature: string; // Formatted temperature string with unit
  tempMin: string; // Minimum temperature value
  timeMin: string; // Time when minimum temperature was recorded  
  tempMax: string; // Maximum temperature value
  timeMax: string; // Time when maximum temperature was recorded
  tempAvg: string; // Average temperature value
  timeUpdated: string; // Last update time (ISO string or formatted)
  isLoading: boolean; // Whether data is currently loading
  isStale: boolean; // Whether data is stale and being refreshed
  labels: Record<string, string>; // Textual labels for percentiles
  values: Record<string, string>; // Main temperature result values
  descriptions: Record<string, string>; // Descriptions for percentiles
}

export interface ErrorMessageProps extends BaseComponentProps {
  error: string;
  onRetry?: () => void;
}

export interface LoadingSkeletonProps extends BaseComponentProps {
  type: 'main' | 'description' | 'stats' | 'context' | 'lastUpdated' | 'chart' | 'scatter' | 'histogram';
}

export interface StalenessIndicatorProps extends BaseComponentProps {
  isStale: boolean;
  className?: string;
}

// Chart Component Props (for Highcharts visualizations)
export interface HighchartProps extends BaseComponentProps {
  options: Highcharts.Options; // Now properly typed with imported Highcharts types
  height?: string;
}

export interface SeasonalHistogramProps extends BaseComponentProps {
  stationId: number | string;
  center_mmdd: string; // Format: "MM-DD"
  todayTemp?: number | null;
  title?: string;
}

export interface SeasonalScatterProps extends BaseComponentProps {
  stationId: number | string;
  center_mmdd: string; // Format: "MM-DD" 
  todayTemp?: number | null; // Make optional like histogram
  title?: string;
}

// Query Provider Props
export interface QueryProviderProps {
  children: JSX.Element;
  enableDevtools?: boolean;
}

// Additional Component Props
export interface IsItHotDotProps extends BaseComponentProps {
  color: 'p00' | 'p05' | 'p20' | 'p40' | 'p60' | 'p80' | 'p95' | 'initial';
}

export interface AccordionProps extends BaseComponentProps {
  variant?: 'default' | 'outline';
  multiple?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

// Main Weather App Component (no props)
export interface AliJeVroceProps {
  // The main weather app component takes no props
}

// Lazy Loading Component
export interface LazyProps {
  element: () => JSX.Element;
}

// FAQ Component (no props)  
export interface FaqProps {
  // FAQ component takes no props
}

// Sea Level Rise Component
export interface SeaRiseProps {
  container: HTMLElement;
  scenario: any;
  flooding: any;
}

// Temperature Heatmaps Component (function-based, no specific props interface needed)
// Note: heatmaps.jsx exports functions, not SolidJS components