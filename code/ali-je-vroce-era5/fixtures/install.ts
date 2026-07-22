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
// KNOWN GAP: the OpenTopoMap basemap (SeaLevelWidget.tsx:296) and the flood
// overlay PNGs (SeaLevelWidget.tsx:137) are loaded by Leaflet and by
// `new Image()`, which do not route through fetch and so cannot be intercepted
// here. The flood PNGs are same-origin and resolve offline anyway; the basemap
// tiles are external and render blank. See manifest.json `_uncapturable`.
//
// This module is only ever loaded when VITE_FIXTURES=1 (entry.tsx), so it is
// absent from a production bundle.

interface FixtureIndex {
  recorded_at: string;
  primary_date: string;
  counts: { planned: number; recorded: number; failed: number };
  routes: Record<string, string>;
}

const FIXTURE_ROOT = "/fixtures";

export async function installFixtures(): Promise<void> {
  const realFetch = globalThis.fetch.bind(globalThis);

  const indexResp = await realFetch(`${FIXTURE_ROOT}/index.json`);
  if (!indexResp.ok) {
    throw new Error(
      `[fixtures] cannot load ${FIXTURE_ROOT}/index.json (HTTP ${indexResp.status}). ` +
        `Run \`yarn fixtures:record\`, and make sure the server was started with VITE_FIXTURES=1 ` +
        `so eleventy.config.mjs copies tests/fixtures to /fixtures.`,
    );
  }
  const index = (await indexResp.json()) as FixtureIndex;

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
    if (raw.startsWith("/") || (origin && raw.startsWith(origin))) {
      return realFetch(input as RequestInfo, init);
    }

    throw new Error(
      `[fixtures] no recorded response for:\n  ${raw}\n\n` +
        `The offline run only serves URLs captured by \`yarn fixtures:record\`. ` +
        `If this URL is legitimate, add its parameters to tests/fixtures/manifest.json ` +
        `and re-record; if it is new, a code change introduced a network call that T-1.2 ` +
        `did not enumerate.`,
    );
  } as typeof fetch;

  // eslint-disable-next-line no-console
  console.info(
    `[fixtures] offline mode: ${index.counts.recorded} responses recorded ${index.recorded_at}, ` +
      `pinned date ${index.primary_date}`,
  );
}
