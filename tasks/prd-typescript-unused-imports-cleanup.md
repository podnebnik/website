# Product Requirements Document: TypeScript Unused Imports and Locals Cleanup

## Introduction/Overview

During the TypeScript migration completed in the previous milestone, some unused imports and local variables were introduced. With TypeScript's strict checking enabled (`noUnusedLocals: true`, `noUnusedParameters: true`), we now have 12 compilation errors across 6 files that need to be addressed. This cleanup task aims to identify which unused imports/locals are genuinely unnecessary vs. legitimate mistakes that indicate missing functionality.

## Goals

- Remove all TypeScript compilation errors related to unused imports and locals
- Preserve imports that indicate missing functionality that should be implemented
- Maintain code quality and ensure no regression in existing functionality
- Document any missing functionality discovered during cleanup

## User Stories

- **As a developer**, I want the TypeScript build to pass without unused import/local errors so that I can rely on the type checking system
- **As a maintainer**, I want to identify any functionality gaps that may have been missed during the TypeScript conversion
- **As a contributor**, I want clean, well-organized imports that accurately reflect what the code actually uses

## Functional Requirements

1. **FR-1**: The system must compile without TypeScript errors when running `npx tsc --noEmit`
2. **FR-2**: All unused imports that are genuinely unnecessary must be removed
3. **FR-3**: Imports that indicate missing functionality must be preserved with appropriate TODO comments
4. **FR-4**: All unused local variables that serve no purpose must be removed
5. **FR-5**: Unused parameters that are part of callback signatures must be prefixed with underscore (\_) to indicate intentional non-use
6. **FR-6**: Example files in `code/examples/` should demonstrate proper TypeScript patterns without unused code
7. **FR-7**: Type imports that are used only in comments or JSDoc should be removed unless they serve documentation purposes

## Non-Goals (Out of Scope)

- Implementing any missing functionality discovered during cleanup
- Refactoring existing functionality beyond unused import removal
- Changing the overall architecture or patterns established during TypeScript migration
- Adding new features or components
- Performance optimization beyond what cleanup naturally provides

## Technical Considerations

### Current Unused Imports Analysis

Based on TypeScript compilation, the following issues were identified:

**High Priority - Likely Genuine Unused Imports:**

- `code/types/components.ts`: `LoadingState`, `WeatherReading` imports not used in type definitions
- `code/examples/types-example/query-patterns.ts`: Generic type parameter `T` in utility functions
- `code/examples/types-example/weather-visualization.tsx`: `options` variable created but not used

**Medium Priority - Potential Missing Functionality:**

- `code/ali-je-vroce/vroce.tsx`: `createSignal`, `onCleanup` imports (may indicate missing reactive state)
- `code/ali-je-vroce/vroce.tsx`: `throttle`, `announce` imports (may indicate missing UX features)

**Low Priority - Implementation Details:**

- `code/ali-je-vroce/utils/batchRequests.ts`: `batchId` variable created for logging but not used
- `code/ali-je-vroce/utils/errorRecovery.ts`: `error` parameter in callback function

### Integration Points

- TypeScript compilation in Vite development server
- CI/CD pipeline TypeScript checking
- IDE/VSCode IntelliSense and error highlighting
- Developer workflow for `yarn start` command

## Success Metrics

- **Primary**: Zero TypeScript compilation errors when running `npx tsc --noEmit`
- **Secondary**: Clean IDE experience with no false positive unused import warnings
- **Tertiary**: Maintained functionality - all existing features work exactly as before cleanup

## Open Questions

1. Should `createSignal` and `onCleanup` imports in `vroce.tsx` be implemented or removed? (Need to check if reactive state management was intended)
2. Should `throttle` and `announce` utilities be implemented for better UX or removed? (Need to check original JavaScript version)
3. Are the unused generic type parameters in example files meant to demonstrate patterns or just artifacts?
4. Should `batchId` in batch requests be used for logging/debugging or removed entirely?
