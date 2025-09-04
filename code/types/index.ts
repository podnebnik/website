/**
 * Centralized type definitions for the Podnebnik website
 * 
 * This index file re-exports all types from the different type modules
 * for convenient importing throughout the application.
 * 
 * Usage:
 * import { TemperatureStation, AppError, StationSelectorProps } from '/code/types/index.js';
 */

// Common utility types
export * from './common.js';

// API response types
export * from './api.js';

// Component prop interfaces
export * from './components.js';

// Type guards and validation utilities (to be added in later tasks)
// export * from './guards.js';

// TanStack Query specific types (to be added in later tasks)  
// export * from './queries.js';
