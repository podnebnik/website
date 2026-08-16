# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Website (Node / yarn 4 via corepack)

```bash
yarn install                 # postinstall runs `dotnet tool restore` (Fable)
yarn start                   # Fable watch + 11ty --serve on http://127.0.0.1:8080/
yarn build                   # Fable compile + 11ty build into dist/
yarn clean                   # rm -rf dist && dotnet fable clean

yarn typecheck               # tsc --noEmit (currently exits 0)
yarn typecheck:gate          # what CI runs — see "Typecheck gate" below
yarn test                    # vitest run, tests/unit/**/*.test.ts, offline
yarn test tests/unit/doy.test.ts          # single file
yarn test -t "some test name"             # single test by name

yarn snapshot:check          # diff rendered ERA5 page vs tests/fixtures/snapshot.json (CI)
yarn snapshot:write          # rewrite the baseline (never implied — must be explicit)
yarn snapshot:verify         # self-contained clock-independence + determinism proof

yarn fixtures:record         # re-record tests/fixtures/http/ from the live network
yarn fixtures:start          # dev server pinned to the fixture date, offline
yarn fixtures:build          # build into dist-fixtures/ (never dist/)
```

`ELEVENTY_EMULATE_PRODUCTION=1` makes dev behave like a production build (notably: `draft: true`
pages are dropped). `ELEVENTY_DISABLE_IMG=1` swaps the sharp-backed `image` shortcode for a
placeholder — useful when the local `sharp` native build is broken (it commonly is without
libvips; CI installs `libvips-dev`).

### Data (Python / uv)

```bash
uv run invoke validate                    # frictionless-validate every datapackage
uv run invoke create-databases            # build var/sqlite/*.db + datasette metadata
uv run invoke datasette                   # serve them on :8010
uv run frictionless validate data/<pkg>/datapackage.yaml

cd data/climate-si/sources
uv run pytest                             # pipeline test suite (CI: data-checks job)
uv run pytest tests/test_precompute.py::test_name
```

The climate-si pipeline itself is run by the datasette image build, not by hand:
`precompute_datasette.py` (needs `DATA_DIR=data/climate-si/data/raw`) then
`export_datasette_csv.py`. Pin `OMP_NUM_THREADS=1` etc. — multi-threaded BLAS makes the
tropical negative-binomial fit non-reproducible run-to-run.

### Docker (content/data authoring without a local toolchain)

```bash
docker-compose -f compose.yaml build base    # MUST be built first, on its own
docker-compose -f compose.yaml build
docker-compose -f compose.yaml up            # website :8003, datasette :8001
```

## Architecture

### Two independent artifacts

The repo ships **two Docker images that build and deploy separately**, and this split drives
most debugging decisions:

1. **website** (`deployment/Dockerfile.website`) — the static 11ty/Vite build. Frontend bugs.
2. **datasette** (`deployment/Dockerfile.datasette`) — SQLite generated from the data packages.
   Wrong *numbers* live here.

The frontend computes no climate statistics. Every displayed number follows
`Solid component → api.ts fetch → datasette table → precompute step → raw CSV`. Query the
datasette URL directly to decide which half is at fault. `docs/ops-runbook.md` is the
authoritative guide for this — read it before debugging a suspicious number.

### How the website reaches the datasette

**There is no server-side connection.** The website image is static nginx (no proxy_pass, no
upstream); all datasette access happens in the visitor's browser as cross-origin fetches,
allowed by datasette's `--cors` flag. The base URL is baked into the JS bundle at build time:

- ERA5 island: `VITE_DATASETTE_URL ?? "https://stage-data.podnebnik.org"` (`api.ts`) — the
  env var is a build-time Vite substitution, so changing it requires a rebuild/restart.
- Legacy and temperatura islands: `https://stage-data.podnebnik.org` **hardcoded**
  (`code/ali-je-vroce/constants.ts`, `code/temperatura/heatmaps.jsx`) — they ignore the env var.

The production build sets no `VITE_DATASETTE_URL`, so **prod (podnebnik.org) also queries the
stage datasette**; no prod-data URL exists in this repo. The compose setup does *not* wire the
two containers together — both just publish host ports (website :8003, datasette :8001), and
the browser still hits stage-data unless you rebuild with `VITE_DATASETTE_URL` pointed at the
local datasette. This repo builds and pushes the datasette image, but the manifests serving
`stage-data.podnebnik.org` live in the infrastructure repo.

### Static site

