# Ops runbook — "Ali je vroče" (ERA5 climate page)

This is the on-call guide for the interactive climate page at
`code/ali-je-vroce-era5/`. It is written for whoever is responding when a number
on that page looks wrong, not for the people who built it. Everything you need is
here or in the repository; you do not need any other document to act.

## 1. What this page is — and what its numbers are NOT

The page shows temperatures and heat statistics derived from **ERA5-Land
reanalysis** — a modelled, grid-based reconstruction of the weather, not direct
thermometer readings. A value on this page is the reanalysis estimate for a grid
cell, elevation-corrected to a station's real height; it will not match an ARSO
measured observation exactly, and it is not meant to. Before you treat a
discrepancy as a bug, remember that "does not equal the ARSO number" is expected
by design — the bug bar is "does not equal what our own pipeline produced."

## 2. "A number looks wrong" — how to find where it comes from

Every displayed number follows the same chain:

```
Solid component  →  api.ts fetch  →  datasette table  →  precompute step  →  raw CSV / constant
```

The frontend never computes climate numbers. It fetches them from a **datasette**
HTTP API and renders them. The datasette base URL is baked into the bundle at
build time and defaults to `https://stage-data.podnebnik.org`
(`code/ali-je-vroce-era5/api.ts:19`); the tables live under
`https://stage-data.podnebnik.org/climate-si/`. That URL is your primary
diagnostic tool: you can request any table directly in a browser and compare it
with the page.

The datasette tables themselves are **not committed** to the repo. They are built
from the raw per-station CSVs in `data/climate-si/data/raw/<Station>.csv` by
`data/climate-si/sources/precompute_datasette.py` when the datasette Docker image
is built. So a number's true origin is always a raw CSV plus a transformation in
that Python file.

Two worked examples follow. Trace any other number the same way.

### Example A — the today-card headline temperature

The big "today" temperature (e.g. the gauge and heading).

1. **Component.** `code/ali-je-vroce-era5/charts/TodayGauge.tsx:120` renders
   `props.data.today_temp`; the same value also appears in the section heading
   (`AliJeVroceERA5.tsx:123`).
2. **Fetch.** `fetchTodayStatus` in `code/ali-je-vroce-era5/api.ts:361`. For a
   single station it requests (`api.ts:407`):

   ```
   https://stage-data.podnebnik.org/climate-si/daily.json?_shape=array&era5_name__exact=Ljubljana&date__exact=2026-07-28&_col=temperature_max_2m&_size=1
   ```

   For the national view it averages one row per station
   (`api.ts:370`). If the datasette has **no row for that date** (the reanalysis
   lags real time by roughly two weeks), the code falls back to a live Open-Meteo
   **forecast** and flags the value as preliminary (`api.ts:416`). A preliminary
   value is labelled "napoved" on the page and is not reanalysis at all — check
   this first if only the most recent day looks off.
3. **Table.** datasette table `daily`, column `temperature_max_2m`.
4. **Precompute.** `build_daily` in
   `data/climate-si/sources/precompute_datasette.py:249`; the column is set at
   `:258` from `temperature_max_corr`, rounded to 3 decimals.
5. **Constant / raw.** `temperature_max_corr` is computed in `load_all`
   (`precompute_datasette.py:185`) as the raw `temperature_max` plus an elevation
   correction `elevation_diff_m * LAPSE_RATE`, where `LAPSE_RATE = 0.0065`
   (°C per metre, `precompute_datasette.py:68`). Both `temperature_max` and
   `elevation_diff_m` come straight from the station's raw CSV.

### Example B — the tropical-day count

The per-year "tropical / hot day" counts in the tropical chart.

1. **Component.** `code/ali-je-vroce-era5/charts/Era5TropicalChart.tsx:49`,
   mounted in `AliJeVroceERA5.tsx:306`. The default is **days above 30 °C, run
   length 1** (`daysThr` starts at 30, `AliJeVroceERA5.tsx:235`; `streak` at 1,
   `:237`). The sliders let a reader change the threshold (25–35 °C) and run
   length.
2. **Fetch.** `fetchEra5Tropical` in `code/ali-je-vroce-era5/api.ts:592`
   requests (`api.ts:603`):

   ```
   https://stage-data.podnebnik.org/climate-si/tropical.json?_shape=array&era5_name__exact=Ljubljana&kind__exact=days&threshold__exact=30&streak__exact=1&_size=1
   ```

   and reads the per-year array from column `counts_json` (`api.ts:610`).
