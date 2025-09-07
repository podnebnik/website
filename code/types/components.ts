/**
 * TypeScript interfaces for SolidJS component props throughout the website
 */

import { Component, JSX } from 'solid-js';
import { AppError } from './common.js';
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
  todayTemp: number; // Required for SeasonalScatter, different from histogram
  title?: string;
}

// Query Provider Props
export interface QueryProviderProps {
  children: JSX.Element;
  enableDevtools?: boolean;
}

// Generic Data Display Props
export interface DataTableProps<T = any> extends BaseComponentProps {
  data: T[];
  columns: Array<{
    key: keyof T;
    label: string;
    format?: (value: any) => string;
    sortable?: boolean;
  }>;
  loading?: boolean;
  error?: AppError | null;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  sortKey?: keyof T;
  sortDirection?: 'asc' | 'desc';
}

// Navigation and Layout Props
export interface NavigationProps extends BaseComponentProps {
  items: Array<{
    label: string;
    href: string;
    active?: boolean;
    external?: boolean;
  }>;
}

export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Form Component Props
export interface FormFieldProps extends BaseComponentProps {
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
}

export interface SelectProps extends FormFieldProps {
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  value: string;
  onSelectionChange: (value: string) => void;
  placeholder?: string;
  multiple?: boolean;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent) => void;
}

// Utility type for component with ref
export type ComponentWithRef<T extends HTMLElement, P = {}> = Component<P & {
  ref?: T | ((el: T) => void);
}>;

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