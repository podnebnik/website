# TypeScript Migration Guidelines

## Overview

This document provides comprehensive guidance for migrating JavaScript files to TypeScript in the Podnebnik website project. The migration follows a **gradual adoption** approach, allowing developers to convert files incrementally while maintaining full backward compatibility.

## Current TypeScript Configuration State

### Build Configuration (`tsconfig.json`)

The project uses a **mixed approach** configuration designed to support both strict TypeScript development for new files and lenient conversion of existing JavaScript:

```json
{
  "compilerOptions": {
    // Modern JavaScript/TypeScript targeting
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",

    // Bundler-optimized resolution (Vite compatible)
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,

    // JavaScript coexistence
    "allowJs": true,
    "checkJs": false,

    // Strict typing for NEW TypeScript files
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,

    // Lenient settings for CONVERTED files
    "noImplicitThis": false,
    "exactOptionalPropertyTypes": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

### Key Configuration Benefits

- **Gradual Adoption**: JavaScript files work alongside TypeScript without modification
- **Strict New Code**: High type safety for new TypeScript development
- **Lenient Conversion**: Easier migration path from existing JavaScript
- **SolidJS Integration**: Proper JSX handling for reactive components
- **Vite Optimization**: Zero-config TypeScript compilation in development and build

## Future Strictness Roadmap

### Phase 1: Current State (Implemented)

- Mixed JS/TS coexistence ✅
- Core type definitions established ✅
- Weather app fully converted ✅
- Essential utilities migrated ✅

### Phase 2: Intermediate Strictness (Future)

When most files are converted, consider enabling:

```json
{
  "noImplicitThis": true,
  "exactOptionalPropertyTypes": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### Phase 3: Full Strictness (Long-term)

For complete type safety across the codebase:

```json
{
  "checkJs": true, // Type-check JavaScript files
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "allowUnreachableCode": false,
  "allowUnusedLabels": false
}
```

## Migration Guidelines for TypeScript-Familiar Developers

### Quick Start Checklist

1. **File Extension**: Change `.js/.jsx` to `.ts/.tsx`
2. **Add Type Imports**: Import interfaces from `code/types/` (use `.js` extensions!)
3. **Function Signatures**: Add parameter and return types
4. **Component Props**: Define prop interfaces for React/SolidJS components
5. **API Calls**: Use typed API response interfaces
6. **Error Handling**: Use `Result<T, E>` pattern from `common.ts`

**⚠️ Critical Import Rule**: Always use `.js` extensions in import paths, even when importing from `.ts` files. This is required by the project's bundler configuration.

### Import Path Convention (Important!)

**⚠️ Import Confusion Explained**: You'll notice TypeScript imports use `.js` extensions even when importing from `.ts` files:

```typescript
import type { ErrorCategory } from "../types/common.js"; // ← .js extension!
```

**This is intentional** and required because:

- The project uses `"moduleResolution": "bundler"` in `tsconfig.json`
- Vite resolves `common.js` imports to the actual `common.ts` file during build
- This ensures ES modules work correctly when served to browsers
- All existing code in the project follows this pattern

### Example Conversion Pattern

**Before (JavaScript):**

```javascript
// helpers.js
export function categorizeError(error, context = "") {
  if (!navigator.onLine) {
    return { type: "network", message: "Ni povezave z internetom" };
  }
  return { type: "unknown", message: "Prišlo je do napake" };
}

export const StationSelector = (props) => {
  const [selected, setSelected] = createSignal(props.defaultStation);
  // ...
};
```

**After (TypeScript):**

```typescript
// helpers.ts
import type { ErrorCategory, CategorizedError } from "../types/common.js"; // ← Note .js extension

export function categorizeError(
  error: Error | string,
  context: string = ""
): CategorizedError {
  if (!navigator.onLine) {
    return { type: "network" as const, message: "Ni povezave z internetom" };
  }
  return { type: "unknown" as const, message: "Prišlo je do napake" };
}

// components.ts
import type { Component } from "solid-js";
import type { Station } from "../types/weather.js"; // ← Note .js extension

interface StationSelectorProps {
  defaultStation?: Station;
  onStationChange?: (station: Station) => void;
}

export const StationSelector: Component<StationSelectorProps> = (props) => {
  const [selected, setSelected] = createSignal<Station | undefined>(
    props.defaultStation
  );
  // ...
};
```

### Advanced Patterns

#### API Integration with Type Safety

```typescript
import type { DatassetteResponse, WeatherStation } from "../types/api.js";
import type { Result } from "../types/common.js";

async function fetchStations(): Promise<Result<WeatherStation[], string>> {
  try {
    const response = await fetch("/api/stations");
    const data: DatassetteResponse<WeatherStation> = await response.json();
    return { success: true, data: data.rows };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

#### TanStack Query Integration

```typescript
import { createQuery } from "@tanstack/solid-query";
import type { WeatherData } from "../types/weather.js";
import { queryKeys } from "./queryKeys.js";

export const useWeatherData = (stationId: number) => {
  return createQuery(() => ({
    queryKey: queryKeys.weather.current(stationId),
    queryFn: (): Promise<WeatherData> => fetchWeatherData(stationId),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 3,
  }));
};
```

## Migration Guidelines for TypeScript-Hesitant Developers

### Don't Panic! TypeScript is Your Friend 🤗

If TypeScript feels intimidating, remember:

- **You don't need to learn everything at once**
- **Start small with basic type annotations**
- **The TypeScript compiler helps you catch bugs**
- **VS Code provides excellent autocomplete and error detection**

### Gradual Learning Path

#### Step 1: Basic Type Annotations (Week 1)

Just add types to function parameters and return values:

```typescript
// Instead of: function add(a, b) { return a + b; }
function add(a: number, b: number): number {
  return a + b;
}
```

#### Step 2: Interface for Objects (Week 2)

Define shapes for your data:

```typescript
interface User {
  name: string;
  age: number;
  email?: string; // Optional with ?
}
```

#### Step 3: Generic Types (Week 3)

Use existing generic patterns:

```typescript
// Use our pre-built Result type for API calls
import type { Result } from "../types/common.js";

async function saveUser(user: User): Promise<Result<User, string>> {
  // Your existing logic here
}
```

### Common Fears Addressed

**"TypeScript will slow me down"**

- ✅ Actually speeds you up with better autocomplete
- ✅ Catches bugs before runtime
- ✅ Makes refactoring safer

**"I have to rewrite everything"**

- ❌ False! You can convert files one at a time
- ✅ JavaScript files continue working unchanged
- ✅ Start by just changing `.js` to `.ts`

**"Types are too complex"**

- ✅ Use our pre-built types from `code/types/`
- ✅ Copy patterns from converted components
- ✅ TypeScript infers most types automatically

### Minimal Conversion Template

For the absolute minimum TypeScript conversion:

1. **Change file extension**: `myFile.js` → `myFile.ts`
2. **Add one import**: `import type { YourNeededType } from '../types/index.js';`
3. **Fix any red squiggly lines** VS Code shows you
4. **Done!**

That's it. TypeScript will infer most types automatically.

## Practical Migration Workflow

### Step-by-Step Process

1. **Choose a File**: Start with utilities, then components, then complex features
2. **Analyze Dependencies**: Check what types you'll need from `code/types/`
3. **Convert Incrementally**:
   - Change file extension
   - Add type imports
   - Add function signatures
   - Define component props
   - Handle TypeScript errors
4. **Test**: Verify functionality hasn't changed
5. **Update Imports**: Change import paths in files that use the converted module

### Migration Priority Order

**High Priority (Easy wins):**

- Utility functions (`code/utils.ts` ✅ Done)
- Constants files (`code/ali-je-vroce/constants.ts` ✅ Done)
- Type definitions (`code/types/` ✅ Done)

**Medium Priority (Core features):**

- SolidJS components (`code/ali-je-vroce/` ✅ Done)
- API integration hooks
- Shared helpers

**Low Priority (Complex features):**

- Large visualization components
- F# interop boundaries
- Legacy code with complex logic

### File Conversion Checklist

- [ ] Change file extension (`.js/.jsx` → `.ts/.tsx`)
- [ ] Add necessary type imports
- [ ] Define function parameter and return types
- [ ] Add component prop interfaces (for SolidJS/React components)
- [ ] Handle union types for error states
- [ ] Update imports in dependent files
- [ ] Test functionality remains unchanged
- [ ] Update any documentation references

## Available Type Definitions

The project provides comprehensive type definitions in `code/types/`:

### Core Types (`common.ts`)

- `Result<T, E>` - Safe error handling pattern
- `AppError` - Application-specific error types
- `LoadingState` - UI loading state management
- `PaginatedResponse<T>` - API pagination support

### API Types (`api.ts`)

- `DatassetteResponse<T>` - Datasette API responses
- `VremenarApiResponse` - Weather API responses
- Station and weather data interfaces

### Component Types (`components.ts`)

- SolidJS component prop interfaces
- Form and input component types
- Visualization component props

### Weather Types (`weather.ts`)

- `WeatherStation` - Weather station metadata
- `WeatherData` - Temperature and measurement data
- `TemperatureAnalysis` - Statistical analysis types

### Query Types (`queries.ts`)

- TanStack Query configuration types
- Custom query hook interfaces
- Query key factory patterns

## Common Migration Patterns

### Import Path Resolution (Critical!)

When converting files, **always use `.js` extensions** in import paths, even when importing TypeScript files:

```typescript
// ✅ Correct - use .js extension
import type { WeatherData } from "../types/weather.js";
import { fetchData } from "../utils/api.js";

// ❌ Wrong - TypeScript extensions don't work with our bundler config
import type { WeatherData } from "../types/weather.ts"; // Will fail!
import { fetchData } from "../utils/api.ts"; // Will fail!
```

**Why this works:**

- `tsconfig.json` uses `"moduleResolution": "bundler"`
- Vite resolves `.js` imports to actual `.ts` files during build
- This ensures compatibility with ES modules in browsers
- All existing TypeScript code in the project follows this pattern

### Error Handling Migration

```typescript
// Before
function handleApiError(error) {
  return error.message || "Something went wrong";
}

// After
import type { AppError } from "../types/common.js";

function handleApiError(error: unknown): AppError {
  if (error instanceof Error) {
    return { type: "api_error", message: error.message };
  }
  return { type: "unknown_error", message: "Something went wrong" };
}
```

### Component Props Migration

```typescript
// Before
export const WeatherChart = (props) => {
  // ...
};

// After
import type { Component } from "solid-js";
import type { WeatherData } from "../types/weather.js";

interface WeatherChartProps {
  data: WeatherData[];
  title?: string;
  onDataChange?: (data: WeatherData[]) => void;
}

export const WeatherChart: Component<WeatherChartProps> = (props) => {
  // ...
};
```

### API Integration Migration

```typescript
// Before
async function fetchWeather(stationId) {
  const response = await fetch(`/api/weather/${stationId}`);
  return response.json();
}

// After
import type { WeatherApiResponse } from "../types/api.js";
import type { Result } from "../types/common.js";

async function fetchWeather(
  stationId: number
): Promise<Result<WeatherApiResponse, string>> {
  try {
    const response = await fetch(`/api/weather/${stationId}`);
    const data: WeatherApiResponse = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch weather",
    };
  }
}
```

## Resources and Support

### Internal Resources

- **Type Definitions**: `code/types/` directory
- **Examples**: `code/examples/types-example/`
- **Converted Components**: `code/ali-je-vroce/` (complete TypeScript conversion)
- **Documentation**: This file and other `docs/` TypeScript analyses

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Official documentation
- [SolidJS TypeScript Guide](https://www.solidjs.com/guides/typescript) - SolidJS-specific patterns
- [TanStack Query TypeScript](https://tanstack.com/query/latest/docs/react/typescript) - Query typing patterns

### Getting Help

- Check existing TypeScript files in the project for patterns
- Use VS Code's TypeScript language server for real-time error detection
- Reference the comprehensive type definitions in `code/types/`
- Follow patterns from the completed weather app migration

## Conclusion

TypeScript integration in the Podnebnik project is designed to be **gradual, optional, and beneficial**. Whether you're a TypeScript expert or complete beginner, you can contribute effectively:

- **Experts**: Leverage strict typing and advanced patterns for robust code
- **Beginners**: Start small with basic annotations and grow your skills
- **Everyone**: Benefit from better autocomplete, error detection, and refactoring safety

The migration is **incremental** - convert files when it makes sense for your work, not because you have to. The build system supports both JavaScript and TypeScript seamlessly, so you can focus on building great climate data visualizations! 🌡️📊
