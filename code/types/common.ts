/**
 * Common utility types and shared interfaces for the Podnebnik website
 * Enhanced based on actual codebase usage patterns
 */

// =============================================================================
// RESULT AND ERROR TYPES
// =============================================================================

// Result type for operations that can succeed or fail (used throughout helpers.mjs)
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Simplified result type with string errors (matches current codebase pattern)
export type ApiResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Error categories used throughout the application (from utils.mjs)
export type ErrorCategory = 'network' | 'validation' | 'unknown';

// Standardized error interface
export interface AppError {
  category: ErrorCategory;
  message: string;
  details?: string | undefined;
  timestamp?: Date | undefined;
}

// =============================================================================
// LOADING AND ASYNC STATES
// =============================================================================

// Loading states for async operations
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Generic async data wrapper
export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
  lastUpdated?: Date;
}

// TanStack Query compatible state
export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  isStale: boolean;
}

// =============================================================================
// DATE AND TIME TYPES
// =============================================================================

// ISO date string type for better type safety
export type ISODateString = string;

// Unix timestamp (used by Vremenar API)
export type UnixTimestamp = string;

// Date formatting options used in helpers.mjs
export interface DateFormatOptions {
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  timeStyle?: 'short' | 'medium' | 'long' | 'full';
  locale?: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

// Utility type for making certain properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for making certain properties required
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Extract array element type
export type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer U)[] ? U : never;

// Make all properties nullable
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

/**
 * Prettify a type by flattening its structure. This is useful for improving
 * readability in IDEs and error messages.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// =============================================================================
// GEOGRAPHICAL TYPES
// =============================================================================

// Coordinates for geographical data
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Extended coordinates with altitude (used by Vremenar)
export interface CoordinatesWithAltitude extends Coordinates {
  altitude: number;
}

// =============================================================================
// ENTITY AND IDENTIFICATION TYPES
// =============================================================================

// Base interface for entities with ID
export interface BaseEntity {
  id: string;
}

// Numeric ID entity (common in database responses)
export interface NumericEntity {
  id: number;
}

// =============================================================================
// PAGINATION TYPES
// =============================================================================

// Pagination interface
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Generic paginated response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// Datasette-style pagination (with next token)
export interface DatasetteNextPagination {
  next: string | null;
  next_url: string | null;
  filtered_table_rows_count: number;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

// Type guard function type
export type TypeGuard<T> = (value: unknown) => value is T;

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

// Environment configuration
export type Environment = 'development' | 'staging' | 'production';

// Feature flags
export interface FeatureFlags {
  enableDevtools: boolean;
  enableDebugLogging: boolean;
  enableRetries: boolean;
}

// =============================================================================
// SLOVENIAN LANGUAGE SPECIFIC TYPES
// =============================================================================

// Locative case variations (used in station names)
export type LocativePrefix = 'v' | 'na' | 'pri' | 'ob' | 'pod' | 'nad';

// Time references in Slovenian
export type SlovenianTimeReference = 'danes' | 'včeraj' | 'jutri';
