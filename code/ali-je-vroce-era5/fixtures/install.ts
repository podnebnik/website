// T-1.2 — offline fixture layer.
//
// Replaces globalThis.fetch with a lookup against the responses recorded by
// `yarn fixtures:record` (tests/fixtures/, served at /fixtures by a conditional
// passthrough in eleventy.config.mjs). With this installed the page contacts no
// external host at all:
//
//   * a recorded URL      → served from /fixtures/http/<file>, same origin
//   * any same-origin URL → passed through (the app's own bundle and assets,
//                           e.g. /data/flood-stats.json, SeaLevelWidget.tsx:312)
//   * anything else       → THROWS, loudly, naming the URL
//
// The throw is the point. A missing fixture must fail visibly, because the
// alternative — an empty chart that looks plausible — is exactly what would
// make the T-1.1 snapshot and the T-1.3 baselines lie.
//
// ...except the throw alone does NOT guarantee visibility. Six call sites catch
// and swallow their own fetch errors: api.ts:257, api.ts:279, api.ts:1059,
// api.ts:1324, api.ts:1352 and components/StationMap.tsx:119. A miss inside any
// of those degrades to an empty section instead of a crash. Those catches are
// pre-existing and belong to T-5.1 (kill silent failures), so this file does not
// touch them; instead every miss is APPENDED TO A MODULE-LEVEL ARRAY BEFORE the
// throw, and exposed as `window.__FIXTURE_MISSES__`. A swallowed throw is then
// still observable from outside the page.
//
//   >>> T-1.1 MUST assert that window.__FIXTURE_MISSES__ is empty after the page
//   >>> has finished rendering. A snapshot taken with a non-empty array is a
//   >>> snapshot of partially-missing data and must not be baselined.
//
// KNOWN GAP: the OpenTopoMap basemap (SeaLevelWidget.tsx:296) and the flood
// overlay PNGs (SeaLevelWidget.tsx:137) are loaded by Leaflet and by
// `new Image()`, which do not route through fetch and so cannot be intercepted
// here. The flood PNGs are same-origin and resolve offline anyway; the basemap
// tiles are external and render blank. See manifest.json `_uncapturable`.
//
// This module is only ever loaded when VITE_FIXTURES=1 (entry.tsx), so it is
// absent from a production bundle.

import { DS_BASE } from "../api.ts";
import { today } from "../clock.ts";

interface FixtureIndex {
  recorded_at: string;
  primary_date: string;
  bases: Record<string, string>;
  counts: { planned: number; recorded: number; failed: number };
  routes: Record<string, string>;
}

export interface FixtureMiss {
  url: string;
  at: string;
}

declare global {
  interface Window {
    __FIXTURE_MISSES__?: FixtureMiss[];
  }
}

const FIXTURE_ROOT = "/fixtures";

/**
 * Every URL the shim refused, in order. Appended to BEFORE the throw, so it
 * records misses even when the caller swallows the exception (see the six catch
 * sites named at the top of this file). T-1.1 asserts this is empty.
 */
export const misses: FixtureMiss[] = [];

/** Trim one trailing slash so `https://host` and `https://host/` compare equal. */
function normaliseBase(base: string): string {
  return base.replace(/\/+$/, "");
}

