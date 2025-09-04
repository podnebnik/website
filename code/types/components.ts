/**
 * TypeScript interfaces for SolidJS component props throughout the website
 */

import { Component, JSX } from 'solid-js';
import { AppError, LoadingState } from './common.js';
import { TemperatureStation } from './api.js';
import { WeatherReading } from './weather.js';

// Base component props
export interface BaseComponentProps {
  class?: string;
  classList?: Record<string, boolean>;
  style?: JSX.CSSProperties | string;
  children?: JSX.Element;
}

// Weather App Component Props
export interface StationSelectorProps extends BaseComponentProps {
  stations: TemperatureStation[];
  selectedStation: TemperatureStation | null;
  onStationSelect: (station: TemperatureStation) => void;
  loading?: boolean;
  error?: AppError | null;
}

export interface TemperatureDisplayProps extends BaseComponentProps {
  temperature: number | null;
  station: TemperatureStation | null;
  reading: WeatherReading | null;
  loadingState: LoadingState;
  error?: AppError | null;
  lastUpdated?: Date;
}

export interface ErrorMessageProps extends BaseComponentProps {
  error: AppError;
  onRetry?: () => void;
  showRetry?: boolean;
}

export interface LoadingSkeletonProps extends BaseComponentProps {
  height?: string;
  width?: string;
  count?: number;
  variant?: 'text' | 'rectangle' | 'circle';
}

export interface StalenessIndicatorProps extends BaseComponentProps {
  lastUpdated: Date;
  maxStaleMinutes?: number;
  showIcon?: boolean;
}

// Chart Component Props (for Highcharts visualizations)
export interface BaseChartProps extends BaseComponentProps {
  data: any[]; // Will be refined when converting specific charts
  height?: number;
  width?: number;
  loading?: boolean;
  error?: AppError | null;
}

export interface TemperatureChartProps extends BaseChartProps {
  stations: TemperatureStation[];
  selectedStation?: TemperatureStation;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  showLegend?: boolean;
}

export interface HeatmapProps extends BaseChartProps {
  colorScale?: string[];
  minValue?: number;
  maxValue?: number;
  valueFormatter?: (value: number) => string;
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
