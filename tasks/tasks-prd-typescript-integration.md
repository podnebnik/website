# Task List: TypeScript Integration

## Relevant Files

- `tsconfig.json` - Created TypeScript configuration with mixed approach settings (strict for new, lenient for converted)
- `package.json` - Added TypeScript and type definition dependencies (@types/node, typescript)
- `eleventy.config.mjs` - Update passthrough copy to include TypeScript files
- `code/types/` - Created centralized TypeScript type definitions directory
- `code/types/common.ts` - Shared utility types (Result, AppError, LoadingState, etc.)
- `code/types/api.ts` - API response types for Datasette and Vremenar services
- `code/types/components.ts` - SolidJS component prop interfaces
- `code/types/index.ts` - Central export file for all type definitions
- `code/types/api.ts` - API response types based on actual runtime analysis
- `code/types/api-analysis.md` - Detailed comparison of actual vs JSDoc types, with critical bug findings (✅ Complete with critical station ID bug documented)
- `code/types/components.ts` - Component prop interfaces for SolidJS components (✅ Updated with accurate interfaces for all actual component props: StationSelector, TemperatureDisplay, ErrorMessage, StalenessIndicator, LoadingSkeleton, HighChart, SeasonalHistogram, SeasonalScatter, IsItHotDot, Accordion, AliJeVroce, Lazy, FAQ, SeaRise components)
- `code/types/common.ts` - Shared utility types and common interfaces
- `code/types/weather.ts` - Weather station and temperature analysis types
- `code/types/queries.ts` - Application-specific TanStack Query types (leverages built-in TQ types)
- `code/types/guards.ts` - Runtime type validation and type guard functions
- `code/ali-je-vroce/utils/persistence.ts` - Convert persistence utilities to TypeScript with generic type support and LocalStoragePersistor interface
- `code/ali-je-vroce/constants.ts` - Convert constants.mjs to TypeScript
- `code/ali-je-vroce/hooks/queries.ts` - Convert TanStack Query hooks to TypeScript (✅ error categorization function updated with union types)
- `code/ali-je-vroce/hooks/useWeatherData.ts` - Convert custom hooks to TypeScript (✅ Fixed type inconsistencies: station ID number/string conversion, error type handling, AbortController null safety, networkMonitor typing, generateOptimisticWeatherData undefined handling)
- `code/ali-je-vroce/QueryProvider.tsx` - Convert query provider to TypeScript (✅ Converted with proper Component typing, QueryProviderProps interface, updated TanStack Query v5 syntax, fixed import paths in dependent files)
- `code/ali-je-vroce/components/ErrorMessage.tsx` - Error display component converted to TypeScript with proper Component typing and ErrorMessageProps interface (✅ Complete with accessibility features and proper error string handling)
- `code/ali-je-vroce/utils/errorRecovery.ts` - Error recovery utilities converted to TypeScript with proper type definitions for retry mechanisms and network monitoring (✅ Complete with RetryOptions, NetworkMonitorOptions interfaces)
- `code/utils.ts` - Convert shared utilities to TypeScript
- `code/ali-je-vroce/charts/Highchart.tsx` - TypeScript version of Highcharts SolidJS wrapper with proper Highcharts.Options typing
- `code/ali-je-vroce/charts/SeasonalHistogram.tsx` - TypeScript version of seasonal histogram with complete type safety for Highcharts configuration
- `code/ali-je-vroce/charts/SeasonalScatter.tsx` - TypeScript version of seasonal scatter plot with proper type annotations
- `code/ali-je-vroce/vroce.tsx` - TypeScript version of main weather app component with proper type safety (converted from vroce.jsx)
- `code/ali-je-vroce/entry.tsx` - TypeScript version of weather app entry point with null safety (converted from entry.jsx)
- `code/ali-je-vroce/components/Skeletons.tsx` - TypeScript version of loading skeleton components with proper prop typing (converted from Skeletons.jsx)
- `code/ali-je-vroce/components/StalenessIndicator.tsx` - TypeScript version of staleness indicator with proper prop typing (converted from StalenessIndicator.jsx)
- `code/ali-je-vroce/components/TemperatureDisplay.tsx` - Updated imports to use TypeScript versions of Skeletons and StalenessIndicator
- `code/ali-je-vroce/hooks/useWeatherData.ts` - Updated to return ProcessedStation format for component compatibility
- `pages/ali-je-vroce/index.md` - Updated to import entry.tsx instead of entry.jsx
- `code/ali-je-vroce/utils/a11y.js` - Accessibility utilities, pending conversion to TypeScript
- `code/ali-je-vroce/utils/debounce.js` - Debouncing utilities, pending conversion to TypeScript
- `code/ali-je-vroce/utils/prefetching.js` - Updated imports to use TypeScript versions of queries and helpers (pending conversion to TypeScript)
- `code/ali-je-vroce/utils/batchRequests.js` - Updated constants import to use TypeScript version (pending conversion to TypeScript)

### Notes

- Focus on analysis before conversion - examine actual API responses rather than trusting existing JSDoc
- Maintain existing file structure but add new TypeScript files alongside JavaScript ones
- F# + Fable generated `.fs.jsx` files remain unchanged
- Use Vite's built-in TypeScript support, no additional build tools needed
- Do not rely on JSDoc types. They might be wrong. If you are not sure. Ask.
- Do not change any functionality.

