# Product Requirements Document: TypeScript Integration

## Introduction/Overview

The Podnebnik website currently uses a hybrid approach with F# + Fable for some components and plain JavaScript/JSX for SolidJS components. This PRD outlines the integration of TypeScript to improve developer experience, code maintainability, and prepare the project for larger team collaboration while maintaining compatibility with the existing F# + Fable workflow.

**Problem Statement:** The current JavaScript codebase lacks compile-time type checking, leading to potential runtime errors and reduced developer productivity. While JSDoc comments exist throughout the codebase, they are inconsistent, often incomplete, and don't provide reliable type contracts. Many functions use generic `Object` types instead of proper interfaces, making the current JSDoc approach unreliable for type safety.

**Goal:** Implement TypeScript support using a gradual migration strategy that enhances development experience without disrupting existing workflows or build performance.

## Goals

1. **Enhanced Developer Experience:** Provide better IDE support, autocomplete, and IntelliSense for JavaScript/JSX components
2. **Runtime Error Prevention:** Catch type-related errors at compile time before they reach production
3. **Improved Code Documentation:** Replace inconsistent JSDoc comments with native TypeScript interfaces and proper type contracts
4. **Better Maintainability:** Make code refactoring safer and more predictable
5. **Team Collaboration:** Establish clear type contracts between components and modules
6. **Future-Proofing:** Prepare codebase for modern tooling and larger development teams

## User Stories

**As a developer working on climate visualizations:**

- I want TypeScript autocomplete when working with weather station data so that I don't make mistakes with property names
- I want compile-time validation of API response types so that I catch data structure changes early
- I want clear type definitions for Highcharts configurations so that I can build charts more efficiently

**As a new contributor to the project:**

- I want type hints in my IDE so that I can understand component interfaces without reading extensive documentation
- I want compilation errors when I misuse existing functions so that I learn the correct patterns quickly

**As a maintainer of the codebase:**

- I want type safety when refactoring shared utilities so that I can confidently make changes across multiple files
- I want clear interfaces for data fetching hooks so that TanStack Query integration remains consistent

## Functional Requirements

### Phase 1: Foundation Setup

1. **TypeScript Configuration:** The system must include a `tsconfig.json` with mixed approach settings (strict for new code, lenient for converted code)
2. **Development Dependencies:** The build system must include TypeScript, Node.js types, and maintain compatibility with existing Vite + SolidJS setup
3. **Build Integration:** The existing 11ty + Vite build process must compile TypeScript without breaking F# + Fable workflow
4. **File Structure:** The system must support both `.js/.jsx` and `.ts/.tsx` files simultaneously during migration

### Phase 2: Core Type Definitions

5. **API Types Analysis and Design:** The system must analyze existing JSDoc definitions and actual API usage to create accurate TypeScript interfaces that reflect real data structures, rather than blindly converting existing JSDoc types
6. **Type Contract Validation:** The system must validate that new TypeScript types match actual runtime data through careful analysis of API responses and component usage
7. **Utility Functions:** The system must add TypeScript support to shared utility functions and helpers
8. **Data Fetching Types:** The system must provide strong typing for TanStack Query hooks and API responses based on actual usage patterns
9. **Component Interfaces:** The system must define TypeScript interfaces for SolidJS component props

### Phase 3: Priority Component Migration

9. **Build Configuration:** The system must update build and configuration files to handle TypeScript
10. **UI Components:** The system must migrate core SolidJS components to TypeScript while maintaining existing functionality
11. **Visualization Integration:** The system must provide TypeScript support for Highcharts configurations and data visualization components

## Non-Goals (Out of Scope)

1. **F# Code Conversion:** This feature will NOT convert existing F# + Fable components to TypeScript
2. **Breaking Changes:** This feature will NOT require major dependency updates or breaking changes to existing APIs
3. **Performance Optimization:** This feature will NOT focus on build performance improvements beyond maintaining current speeds
4. **Complete Migration:** This feature will NOT require immediate conversion of all JavaScript files to TypeScript
5. **Runtime Type Checking:** This feature will NOT include runtime type validation libraries
6. **Testing Framework Changes:** This feature will NOT modify the existing testing approach or require new test frameworks
7. **Blind JSDoc Conversion:** This feature will NOT blindly convert existing JSDoc types to TypeScript without validation and improvement

## Design Considerations

### Current JSDoc Assessment

The existing JSDoc implementation has several issues that must be addressed:

