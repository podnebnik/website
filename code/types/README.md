# Types refactor — raw API shapes vs processed UI models

This folder now separates two concerns:

- `api-raw.ts` — canonical raw shapes returned by external services (Datasette, Vremenar). Use these for runtime validation and parsing.
- `models.ts` — processed / UI-friendly types derived from the raw shapes. Use these for component props, query results and app logic.

Why this change

- Previously `code/types/api.ts` mixed raw API rows and processed UI types, which caused duplication and confusing imports.
- Splitting raw vs processed types clarifies intent and reduces duplicate declarations.

Files added

- `code/types/api-raw.ts` — raw Datasette / Vremenar response types
- `code/types/models.ts` — processed / UI types (stations, percentiles, chart types)

Files updated

- `code/types/api.ts` — now a lightweight compatibility wrapper re-exporting `api-raw` and `models`
- `code/types/index.ts` — re-exports `api-raw` and `models` explicitly (prefer direct imports)
- `code/types/guards.ts` — validates raw shapes from `api-raw.ts` and references processed types from `models.ts`
- `code/types/components.ts`, `code/types/weather.ts`, `code/types/queries.ts` — updated to import canonical models
- `code/ali-je-vroce/*` (helpers, hooks, utils) — migrated imports to the canonical modules

Migration guidance

- Import raw API responses from: `/code/types/api-raw.js`
  - e.g. `import type { DatasetteResponse, TemperatureStationRow } from '/code/types/api-raw.js'`
- Import processed/UI types from: `/code/types/models.js`
  - e.g. `import type { ProcessedStation, ProcessedTemperatureData } from '/code/types/models.js'`
- Prefer explicit imports rather than `import { ... } from '/code/types'` when the semantic layer matters.

Validation

- Run the TypeScript check after edits:

```bash
yarn tsc --noEmit
```

Next steps (suggested)

1. Run a repo-wide sweep to replace remaining barrel imports with canonical imports (optional codemod).
2. When the sweep is complete, remove compatibility aliases from `code/types/api.ts` and `code/types/index.ts`.
3. Add small unit tests for guards and transformation helpers (low-risk improvements).

If you'd like, I can run the final codemod sweep and/or push a PR with the committed changes and a short PR description for reviewers.
