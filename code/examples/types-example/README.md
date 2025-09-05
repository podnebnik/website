# TypeScript Usage Patterns for Podnebnik

> **Created**: September 5, 2025  
> **Created by**: GitHub Copilot (TypeScript Integration Task 5.6)  
> **Last updated**: September 5, 2025  
> **Purpose**: TypeScript usage examples and patterns for the Podnebnik website team

This directory contains examples demonstrating TypeScript usage patterns specific to the Podnebnik website architecture.

## Examples Overview

- **`basic-component.tsx`** - Basic SolidJS component with TypeScript
- **`api-integration.ts`** - Datasette API integration with proper typing
- **`weather-visualization.tsx`** - Highcharts weather visualization component
- **`query-patterns.ts`** - TanStack Query usage patterns
- **`error-handling.ts`** - Error categorization and handling patterns
- **`type-guards.ts`** - Runtime type validation examples
- **`utility-functions.ts`** - Common utility function patterns

## Key Principles

### 1. Gradual Adoption

- TypeScript files work alongside JavaScript files
- No need to convert everything at once
- Use `.ts` for utilities, `.tsx` for components

### 2. Project-Specific Types

- Import from `code/types/` for shared interfaces
- Use consistent naming conventions
- Leverage existing type definitions

### 3. SolidJS Integration

- Use `Component` type for functional components
- Properly type props interfaces
- Leverage SolidJS reactive primitives with TypeScript

### 4. API Integration

- Use type-safe API calls with proper error handling
- Implement runtime type validation for external data
- Leverage TanStack Query generics for data fetching

## Getting Started

1. **For new components**: Use `.tsx` extension and follow `basic-component.tsx` pattern
2. **For utilities**: Use `.ts` extension and follow `utility-functions.ts` pattern
3. **For API work**: Follow `api-integration.ts` and `query-patterns.ts` examples
4. **For visualizations**: Use `weather-visualization.tsx` as a template

## Migration Strategy

1. Start with utility functions (easy wins)
2. Convert components one at a time
3. Use type guards for external data validation
4. Gradually tighten type strictness

## Documentation & Resources

### Essential Reading

- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Comprehensive TypeScript guide
- [TypeScript in 5 minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html) - Quick start for beginners

### Framework Integration

- [SolidJS TypeScript Guide](https://www.solidjs.com/guides/typescript) - Official SolidJS + TypeScript integration
- [SolidJS API Reference](https://www.solidjs.com/docs/latest/api) - Typed API documentation
- [TanStack Query for SolidJS](https://tanstack.com/query/latest/docs/framework/solid/overview) - Our data fetching setup
- [TanStack Query TypeScript Guide](https://tanstack.com/query/latest/docs/framework/solid/typescript) - Query typing patterns

### Advanced Patterns

- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates) - Runtime type validation
- [Effective Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) - TanStack Query best practices

### Project-Specific

- [Highcharts TypeScript Declarations](https://github.com/highcharts/highcharts/tree/master/ts) - Chart typing
- [Highcharts API Reference](https://api.highcharts.com/highcharts/) - For Options interfaces
- [Vite TypeScript Support](https://vitejs.dev/guide/features.html#typescript) - Our build system

### Internal Resources

- Project types: `code/types/`
- Existing TypeScript examples: `code/ali-je-vroce/`
- Performance analysis: `docs/typescript-performance-analysis.md`
