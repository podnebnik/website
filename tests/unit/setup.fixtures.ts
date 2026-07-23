/// <reference types="node" />
// T-3.3 — Vitest setup: install the T-1.2 offline fixture shim, reused as-is.
//
// The reference above is load-bearing: this project does not auto-include
// @types/node (no type-checked source touches Node built-ins — everything that
// does is a .mjs excluded from tsc), so `node:fs/promises` et al. would not
// resolve without it. Scoped to this file rather than tsconfig's `types` so the
// rest of the compilation keeps its deliberately minimal ambient surface
// (see code/ali-je-vroce-era5/vite-env.d.ts for the same philosophy).
//
// installFixtures() (code/ali-je-vroce-era5/fixtures/install.ts) captures
// whatever globalThis.fetch is at call time as its `realFetch`, then serves the
// recorded datasette / Open-Meteo responses from tests/fixtures/ and THROWS on
// anything unrecorded. In the browser that realFetch talks to the eleventy dev
// server serving /fixtures; under Node there is no server, so here realFetch
// reads tests/fixtures/ off disk instead. That filesystem reader is the only new
// code — the routing, the miss-throwing and the preconditions are the shim's.
//
// Net effect: no test reaches the network. A /fixtures/* path is read from disk;
// a recorded route resolves through the shim; anything else throws.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { installFixtures } from "../../code/ali-je-vroce-era5/fixtures/install.ts";

// Anchored on the working directory (repo root under `yarn test`) rather than
// import.meta.url: T-3.4's doy suite runs under the jsdom environment (it imports
// AliJeVroceERA5.tsx, whose Solid JSX transform needs a DOM), and there Vitest
// rewrites import.meta.url to a non-file URL that fileURLToPath() rejects. The
// working directory is stable across the node and jsdom environments.
const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures");

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

// realFetch for the shim: serve /fixtures/<path> from disk, refuse everything
// else. installFixtures() layers the recorded-route table on top of this.
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = requestUrl(input);
  if (url.startsWith("/fixtures/")) {
    const rel = url.slice("/fixtures/".length);
    const body = await readFile(join(FIXTURE_DIR, rel), "utf8");
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  throw new Error(`[test] offline: refusing network fetch to ${url}`);
}) as typeof fetch;

await installFixtures();