- **Inconsistent Usage:** Many functions use generic `@returns {Object}` instead of specific interfaces
- **Missing Type Connections:** JSDoc comments don't reference the interfaces defined in `types.js`
- **Incomplete Coverage:** Many parameters and return values lack proper type documentation
- **Runtime Mismatch:** Some JSDoc types may not accurately reflect actual API responses

### TypeScript Migration Strategy

Rather than converting existing JSDoc, the implementation should:

1. **Analyze Actual Usage:** Examine real API responses and component props to understand true data structures
2. **Design Proper Types:** Create TypeScript interfaces based on actual runtime behavior
3. **Validate Against Reality:** Test new types against existing components to ensure accuracy
4. **Progressive Enhancement:** Start with core data types and expand outward

### TypeScript Configuration Strategy

- **Strict Mode for New Files:** New `.ts/.tsx` files will use strict TypeScript settings
- **Gradual Migration:** Existing `.js/.jsx` files can be converted incrementally
- **JSX Preservation:** Maintain `"jsx": "preserve"` to work with SolidJS
- **Module Resolution:** Use `"moduleResolution": "bundler"` for Vite compatibility

### File Organization

- Keep existing file structure in `code/` directory
- Use `.ts` for utility files and types
- Use `.tsx` for SolidJS components
- Maintain separation between F# generated `.fs.jsx` files and TypeScript files

### Integration Points

- **Vite + SolidJS:** Leverage existing `vite-plugin-solid` TypeScript support
- **TanStack Query:** Utilize built-in TypeScript generics for query typing
- **Highcharts:** Add `@types/highcharts` for chart configuration typing
- **Kobalte UI:** Utilize existing TypeScript definitions from `@kobalte/core`

## Technical Considerations

### Dependencies

- Add `typescript`, `@types/node` as dev dependencies
- Maintain existing `vite-plugin-solid` (already supports TypeScript)
- Consider `@types/highcharts` for visualization components
- Preserve all existing F# + Fable packages and tooling

### Build System Integration

- Vite automatically handles TypeScript compilation
- 11ty passthrough copy must include `.ts/.tsx` files
- F# + Fable workflow remains unchanged (outputs `.fs.jsx`)
- Docker development environment compatibility maintained

### Migration Path

1. **Setup Phase:** Add TypeScript config and dependencies
2. **Analysis Phase:** Study actual API responses and data flows to understand true type requirements
3. **Type Design:** Create accurate TypeScript interfaces based on real usage, not existing JSDoc
4. **Core Integration:** Start with data fetching layer and essential utilities
5. **Component Migration:** Gradually migrate SolidJS components with proper type contracts
6. **Validation:** Continuously test types against actual runtime behavior

### Constraints

- Must not break existing F# + Fable compilation
- Must maintain current build performance in Docker environment
- Must work with existing 11ty + Vite + SolidJS setup
- Must not require major version updates of core dependencies

## Success Metrics

Since explicit success metrics are not required, the feature will be considered successful when:

- TypeScript compilation works without errors for converted files
- Existing JavaScript files continue to work unchanged
- Developer IDE experience shows improved autocomplete and error detection
- F# + Fable workflow remains unaffected
- Build performance remains comparable to current setup

## Open Questions

1. **Type Accuracy vs. JSDoc:** How should we handle cases where existing JSDoc types don't match actual runtime data? Should we prioritize accuracy over backward compatibility?

2. **API Response Validation:** Should we implement runtime type checking during development to validate that our TypeScript types match actual API responses?

3. **JSDoc Migration Strategy:** Should we remove all JSDoc comments when migrating to TypeScript, or maintain them for additional documentation?

4. **Type Sharing Strategy:** How should types be shared between F# components and TypeScript components? Should we create shared type definition files?

5. **Gradual Migration Timeline:** What's the preferred timeline for converting existing components? Should we prioritize based on component complexity or usage frequency?

6. **Error Handling Strategy:** Should we maintain the existing error categorization system in TypeScript or enhance it with union types?

7. **Third-party Integration:** Are there any specific requirements for typing third-party libraries beyond Highcharts and Kobalte?

8. **Development Workflow:** Should TypeScript compilation be integrated into the existing `yarn start` command or run as a separate process?

9. **Code Standards:** Should we establish specific TypeScript coding standards or ESLint rules for the project?

## Implementation Notes

This PRD focuses on the foundational setup and gradual migration strategy. The implementation should begin with Phase 1 (Foundation Setup) and proceed incrementally to avoid disruption to ongoing development work. Each phase can be implemented and tested independently, allowing for continuous integration and deployment without blocking other project activities.
