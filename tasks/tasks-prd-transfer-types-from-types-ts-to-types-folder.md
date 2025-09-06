## Relevant Files

- `code/ali-je-vroce/types.ts` - Source file containing types to transfer
- `code/types/api.ts` - Target for API response types (StationsResponse, StationRow)
- `code/types/weather.ts` - Target for weather data types (StationData)
- `code/types/index.ts` - Central export file that may need updates
- `code/ali-je-vroce/helpers.ts` - File with import that needs updating

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Analyze existing types and plan transfers
  - [x] 1.1 Read code/ali-je-vroce/types.ts to identify all types to transfer
  - [x] 1.2 Check code/types/api.ts and code/types/weather.ts for existing similar types
  - [x] 1.3 Determine which types need to be moved vs merged vs kept separate
  - [x] 1.4 Identify files that import from types.ts
- [x] 2.0 Move StationsResponse and StationRow to code/types/api.ts
  - [x] 2.1 Copy StationsResponse interface to code/types/api.ts
  - [x] 2.2 Copy StationRow type to code/types/api.ts
  - [x] 2.3 Ensure proper imports in api.ts (e.g., ISODateString from common.js)
- [ ] 3.0 Move StationData to code/types/weather.ts
  - [ ] 3.1 Copy StationData interface to code/types/weather.ts
  - [ ] 3.2 Check for overlaps with existing WeatherStation interface
  - [ ] 3.3 Merge or keep separate based on analysis
- [ ] 4.0 Update import in code/ali-je-vroce/helpers.ts
  - [ ] 4.1 Change import from "./types" to "../types/api"
  - [ ] 4.2 Verify the import works after the move
- [ ] 5.0 Update exports in code/types/index.ts if needed
  - [ ] 5.1 Check if new types are exported through index.ts
  - [ ] 5.2 Add exports for StationsResponse and StationRow if not already covered
  - [ ] 5.3 Add export for StationData if moved to weather.ts
- [ ] 6.0 Remove original code/ali-je-vroce/types.ts file
  - [ ] 6.1 Confirm all types have been successfully moved
  - [ ] 6.2 Delete the types.ts file
- [ ] 7.0 Verify no TypeScript or lint errors
  - [ ] 7.1 Run TypeScript compiler to check for errors
  - [ ] 7.2 Run linter to check for issues
  - [ ] 7.3 Test application functionality to ensure no runtime errors</content>
<parameter name="filePath">/Volumes/SSD-Satechi/Projects/open-source/active-projects/podnebnik/website/tasks/tasks-prd-transfer-types-from-types-ts-to-types-folder.md