11ty (input `pages/`, output `dist/`) with `@11ty/eleventy-plugin-vite`, so Vite handles the
asset graph. Templating is Liquid; `code/`, `styles/`, `assets/`, `public/` are passthrough-copied.
`eleventy.config.mjs` amends Eleventy's markdown-it with `markdown-it-footnote` and
`markdown-it-attrs` (explicit `{#id}` heading anchors — the glossary/methodology cross-links
depend on exact ASCII keys, which a slugifier would break on Slovenian text).

Pages are content; interactivity is **islands**: a page drops a `<div id>` plus a
`<script type="module">` that imports an entry under `code/`. Two islands exist:

| URL | Island | Data source |
|---|---|---|
| `/` | `code/ali-je-vroce/` (legacy) | `temperature` datasette, uses `?_where=` |
| `/ali-je-vroce/` | `code/ali-je-vroce-era5/` | `climate-si` datasette + Open-Meteo |

The README still calls the ERA5 page `/ali-je-vroce-era5/`; that is stale — it serves at
`/ali-je-vroce/`. The legacy island is the reason `temperature` still allows arbitrary SQL
while `climate-si` and `emissions` are locked down (`allow_sql: false`, set in `tasks.py`).

F# components compile through Fable to `.fs.jsx` next to their sources (`code/Components.fsproj`,
`code/examples/fable.*`); `yarn start`/`build` chain Fable ahead of 11ty for this reason.

### Data packages

Frictionless Data packages under `data/` (`emissions`, `temperature`, `temperature-extra`,
`climate-si`). `tasks.py create_databases` turns each `datapackage.yaml` into one SQLite DB
plus datasette metadata (titles, units, licences derived from the descriptor).

**climate-si is different**: its nine derived tables are *not committed*. Only the raw
per-station CSVs (`data/climate-si/data/raw/`) are in git; the tables are generated at
datasette image-build time, and `precompute_datasette.py` runs pandera validation in memory
*before writing*, so a broken pipeline fails the image build rather than publishing bad data.
`validate-data.yaml` therefore skips climate-si (nothing to load in a clean checkout) and
validates the raw inputs separately.

### ERA5 island internals (`code/ali-je-vroce-era5/`)

SolidJS + TanStack Solid Query + Highcharts, mounted from `entry.tsx`. Charts are lazy /
dynamically imported. `api.ts` is the single fetch layer; datasette base URL is baked in at
build time (`VITE_DATASETTE_URL`, default `https://stage-data.podnebnik.org`). Slovenian copy
and number/date formatting go through `i18n/`.

Deeper references: `docs/data-fetching-strategy.md` (TanStack Query keys, caching,
prefetching), `docs/typescript-migration-guidelines.md` (strictness settings and JS→TS
conversion patterns), `docs/ops-runbook.md` (number-tracing and rollback).
`node dev-proxy.mjs` is a standalone CORS proxy (`/api/*` → `TARGET`, default
podnebnik.vremenar.app) for pointing the legacy island at a remote API during dev.

## Known traps

- **A wrong datasette *filter* column fails silently.** `?col__exact=` with an unknown column
  returns HTTP 200 and an empty result (SQLite DQS quirk), blanking a section instead of
  erroring. `code/ali-je-vroce-era5/generated/datasette-schema.ts` is codegen'd from
  `data/climate-si/datapackage.yaml` (`generate_frontend_schema.py`) and the `*Col` unions in
  `api.ts` pin both `_col=` projections and filter names, so a rename becomes a typecheck
  error. Keep it that way — do not inline bare column strings.
- **Request URLs are fixture keys.** The ~2,040 recorded fixtures are keyed on the exact URL,
  including `_col=` order and literal `_size=` values. Reordering columns "to match
  datapackage" silently misses every fixture.
- **Solid's `style()` calls `setProperty()`** — camelCase keys are dropped without warning.
  Always write kebab-case style keys.
- **Moving a published number requires updating `tests/fixtures/snapshot.json` in the same
  commit, with the reason stated.** The snapshot job exists to make that deliberate.
  `yarn snapshot:*` pins `TZ=UTC` and `LANG`/`LC_ALL` and re-asserts them internally, so a
  machine with different settings fails loudly instead of producing a spurious diff.
- **Reanalysis lags real time by ~2 weeks.** When `daily` has no row for today, `api.ts` falls
  back to a live Open-Meteo *forecast*, labelled "napoved". Check this first when only the most
  recent day looks wrong. Historical aggregation is still on UTC day boundaries, not
  Europe/Ljubljana — small boundary discrepancies are expected, not bugs.
- **ERA5-Land values are modelled, elevation-corrected reanalysis.** "Does not match ARSO" is
  by design; the bug bar is "does not match what our own pipeline produced".
