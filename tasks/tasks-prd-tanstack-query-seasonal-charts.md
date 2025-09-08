## Relevant Files

- `code/ali-je-vroce/hooks/queries.ts` - Contains existing TanStack Query hooks; new `useHistoricalDataQuery` hook will be added here.
- `code/ali-je-vroce/hooks/useChartData.ts` - Current custom hook that will be replaced/supplemented by TanStack Query approach.
- `code/ali-je-vroce/charts/SeasonalScatter.tsx` - Component that needs to be updated to use new TanStack Query hook.
- `code/ali-je-vroce/charts/SeasonalHistogram.tsx` - Component that needs to be updated to use new TanStack Query hook.
- `code/ali-je-vroce/QueryProvider.tsx` - May need query defaults configuration for historical data.
- `code/types/queries.ts` - Query key factory and types need to be extended for historical data.
- `code/types/models.ts` - Type definitions for historical data processing results.
- `code/types/components.ts` - Component prop types for seasonal charts.
- `code/ali-je-vroce/helpers.ts` - Contains `requestHistoricalWindow` function that will be wrapped by TanStack Query.

### Notes

- This project doesn't currently use Jest for testing, so no test files are included.
- The migration follows a gradual approach, creating new hooks alongside existing ones for backward compatibility.
- Historical data queries use the same error handling patterns as existing weather queries.

### Additional instructions to AI

- **Commit**: Commit after each sub-task if it makes sense (large change).
- **Commit Message**: Create good commit message as senior developer would and follow commitlint style.
- **Exclude from Commit** Never commit `.github/copilot-instructions.md` and `.github/instructions` folder!
  **Package Manager**: Yarn.
- **Dev Server**: Before trying to run dev server, **check if dev server is already running**. IMPORTANT: Dev Server has hot-reload. **On every change in code, the server reacts**.
- **Documentation**: When creating additional documentation for this task, add metadata at the the top, so that not developers easier finds when the document was changed.
- **Issues During Task(Subtask) implementation**: Any special issue that we encounter during implementation, make a not with Task number
- **Updating this file**:

  - Check for duplicate task. Sometimes the file is corrupted.
  - Always check the integrity of the file.

- **Assumption**: Even when you think that you are done with task, ask and wait for confirmation.

## Tasks

- [x] 1.0 Extend Query Infrastructure for Historical Data

  - [x] 1.1 Add historical data query key factory to `code/types/queries.ts`
  - [x] 1.2 Create historical data types in `code/types/models.ts` if needed
  - [x] 1.3 Add historical data query result type to `code/types/queries.ts`
  - [x] 1.4 Update `code/types/components.ts` to ensure seasonal chart props are properly typed

- [x] 2.0 Create Historical Data Query Hook

  - [x] 2.1 Add `useHistoricalDataQuery` hook to `code/ali-je-vroce/hooks/queries.ts`
  - [x] 2.2 Implement query function that wraps `requestHistoricalWindow` from helpers.ts
  - [x] 2.3 Add proper error categorization using existing `categorizeError` function
  - [x] 2.4 Configure query with appropriate cache and staleTime settings
  - [x] 2.5 Add TypeScript types for hook parameters and return values
  - [x] 2.6 Add JSDoc documentation following existing patterns

- [x] 3.0 Update SeasonalScatter Component to Use TanStack Query

  - [x] 3.1 Replace `useChartData` import with `useHistoricalDataQuery` in SeasonalScatter.tsx
  - [x] 3.2 Update component to use TanStack Query loading and error states
  - [x] 3.3 Maintain existing data processing logic in `chartOptions` memo
  - [x] 3.4 Ensure ChartContainer integration remains unchanged
  - [x] 3.5 Verify all existing props and functionality work correctly

- [x] 4.0 Update SeasonalHistogram Component to Use TanStack Query

  - [x] 4.1 Replace `useChartData` import with `useHistoricalDataQuery` in SeasonalHistogram.tsx
  - [x] 4.2 Update component to use TanStack Query loading and error states
  - [x] 4.3 Maintain existing data processing logic in `chartOptions` memo
  - [x] 4.4 Ensure ChartContainer integration remains unchanged
  - [x] 4.5 Verify all existing props and functionality work correctly

- [x] 5.0 Configure Query Defaults and Error Handling

  - [x] 5.1 Add historical data query defaults to QueryProvider.tsx with 15-minute staleTime
  - [x] 5.2 Add comment noting that historical data rarely changes (future optimization opportunity)
  - [x] 5.3 Configure appropriate gcTime (cache time) for historical data
  - [x] 5.4 Ensure error messages are in Slovenian and consistent with existing patterns
  - [x] 5.5 Test error handling scenarios (network failures, API timeouts)

- [x] 6.0 Testing and Validation

  - [x] 6.1 Test SeasonalScatter component renders identically with new query hook
  - [x] 6.2 Test SeasonalHistogram component renders identically with new query hook
  - [x] 6.3 Verify query caching works correctly (check network tab for reduced API calls)
  - [x] 6.4 Test error states display properly in both components
  - [x] 6.5 Test loading states work correctly
  - [x] 6.6 Validate that both components can share cached data when using same parameters
  - [ ] 6.7 Test with different station IDs and date ranges to ensure flexibility

    **CURRENT STATUS:** Both robust charts created but still have issues with TODAY labels and styling, and some computations

    **CURRENT SETUP:** 4 charts total displayed in test mode (`?test=1`):

    1. SeasonalHistogramRobust (robust histogram)
    2. SeasonalHistogram (original histogram)
    3. SeasonalScatterRobust (robust scatter)
    4. SeasonalScatter (original scatter)

    **INITIAL COMMIT WITH CHARTS**: b940de6d7bda1cd83a12a000a40e61054a2acc0f

    **IDENTIFIED ISSUES:**

    - [x] 6.7.1 Compare original vs robust histogram charts to identify TODAY label differences
    - [ ] 6.7.2 Analyze original histogram's working TODAY label implementation
    - [ ] 6.7.3 Fix TODAY label positioning in SeasonalHistogramRobust
    - [x] 6.7.4 Fix any computational differences between original and robust versions; series 2 in robust is not correct for sure
    - [ ] 6.7.5 Ensure consistent styling across all chart versions - robust must match the original
    - [ ] 6.7.6 Test with different station IDs (1030=Bovec, 1495=Ljubljana, etc.)
    - [ ] 6.7.7 Validate both robust charts show identical results to originals
    - [ ] 6.7.8 Verify TODAY labels appear consistently in all scenarios
