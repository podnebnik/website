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
- `code/types/components.ts` - Component prop interfaces for SolidJS components
- `code/types/common.ts` - Shared utility types and common interfaces
- `code/types/weather.ts` - Weather station and temperature analysis types
- `code/types/queries.ts` - Application-specific TanStack Query types (leverages built-in TQ types)
- `code/types/guards.ts` - Runtime type validation and type guard functions
- `code/ali-je-vroce/helpers.ts` - Convert helpers.mjs to TypeScript with proper typing
- `code/ali-je-vroce/constants.ts` - Convert constants.mjs to TypeScript
- `code/ali-je-vroce/hooks/queries.ts` - Convert TanStack Query hooks to TypeScript
- `code/ali-je-vroce/hooks/useWeatherData.ts` - Convert custom hooks to TypeScript
- `code/ali-je-vroce/QueryProvider.tsx` - Convert query provider to TypeScript
- `code/utils.ts` - Convert shared utilities to TypeScript
- `code/examples/types-example/` - New example directory showing TypeScript patterns

### Notes

- Focus on analysis before conversion - examine actual API responses rather than trusting existing JSDoc
- Maintain existing file structure but add new TypeScript files alongside JavaScript ones
- F# + Fable generated `.fs.jsx` files remain unchanged
- Use Vite's built-in TypeScript support, no additional build tools needed

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

  - [ ] 3.1 Convert code/utils.mjs to code/utils.ts with proper type annotations
  - [ ] 3.2 Migrate code/ali-je-vroce/constants.mjs to TypeScript
  - [ ] 3.3 Convert code/ali-je-vroce/helpers.mjs to TypeScript with accurate return types
  - [ ] 3.4 Update error categorization function with TypeScript union types
  - [ ] 3.5 Migrate persistence utilities to TypeScript with generic type support
  - [ ] 3.6 Add proper typing to date formatting and utility functions
  - [ ] 3.7 Replace generic JSDoc @returns {Object} with specific TypeScript interfaces
  - [ ] 3.8 Test migrated utilities to ensure runtime behavior matches type definitions

- [ ] 4.0 Weather App Component Migration

  - [ ] 4.1 Convert code/ali-je-vroce/types.js to code/ali-je-vroce/types.ts
  - [ ] 4.2 Migrate code/ali-je-vroce/hooks/queries.js to TypeScript with TanStack Query generics
  - [ ] 4.3 Convert code/ali-je-vroce/hooks/useWeatherData.js to TypeScript
  - [ ] 4.4 Migrate code/ali-je-vroce/QueryProvider.jsx to QueryProvider.tsx
  - [ ] 4.5 Add TypeScript interfaces for all SolidJS component props
  - [ ] 4.6 Convert error handling components to TypeScript with proper error types
  - [ ] 4.7 Migrate station selector and weather display components to TypeScript
  - [ ] 4.8 Add Highcharts configuration typing for weather visualizations
  - [ ] 4.9 Update component imports to use new TypeScript modules
  - [ ] 4.10 Test weather app functionality with TypeScript conversion

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