- `draft: true` pages are dropped in build mode and under `ELEVENTY_EMULATE_PRODUCTION=1`, so
  they 404 in production — several pages using footnote/attrs markdown syntax are draft-only.
- Code comments reference `PROGRESS.md` and `DECISIONS.md` and carry `T-x.y` / `D-n` ticket
  IDs. Those files are not in this repository; treat the IDs as provenance markers only.

## GitHub workflows

**`build.yaml`** — the PR gate. Four independent jobs, each failing for a different reason:
`build` (11ty/Fable bundle), `snapshot` (a published number moved), `checks`
(`yarn typecheck:gate` + `yarn test`), `data-checks` (`uv run pytest` in
`data/climate-si/sources`). The typecheck gate (`scripts/typecheck-gate.mjs`) asserts the live
`tsc` error set is *exactly* `tests/typecheck-allowlist.txt`, keyed by file/line/column/code.
The allowlist is currently empty, so any TypeScript error fails the build — and an entry
disappearing would fail too. If a dependency bump reintroduces an unfixable typings mismatch,
add it there in the same commit with the reasoning; never replace the gate with a bare
`yarn typecheck`.

**`docker-web.yaml`** — builds/pushes the multi-arch website image to `ghcr.io/podnebnik/website`
on pushes to `main` and version tags (PRs build without pushing). The deployable tag format is
`main-<short-sha>-<timestamp>`. Both docker workflows `paths-ignore: deploy/**` — argocd-image-updater
commits tags back into `deploy/`, and without the ignore that write-back would retrigger builds
forever.

**`docker-data.yaml`** — the datasette image, in two jobs: `generate-db` builds only the
`db-export` Dockerfile target on amd64, exporting the generated SQLite as an artifact; the
multi-arch image build then COPYs it in. Never reintroduce per-platform generation — the
numpy pipeline under QEMU arm64 ran for hours.

**`docker-preview.yaml`** — fires only for PRs labeled `preview-deploy` (see PR labels);
pushes every image as `pr-<number>` for the infrastructure repo's preview environments.

**`validate-data.yaml`** — frictionless-validates data packages on `data/**` changes.
climate-si's *derived* tables are skipped (not committed; validated at image build), but its
committed *raw* CSVs are checked via `.github/actions/validate-raw-data`.

**`data-refresh.yaml`** — daily cron (01:17 UTC) that differentially fetches raw ERA5-Land
CSVs from Open-Meteo, validates end-to-end **in-job**, and opens a `data-refresh`-labeled PR;
it never pushes to `main`. In-job validation is load-bearing: PRs opened with `GITHUB_TOKEN`
do **not** trigger `on: pull_request` workflows, so the refresh PR carries no automated checks
by design. Manual dispatch requires typing `spend-quota`; failures open/comment a
`refresh-failure` issue. Note: `docs/ops-runbook.md` §5/§7 still describe this schedule as
disabled — that is stale; the workflow header documents when and why it was enabled.

**`workflows-lint.yaml`** — zizmor security analysis of the workflow files themselves, on
workflow changes and a monthly cron. All workflows pin actions by commit SHA and set
least-privilege `permissions:` — keep both properties when editing.

## PR labels

Three labels are **functional** — they drive automation, not just triage:

- `preview-deploy` — labeling a PR triggers `.github/workflows/docker-preview.yaml`, which
  builds and pushes **every** preview image (no paths filter) as
  `ghcr.io/podnebnik/<image>:pr-<number>`; the infrastructure repo's preview ApplicationSet
  deploys labeled PRs from those tags. Fork PRs are excluded (no `packages: write` token).
- `data-refresh` — applied by `data-refresh.yaml` to its automated raw ERA5-Land refresh PRs.
  Marks automation output; don't apply it by hand.
- `refresh-failure` — dedupe key for the automated "data refresh failed" alert *issues*
  (created on demand by `.github/actions/ensure-label`); one open issue collects repeat
  failures instead of a new issue per failure.

Ecosystem labels (`dependencies`, `javascript`, `python`, `python:uv`, `github_actions`,
`docker`, `.NET`, `devcontainers_package_manager`) are applied by Dependabot to its own PRs.
The rest are manual triage: project topics `content`, `data`, `design`, `typescript`
(TypeScript migration) plus the GitHub defaults (`bug`, `documentation`, `enhancement`,
`duplicate`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`).

## Deployment

Helm chart in `deploy/chart/`. Stage is bumped automatically by argocd-image-updater writing into
`values-stage.yaml` (hence `paths-ignore: deploy/**` in the build workflow). **Prod is pinned by
hand** — promote or roll back by editing the tag in `values-prod.yaml` via a PR. Never push
directly to `main`; never force-push.
