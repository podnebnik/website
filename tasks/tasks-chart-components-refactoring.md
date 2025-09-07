## Relevant Files

- `code/ali-je-vroce/utils/statistics.ts` - Shared statistical functions (percentile, mean, stddev, linear regression)
- `code/ali-je-vroce/utils/chartHelpers.ts` - Common chart utilities (color generation, data transformation helpers)
- `code/ali-je-vroce/utils/chartConstants.ts` - Shared constants for chart configuration (colors, dimensions, labels)
- `code/ali-je-vroce/hooks/useChartData.ts` - Custom hook for data loading with error handling and caching
- `code/ali-je-vroce/charts/config/scatterConfig.ts` - Highcharts configuration builder for scatter charts
- `code/ali-je-vroce/charts/config/histogramConfig.ts` - Highcharts configuration builder for histogram charts
- `code/ali-je-vroce/charts/SeasonalScatter.tsx` - Refactored scatter chart component (existing file)
- `code/ali-je-vroce/charts/SeasonalHistogram.tsx` - Refactored histogram chart component (existing file)

### Notes

- This refactoring focuses on extracting shared code and improving component structure without changing functionality
- The existing components will remain in the same location but will be significantly refactored to use shared utilities
- No unit tests are planned initially as the original components don't have tests, but the refactored utilities would be good candidates for future testing
- Commit after each task is implemented, unless the change in sub-task is large and it would be easier to review the changed.
- Do not commit files that you did not change or created (`.github/copilot-instructions.md` and `.github/instructions` folder)
- Always commit with good commit message as senior developer would (follow commitlint rules)
- If you want to run `yarn run start` check if dev server is already running`

## Tasks

- [x] 1.0 Extract Shared Statistical and Mathematical Utilities
  - [x] 1.1 Create `code/ali-je-vroce/utils/statistics.ts` with percentile calculation function
  - [x] 1.2 Add linear regression function (`linreg`) to statistics utility
  - [x] 1.3 Add statistical helper functions (mean, standard deviation) to statistics utility
  - [x] 1.4 Create `code/ali-je-vroce/utils/mathHelpers.ts` with clamp function and other math utilities
  - [x] 1.5 Add color interpolation function (`colorFor`) from SeasonalScatter to mathHelpers
  - [x] 1.6 Add Epanechnikov kernel function for KDE calculations to statistics utility
- [x] 2.0 Create Chart Configuration Builders
  - [x] 2.1 Create `code/ali-je-vroce/utils/chartConstants.ts` with shared styling constants
  - [x] 2.2 Define color schemes, spacing values, and common chart dimensions in constants
  - [x] 2.3 Create `code/ali-je-vroce/charts/config/scatterConfig.ts` for scatter chart configuration
  - [x] 2.4 Extract scatter chart series builders (history, trend line, today point) to scatterConfig
  - [x] 2.5 Create `code/ali-je-vroce/charts/config/histogramConfig.ts` for histogram chart configuration
  - [x] 2.6 Extract histogram chart series builders (percentile areas, label points) to histogramConfig
  - [x] 2.7 Create shared axis configuration builders for temperature charts
  - [x] 2.8 Extract tooltip and legend configuration builders to shared utilities
- [ ] 3.0 Extract Data Loading Logic into Custom Hook
  - [ ] 3.1 Create `code/ali-je-vroce/hooks/useChartData.ts` custom hook for data loading
  - [ ] 3.2 Implement reactive data loading with prop change detection in the hook
  - [ ] 3.3 Add error handling and loading states management to the hook
  - [ ] 3.4 Create data validation and processing logic in the hook
  - [ ] 3.5 Add memoization for expensive calculations (percentiles, KDE) in the hook
  - [ ] 3.6 Implement proper SolidJS reactive prop capture to avoid warnings
- [ ] 4.0 Refactor Chart Components to Use Shared Utilities
  - [ ] 4.1 Refactor `SeasonalScatter.tsx` to use extracted statistical utilities
  - [ ] 4.2 Replace inline chart configuration in SeasonalScatter with configuration builders
  - [ ] 4.3 Update SeasonalScatter to use the custom data loading hook
  - [ ] 4.4 Refactor `SeasonalHistogram.tsx` to use extracted statistical utilities
  - [ ] 4.5 Replace inline chart configuration in SeasonalHistogram with configuration builders
  - [ ] 4.6 Update SeasonalHistogram to use the custom data loading hook
  - [ ] 4.7 Standardize error handling and loading states across both components
  - [ ] 4.8 Remove duplicate utility functions from both component files
  - [ ] 4.9 Update imports and ensure TypeScript compatibility across all files
