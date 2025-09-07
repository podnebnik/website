# Product Requirements Document: TanStack Query Integration for Seasonal Charts

## Introduction/Overview

Migrate the SeasonalScatter and SeasonalHistogram chart components from custom `useChartData` hook to TanStack Query for improved data fetching, caching, and error handling. This will align these components with the existing query patterns used in the weather application while maintaining their current functionality.

**Problem**: The seasonal chart components currently use a custom data fetching approach that doesn't benefit from TanStack Query's caching, background refetching, error handling, and loading state management.

**Goal**: Integrate TanStack Query with SeasonalScatter and SeasonalHistogram components while preserving existing functionality and preparing for future enhancements.

## Goals

1. **Consistency**: Align seasonal chart data fetching with existing TanStack Query patterns in the codebase
2. **Performance**: Leverage TanStack Query's intelligent caching to reduce unnecessary API calls for historical data
3. **User Experience**: Maintain existing loading states and error handling while improving reliability
4. **Maintainability**: Reduce code duplication and create a unified approach to data fetching
5. **Future-Ready**: Establish foundation for additional historical data charts and features

## User Stories

1. **As a user viewing seasonal charts**, I want the charts to load efficiently without unnecessary delays, so that I can analyze temperature patterns quickly.

2. **As a user with slow internet connection**, I want previously loaded chart data to be available immediately when I switch between charts, so that I don't have to wait for the same data to load again.

3. **As a user experiencing network issues**, I want clear error messages when chart data fails to load, so that I understand what's happening and can retry if needed.

4. **As a developer maintaining the codebase**, I want consistent data fetching patterns across all components, so that debugging and extending functionality is easier.

## Functional Requirements

1. **Data Fetching Integration**
   1.1. The system must create a new TanStack Query hook `useHistoricalDataQuery` that wraps the existing `requestHistoricalWindow` function.
   1.2. The system must use query key structure `['historical', stationId, center_mmdd, window_days]` for caching historical temperature data.
   1.3. The system must configure a 15-minute staleTime for historical data queries.

2. **Component Integration**
   2.1. Both SeasonalScatter and SeasonalHistogram components must be able to use the same `useHistoricalDataQuery` hook.
   2.2. The system must preserve existing component props interface: `stationId`, `center_mmdd`, `todayTemp`, and optional `title`.
   2.3. The system must maintain existing chart rendering logic and visual output.

3. **Error Handling**
   3.1. The system must use the same error categorization as existing queries (network, unknown types).
   3.2. The system must provide user-friendly Slovenian error messages consistent with existing patterns.
   3.3. The system must handle both API and Datasette fallback scenarios as currently implemented.

4. **Loading States**
   4.1. The system must maintain existing loading indicators and messages.
   4.2. The system must preserve the current ChartContainer loading behavior.

5. **Migration Strategy**
   5.1. The system must create new TanStack Query hooks alongside existing `useChartData` hook.
   5.2. The system must allow gradual migration without breaking existing functionality.
   5.3. The system must maintain backward compatibility during transition period.

## Non-Goals (Out of Scope)

1. **Data Persistence**: Local storage or IndexedDB persistence is explicitly out of scope for this phase (will be added later with suggestions for localStorage, IndexedDB, etc.).
2. **Chart Visual Changes**: No modifications to chart appearance, styling, or visual behavior.
3. **New Chart Features**: No additional chart types or statistical calculations.
4. **Performance Optimizations**: Beyond standard TanStack Query caching benefits.
5. **Mobile-Specific Optimizations**: Focus remains on existing responsive behavior.

## Design Considerations

- **Hook Consistency**: Follow the same patterns as `useStationsQuery` and `useWeatherQuery` for consistency.
- **Error Messages**: Maintain existing Slovenian language error messages and styling.
- **Loading States**: Preserve existing loading indicators and ChartContainer behavior.
- **Type Safety**: Ensure full TypeScript support with proper type definitions.

## Technical Considerations

- **Query Configuration**: Historical data should use 15-minute staleTime with a note that this data rarely changes, allowing for potential future optimization.
- **Cache Strategy**: Historical window data is relatively static, so aggressive caching is beneficial.
- **Fallback Handling**: Must preserve existing API → Datasette fallback logic in `requestHistoricalWindow`.
- **Bundle Size**: Reuse existing TanStack Query infrastructure without adding new dependencies.
- **Future Extensibility**: Query key structure should accommodate additional historical data types and chart variants.

## Success Metrics

1. **Functional Parity**: Both SeasonalScatter and SeasonalHistogram charts render identical output compared to current implementation.
2. **Performance Improvement**: Reduced API calls for repeated chart data requests due to caching.
3. **Code Quality**: Elimination of custom data fetching logic in favor of standardized TanStack Query patterns.
4. **Error Handling**: Consistent error states across all chart components.
5. **Developer Experience**: Simplified component logic with TanStack Query handling loading/error states.

## Open Questions

1. **Future Data Persistence**: When implementing data persistence later, should we prioritize localStorage (simpler) or IndexedDB (better for large datasets)?
2. **Query Invalidation**: Should we implement any automatic query invalidation strategies for historical data?
3. **Background Refetching**: Given that historical data rarely changes, should we disable background refetching entirely?
4. **Cache Size Management**: Should we implement any cache size limits for historical data queries to prevent memory issues?
5. **Development vs Production**: Should query behavior differ between development and production environments?

## Future Considerations

- **Data Persistence Strategy**: Evaluate localStorage vs IndexedDB for large historical datasets
- **Additional Historical Charts**: Query key structure allows for extending to other chart types
- **Performance Monitoring**: Consider implementing query performance tracking
- **Offline Support**: Potential for offline chart viewing with persisted data

## Notes

- **Commit** Commit after each sub-task if it makes sense (large change).
- **Never** commit `.github/copilot-instructions.md` and `.github/instructions` folder!
- Before trying to run dev server, **check if dev server is already running**.
- When creating some documentation for this task, add metadata at the the top, so that not developers easier finds when the document was changed.
