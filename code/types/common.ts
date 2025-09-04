/**
 * Common utility types and shared interfaces for the Podnebnik website
 */

// Result type for operations that can succeed or fail
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Error categories used throughout the application
export type ErrorCategory = 'network' | 'validation' | 'unknown';

// Standardized error interface
export interface AppError {
  category: ErrorCategory;
  message: string;
  details?: string;
  timestamp?: Date;
}

// Loading states for async operations
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Generic async data wrapper
export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
  lastUpdated?: Date;
}

// Utility type for making certain properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for making certain properties required
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ISO date string type for better type safety
export type ISODateString = string;

// Coordinates for geographical data
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Base interface for entities with ID
export interface BaseEntity {
  id: string;
}

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