export async function installFixtures(): Promise<void> {
  const realFetch = globalThis.fetch.bind(globalThis);

  if (typeof window !== "undefined") window.__FIXTURE_MISSES__ = misses;

  const indexResp = await realFetch(`${FIXTURE_ROOT}/index.json`);
  if (!indexResp.ok) {
    throw new Error(
      `[fixtures] cannot load ${FIXTURE_ROOT}/index.json (HTTP ${indexResp.status}). ` +
        `Run \`yarn fixtures:record\`, and make sure the server was started with VITE_FIXTURES=1 ` +
        `so eleventy.config.mjs copies tests/fixtures to /fixtures.`,
    );
  }
  const index = (await indexResp.json()) as FixtureIndex;

  // ── Preconditions. Each of these is a way for the offline run to look healthy
  // while serving something other than what was recorded, so each fails loudly.

  // 1. A partial recording. `routes` only contains what succeeded, so a run with
  //    failures silently degrades to "some URLs are simply not fixtures".
  if (index.counts.failed !== 0) {
    throw new Error(
      `[fixtures] index.json reports ${index.counts.failed} failed request(s) ` +
        `(${index.counts.recorded}/${index.counts.planned} recorded). The failed URLs are absent ` +
        `from \`routes\`, so they would fall through to the network or throw at render time. ` +
        `Re-run \`yarn fixtures:record\` until failed = 0; the failures are listed in ` +
        `tests/fixtures/index.json under \`entries\`.`,
    );
  }

  // 2. The pinned date drifting from the one the matrix was recorded for. The
  //    fixture URLs embed dates; if clock.ts says a different day, the primary
  //    (Open-Meteo) branch requests a URL nobody recorded.
  const clockDate = today();
  if (clockDate !== index.primary_date) {
    throw new Error(
      `[fixtures] pinned date mismatch:\n` +
        `  clock.ts today()      = ${clockDate}\n` +
        `  index.json primary    = ${index.primary_date}\n\n` +
        `The date is single-sourced from tests/fixtures/manifest.json \`primary_date\` and passed ` +
        `to the build by scripts/fixtures/with-pinned-date.mjs (\`yarn fixtures:start\` / ` +
        `\`yarn fixtures:build\`). Getting here means the app was started some other way, or ` +
        `window.__PODNEBNIK_TODAY__ was injected with a date outside the recorded matrix.`,
    );
  }

  // 3. VITE_DATASETTE_URL pointing somewhere other than the base the fixtures
  //    were recorded from. This is a DOCUMENTED local-dev configuration
  //    (CLAUDE.md known traps, T-3.9), so it is a live hazard, not a hypothetical:
  //    every datasette URL would miss the route table and hit the real host.
  const recordedBase = normaliseBase(index.bases?.datasette ?? "");
  const appBase = normaliseBase(DS_BASE);
  if (recordedBase !== appBase) {
    throw new Error(
      `[fixtures] datasette base mismatch:\n` +
        `  app resolves (api.ts:10) = ${appBase}\n` +
        `  fixtures recorded from   = ${recordedBase}\n\n` +
        `Every recorded datasette URL is keyed on the base it was fetched from, so none of them ` +
        `would match and the page would go to the network. Either unset VITE_DATASETTE_URL for ` +
        `the offline run, or set tests/fixtures/manifest.json \`bases.datasette\` to the same ` +
        `host and re-record.`,
    );
  }

  const origin = typeof location !== "undefined" ? location.origin : "";

  function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  }

  globalThis.fetch = async function fixtureFetch(input, init) {
    const raw = requestUrl(input);
    const file = index.routes[raw];
    if (file) return realFetch(`${FIXTURE_ROOT}/http/${file}`, init);

    // Same-origin: the app's own assets, not network in any meaningful sense.
    // `//host/path` is protocol-relative and goes to ANOTHER host despite the
    // leading slash, so root-relative has to be checked as "/ but not //".
    const rootRelative = raw.startsWith("/") && !raw.startsWith("//");
    if (rootRelative || (origin && raw.startsWith(origin))) {
      return realFetch(input as RequestInfo, init);
    }

    misses.push({ url: raw, at: new Date().toISOString() });

    throw new Error(
      `[fixtures] no recorded response for:\n  ${raw}\n\n` +
        `The offline run only serves URLs captured by \`yarn fixtures:record\`. ` +
        `If this URL is legitimate, add its parameters to tests/fixtures/manifest.json ` +
        `and re-record; if it is new, a code change introduced a network call that T-1.2 ` +
        `did not enumerate.\n` +
        `(Also recorded in window.__FIXTURE_MISSES__, in case this throw is swallowed.)`,
    );
  } as typeof fetch;

  // eslint-disable-next-line no-console
  console.info(
    `[fixtures] offline mode: ${index.counts.recorded} responses recorded ${index.recorded_at}, ` +
      `pinned date ${index.primary_date}, datasette ${appBase}`,
  );
}
