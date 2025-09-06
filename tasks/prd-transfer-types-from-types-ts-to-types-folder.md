# PRD: Transfer Types from types.ts to types/ Folder

## Introduction/Overview

Transfer TypeScript type definitions from the local `code/ali-je-vroce/types.ts` file to the centralized `code/types/` folder to improve code organization, maintainability, and consistency across the project. This involves moving remaining types that haven't been migrated yet, resolving any overlaps with existing types, and updating import statements.

## Goals

- Consolidate all type definitions in the centralized `code/types/` folder
- Eliminate duplication between local and centralized type definitions
- Ensure all types are properly exported through `code/types/index.ts`
- Maintain backward compatibility for existing imports
- No breaking changes to functionality

## User Stories

- As a developer, I want all types centralized so I can easily find and maintain them without checking multiple locations
- As a developer, I want consistent type definitions to avoid confusion and duplication
- As a developer, I want updated imports to work seamlessly after the transfer

## Functional Requirements

1. Analyze existing types in `code/types/` for overlaps with types in `types.ts`
2. Move `StationsResponse` and `StationRow` to `code/types/api.ts` (API response types)
3. Move `StationData` to `code/types/weather.ts` (weather station data)
4. Update import in `code/ali-je-vroce/helpers.ts` from `"./types"` to `"../types/api"`
5. Update `code/types/index.ts` to export any new types if necessary
6. Delete the original `code/ali-je-vroce/types.ts` file
7. Verify no TypeScript compilation errors after changes

## Non-Goals (Out of Scope)

- Refactor or modify the type definitions themselves
- Update types that are already properly centralized
- Change the structure of the `code/types/` folder
- Modify application logic that uses these types

## Design Considerations

- **Type Organization**:
  - API response types → `api.ts`
  - Weather/station data types → `weather.ts`
  - Component props → `components.ts`
  - Common utilities → `common.ts`
- **Import Strategy**: Use relative imports for local files, absolute imports for centralized types
- **Backward Compatibility**: Ensure existing code continues to work with updated imports

## Technical Considerations

- Some types like `ProcessedStation` and `RequestStationData` are already in `code/types/`
- `StationsResponse` is currently imported locally in `helpers.ts`
- Need to handle potential overlaps (e.g., station-related types in both locations)
- Ensure `code/types/index.ts` re-exports all types for convenient importing

## Success Metrics

- No TypeScript compilation errors
- No linting errors
- All types accessible through `code/types/index.ts`
- No broken functionality in the application
- `code/ali-je-vroce/types.ts` successfully removed

## Open Questions

- Should `StationData` be merged with existing `WeatherStation` in `weather.ts`?
- Are there any other files importing from `types.ts` that need updates?</content>
  <parameter name="filePath">/Volumes/SSD-Satechi/Projects/open-source/active-projects/podnebnik/website/tasks/prd-transfer-types-from-types-ts-to-types-folder.md
