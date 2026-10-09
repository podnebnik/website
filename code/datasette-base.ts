// Environment-aware datasette base URL — the ONE resolver shared by every island
// that fetches from datasette (ali-je-vroce-era5/api.ts, ali-je-vroce/constants.ts,
// temperatura/heatmaps.jsx).
//
// Precedence (first match wins):
//
//   1. VITE_DATASETTE_URL (build-time) — explicit override. Used by docker compose
//      (http://127.0.0.1:8001), manual dev against `invoke datasette`
//      (http://127.0.0.1:8010), and the preview-image build in
//      .github/workflows/docker-preview.yaml (`/data` when the PR ships its own
//      datasette, stage-data otherwise). An empty string means "not set".
//   2. VITE_FIXTURES === "1" — the offline fixture runs. The ~2,090 recorded
//      fixtures in tests/fixtures/index.json are keyed on absolute URLs under the
//      base recorded in `bases.datasette`, and fixtures/install.ts refuses to
//      install on any other base, so fixture mode always resolves to that base.
//   3. Deployed hosts — same-origin `/data`. The infrastructure serves each
//      environment's own datasette under its website host
//      (podnebnik.org/data → data.podnebnik.org's datasette,
//      stage.podnebnik.org/data → stage-data's), so one promoted image reaches the
//      right data in both environments with no CORS involved. The allowlist is
//      deliberate: unknown hosts (localhost, jsdom, previews without the build-arg)
//      must fall through to the stage default, not guess at a /data route.
//   4. Everything else — the stage datasette, as before this resolver existed.
//
// IMPORTANT: the env reads below must stay written as the full literal member
// expressions `import.meta.env.VITE_DATASETTE_URL` / `import.meta.env.VITE_FIXTURES`.
// tests/snapshot/vite.config.mjs's `define` block textually replaces exactly those
// tokens so the snapshot bundle is a function of the repo alone; hoisting
// `import.meta.env` into a variable would evade the replacement and leak the
// developer's shell environment into the snapshot.

const STAGE_BASE = "https://stage-data.podnebnik.org";

/** Hosts whose gateway serves their own datasette under the /data path prefix. */
const SAME_ORIGIN_DATA_HOSTS = new Set(["podnebnik.org", "stage.podnebnik.org"]);

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveDatasetteBase(): string {
  const override = import.meta.env.VITE_DATASETTE_URL;
  if (override) return stripTrailingSlash(override);

  if (import.meta.env.VITE_FIXTURES === "1") return STAGE_BASE;

  if (typeof location !== "undefined" && SAME_ORIGIN_DATA_HOSTS.has(location.hostname)) {
    return `${location.origin}/data`;
  }

  return STAGE_BASE;
}

/** The resolved datasette base for this page load. No trailing slash. */
export const DATASETTE_BASE_URL = resolveDatasetteBase();