## Tasks

- [x] 1.0 Foundation Setup and Configuration

  - [x] 1.1 Add TypeScript and type definition dependencies to package.json
  - [x] 1.2 Create tsconfig.json with mixed approach settings (strict for new files, lenient for converted)
  - [x] 1.3 Configure JSX preservation and SolidJS compatibility in TypeScript config
  - [x] 1.4 Set up module resolution for Vite bundler compatibility
  - [x] 1.5 Create code/types/ directory structure for centralized type definitions
  - [x] 1.6 Verify TypeScript compilation works with existing Vite + SolidJS setup
  - [x] 1.7 Test that F# + Fable workflow remains unaffected by TypeScript additions

- [x] 2.0 API Analysis and Type Design (✅ COMPLETE - Commit: fd3f0eb)

  - [x] 2.1 Analyze actual Datasette API responses from temperature stations endpoint
  - [x] 2.2 Analyze actual Vremenar API responses for weather data
  - [x] 2.3 Document real data structures vs existing JSDoc types in types.js
  - [x] 2.4 Create code/types/api.ts with accurate API response interfaces
  - [x] 2.5 Create code/types/weather.ts with weather station and data types
  - [x] 2.6 Create code/types/common.ts with shared utility types (Result, Error, etc.)
  - [x] 2.7 Define TanStack Query-specific types for query keys and responses
  - [x] 2.8 Create type guards and validation utilities for runtime type checking
  - [x] 2.9 Document type differences and migration notes for existing JSDoc

- [ ] 3.0 Core Utilities Migration

  - [x] 3.1 Convert code/utils.mjs to code/utils.ts with proper type annotations
  - [x] 3.2 Migrate code/ali-je-vroce/constants.mjs to TypeScript
  - [x] 3.3 Convert code/ali-je-vroce/helpers.mjs to TypeScript with accurate return types
  - [x] 3.4 Update error categorization function with TypeScript union types
  - [x] 3.5 Migrate persistence utilities to TypeScript with generic type support
  - [x] 3.6 Add proper typing to date formatting and utility functions
  - [x] 3.7 Test migrated utilities to ensure runtime behavior matches type definitions

- [ ] 4.0 Weather App Component Migration

  - [x] 4.1 Convert code/ali-je-vroce/types.js to code/ali-je-vroce/types.ts
  - [x] 4.2 Migrate code/ali-je-vroce/hooks/queries.js to TypeScript with TanStack Query generics
  - [x] 4.3 Convert code/ali-je-vroce/hooks/useWeatherData.js to TypeScript
  - [x] 4.4 Migrate code/ali-je-vroce/QueryProvider.jsx to QueryProvider.tsx
  - [x] 4.5 Add TypeScript interfaces for all SolidJS component props
  - [x] 4.6 Convert error handling components to TypeScript with proper error types
  - [x] 4.7 Migrate station selector and weather display components to TypeScript
  - [x] 4.8 Add Highcharts configuration typing for weather visualizations (TypeScript conversion complete with proper type safety)
  - [x] 4.9 Update component imports to use new TypeScript modules
  - [x] 4.10 Convert remaining weather app components to TypeScript
    - [x] 4.10.1 Convert code/ali-je-vroce/components/Skeletons.jsx to TypeScript
    - [x] 4.10.2 Convert code/ali-je-vroce/components/StalenessIndicator.jsx to TypeScript
    - [x] 4.10.3 Convert code/ali-je-vroce/vroce.jsx to TypeScript (main weather app component)
    - [x] 4.10.4 Convert code/ali-je-vroce/entry.jsx to TypeScript
  - [ ] 4.11 Convert remaining weather app utilities to TypeScript
    - [x] 4.11.1 Convert code/ali-je-vroce/utils/a11y.js to TypeScript
    - [x] 4.11.2 Convert code/ali-je-vroce/utils/batchRequests.js to TypeScript
    - [x] 4.11.3 Convert code/ali-je-vroce/utils/debounce.js to TypeScript
    - [ ] 4.11.4 Convert code/ali-je-vroce/utils/prefetching.js to TypeScript
  - [ ] 4.12 Clean up old JavaScript chart files and verify TypeScript versions work
  - [ ] 4.13 Test weather app functionality with complete TypeScript conversion

- [ ] 5.0 Build System Integration and Testing
  - [ ] 5.1 Update eleventy.config.mjs to include TypeScript files in passthrough copy
  - [ ] 5.2 Verify Vite handles TypeScript compilation without additional configuration
  - [ ] 5.3 Test Docker development environment compatibility with TypeScript
  - [ ] 5.4 Ensure yarn start command works with mixed JS/TS files
  - [ ] 5.5 Validate that build performance remains comparable to JavaScript-only setup
  - [ ] 5.6 Create code/examples/types-example/ with TypeScript usage patterns
  - [ ] 5.7 Document TypeScript integration in project README
  - [ ] 5.8 Test that existing JavaScript components continue working alongside TypeScript
  - [ ] 5.9 Verify IDE autocomplete and IntelliSense improvements
  - [ ] 5.10 Create migration guidelines for future JavaScript to TypeScript conversions