3. **Table.** datasette table `tropical`, column `counts_json`.
4. **Precompute.** `build_tropical` in `precompute_datasette.py:638`. For each
   year the count is the number of days whose corrected temperature is strictly
   **greater than** the threshold (`vals > threshold`,
   `precompute_datasette.py:660`), summed per year (`:663`). The grid of
   thresholds and the source column live in `TROPICAL_GRID`
   (`precompute_datasette.py:567`); "days" uses the same `temperature_max_corr`
   as Example A.
5. **Constant.** The comparison is deliberately strict `>` (a day exactly at the
   threshold does **not** count; the page labels say "nad"/"preseže", i.e.
   above/exceeds). If someone changes it to `>=`, every boundary-day count moves.
   The input feeding it is the same lapse-corrected raw temperature as Example A.

## 3. Data problem or display problem?

Once you have the trace, decide which half is wrong by querying the datasette
directly (paste the fetch URL from step 2 into a browser):

- **The datasette value is already wrong** → it is a **data / pipeline** problem.
  The bad number is in a raw CSV or in a precompute transformation. Fixing it
  means changing data or Python and rebuilding the datasette image (section 4,
  "bad number").
- **The datasette value is correct but the page shows something else** → it is a
  **display / frontend** problem. The bug is in the Solid component or in
  `api.ts` (wrong query params, wrong averaging, unit/rounding, the preliminary
  fallback firing when it should not). Fixing it means changing TypeScript and
  rebuilding the website image (section 4, "bad code").

This split matters because the two halves ship as **two different Docker images**
that rebuild and deploy independently.

## 4. Rollback

### Rolling back a bad number (data / pipeline)

The datasette tables are generated at image-build time from the raw CSVs, so you
do **not** edit a table. You revert whatever changed the input and let the image
rebuild.

1. Find the commit that introduced the bad data — almost always an append to
   `data/climate-si/data/raw/*.csv`, or a change under
   `data/climate-si/sources/`:

   ```bash
   git log --oneline -- data/climate-si/data/raw/ data/climate-si/sources/
   ```

2. Revert it on a branch and open a PR to `main`:

   ```bash
   git switch -c revert-bad-data
   git revert <bad-commit-sha>
   git push -u origin revert-bad-data
   ```

3. Merging to `main` triggers `.github/workflows/docker-data.yaml` (it watches
   `data/**` and the Python sources). That workflow rebuilds the datasette image:
   a single amd64 job generates the SQLite and **validates every table in memory
   before writing** — a broken pipeline fails the build instead of publishing bad
   tables (`deployment/Dockerfile.datasette:66`; the validation runs before the
   first write in `precompute_datasette.py`). Then a multi-arch image is pushed.
   Budget **roughly 15 minutes** for the datasette image build.

The datasette that serves `stage-data.podnebnik.org` runs from that image. This
repository builds and pushes the image but does **not** contain the manifests
that deploy it — those live in the infrastructure repo / cluster. If the rebuilt
image does not appear to be serving after it has been pushed, that is a
cluster-side rollout, and you need someone with cluster access to roll the
datasette deployment. *(Inference: `deploy/chart/` here references only the
website image; no datasette deployment manifest exists in this repo.)*

### Rolling back a bad code change (display / frontend)

The website is a static image built by `.github/workflows/docker-web.yaml` and
`.github/workflows/build.yaml`.

- **Fastest, if a known-good image tag exists.** Deployment is driven by the
  Helm chart in `deploy/chart/`. **Stage** is bumped automatically to the newest
  build by argocd-image-updater, which writes the tag into
  `deploy/chart/values-stage.yaml`. **Prod is pinned by hand**: promote or roll
  back by editing the tag in `deploy/chart/values-prod.yaml:5` to a tag that
  already proved itself on stage, and open a PR. Reverting prod to the previous
  good build is exactly this one-line edit.

  ```bash
  # deploy/chart/values-prod.yaml
  image:
    tag: main-<good-sha>-<timestamp>   # set to a known-good build
  ```

- **If you must revert the source.** Revert the offending commit on a branch,
  PR to `main`; the merge rebuilds and pushes a new website image (multi-arch;
  budget **roughly 10–15 minutes**), and stage picks it up automatically. Then
  promote that tag to prod as above.

Do not force-push, and never push directly to `main`.

## 5. The weekly-refresh alert fired

There is a workflow, `.github/workflows/data-refresh.yaml`, that can fetch fresh
raw data and open a PR. **Its weekly schedule is currently disabled** (commented
out) and it has never run automatically — see section 7. It can only be started
by hand, and only by typing a confirmation string. If you get a GitHub issue
titled **"Weekly data refresh failed"**, it came from that workflow's failure
alert. Here is how to read and clear it.

- **What the issue means.** The refresh validates the data *inside the job* and
  opens a PR only if validation passes, so a failure opens no PR. Without this
  alert, a failed refresh would look identical to a quiet, healthy week — the
  alert exists precisely to make that failure visible. The issue names the failed
  step and links the run log. Read the log first.

- **Was raw data written anywhere?** The issue body tells you, but the rule is
  simple: **only the very last step pushes a branch.** Every earlier failure
  (fetch, validation, scope check) leaves changes only in the throwaway CI
  runner, which is discarded — **nothing reaches the repository.** The one
  exception is a failure *after* the push: then a branch named
  `data-refresh/<date>-<runid>` exists on origin with the raw commit but no PR.

- **Cleaning up an orphan pushed branch.** If the issue says a branch was pushed
  but no PR opened, inspect it, and delete it if you do not want it:

  ```bash
  git push origin --delete data-refresh/<date>-<runid>
  ```

- **Was quota spent?** The fetch step calls Open-Meteo and consumes free-tier
  quota. If the run got past the fetch step (i.e. the failure was in validation
  or later), assume the fetch quota for that run was spent. A run that aborted at
  the confirmation guard fetched nothing.

- **How to retry.** Fix the cause, then re-dispatch the workflow from the Actions
  UI, typing the confirmation string it asks for. A fresh differential run is
  safe — it re-fetches only the missing recent days. Do **not** try to force a
  full re-fetch.

## 6. The number is wrong and nobody knows why

You will sometimes have a clearly wrong number and no quick explanation. Do not
keep a wrong number on a public page while you investigate, and do not invent a
correction you cannot justify.

**Removing a section, or replacing it with an honest caveat, is an acceptable
outcome — not a failure.** There is direct precedent in this project: a sea-level
projection widget was cut from the first public version rather than shipped with a
disclaimer, because its underlying numbers could not be defended. The same
judgement applies here. A page that is silent about something is better than a
page that is confidently wrong about it.

Concretely, each section of the page is a mounted component in
`code/ali-je-vroce-era5/AliJeVroceERA5.tsx`. To pull a suspect section while you
investigate, remove its mount there (or gate it) and ship a website-image rebuild
(section 4, "bad code") — this needs **no data change and no datasette rebuild**.
Removing a section is a frontend-only, fast, and fully reversible action.

## 7. Known limitations to know before you debug

Two things are true of the current state and will save you from chasing
non-bugs:

- **The historical aggregation is still in UTC.** Daily values are aggregated on
  UTC day boundaries, not Europe/Ljubljana local days. A conversion to local
  time is planned but has not been applied to the historical record yet. Small
  day-boundary discrepancies against a locally-aggregated source are expected and
  are **not** the bug you are looking for.

- **The weekly refresh workflow exists but is disabled and has never run.** Its
  schedule is commented out and it requires an explicit typed confirmation to
  start by hand. So the committed raw data is static — it does not change on its
  own. If data looks stale, that is why; it is not a broken refresh.

## Appendix — dependency-vulnerability (Dependabot) alerts

As of 2026-07-28 the repository has **0 open** Dependabot alerts (verified with
the command below). A batch of vulnerabilities — including one critical — was
patched earlier and shows as `fixed`.

**Standing procedure for future alerts:**

1. Check the current open count (needs a token with `repo` scope):

   ```bash
   gh api --paginate "/repos/podnebnik/website/dependabot/alerts?state=open&per_page=100" \
     --jq '.[] | {sev: .security_advisory.severity, pkg: .dependency.package.name, ghsa: .security_advisory.ghsa_id}'
   ```

   (The GitHub Security tab shows the same list.)

2. **Do not launch or leave a release out with an unaddressed critical or high.**
   Patch it by bumping the affected dependency, or, for a transitive dependency
   whose version range you do not own, pin it via a `resolutions` entry in
   `package.json` — bumping a direct dependency will not always move a transitive
   one.

3. After merging a fix, **re-run the count above** and confirm it dropped. A fix
   is not done until the alert closes; the alert count going to zero is the proof,
   not the merge.
