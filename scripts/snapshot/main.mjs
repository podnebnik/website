#!/usr/bin/env node
// T-1.1 — snapshot harness runner. Invoked by scripts/snapshot/run.mjs, which
// pins TZ and locale before Node starts; do not run this file directly.
//
// Order of operations, and why:
//
//   1. Assert the pinned environment actually took effect.
//   2. Assert the section set (tests/snapshot/sections.json) against
//      AliJeVroceERA5.tsx, BEFORE doing any work — a new unclassified section
//      should fail in a second, not after a two-minute render.
//   3. Serve tests/fixtures over loopback, so the app's own shim
//      (code/ali-je-vroce-era5/fixtures/install.ts) can be used unmodified
//      rather than reimplemented for Node.
//   4. Build the harness bundle (tests/snapshot/vite.config.mjs).
//   5. Install jsdom globals, and the fake clock if asked.
//   6. Import the bundle and run it.
//   7. Write the snapshot.

import { createServer } from "node:http";
import { readFile, readFileSync, writeFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE_DIR = join(ROOT, "tests", "fixtures");
const BUILD_DIR = join(ROOT, ".snapshot-build");
const PAGE_SRC = join(ROOT, "code", "ali-je-vroce-era5", "AliJeVroceERA5.tsx");
const SECTIONS = join(ROOT, "tests", "snapshot", "sections.json");
const DEFAULT_OUT = join(FIXTURE_DIR, "snapshot.json");

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

// ── args ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const OUT = arg("--out") ?? DEFAULT_OUT;
const SIMULATE_DATE = arg("--simulate-date");
const PROBE = argv.includes("--probe-fixture-gaps");

// ── 1. environment ────────────────────────────────────────────────────────────

const EXPECTED = {
  timezone: "UTC",
  locale: "en-US",
};

{
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const numLocale = new Intl.NumberFormat().resolvedOptions().locale;
  if (tz !== EXPECTED.timezone || numLocale !== EXPECTED.locale) {
    die(
      `[snapshot] the pinned environment did not take effect:\n` +
        `  timezone : ${tz} (expected ${EXPECTED.timezone})\n` +
        `  locale   : ${numLocale} (expected ${EXPECTED.locale})\n\n` +
        `Both are baked into rendered output — the timezone through date parsing in api.ts, ` +
        `the locale through toLocaleString() sample counts (TodayCard.tsx:170,225). A snapshot ` +
        `taken under different settings is not comparable with the committed one.\n` +
        `Run via \`yarn snapshot\` (scripts/snapshot/run.mjs), not this file directly. If you ` +
        `did, this Node build's ICU may lack full locale data.`,
    );
  }
}

// ── 2. section-set assertion ──────────────────────────────────────────────────

function assertSections() {
  const src = readFileSync(PAGE_SRC, "utf8");
  const sections = JSON.parse(readFileSync(SECTIONS, "utf8"));

  const found = new Set();
  for (const m of src.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)) found.add(m[1]);

  const classified = new Map();
  for (const bucket of ["covered", "structural", "excluded"]) {
    for (const name of Object.keys(sections[bucket] ?? {})) {
      if (classified.has(name)) {
        die(
          `[snapshot] tests/snapshot/sections.json classifies "${name}" in both ` +
            `"${classified.get(name)}" and "${bucket}". Each tag belongs in exactly one bucket.`,
        );
      }
      classified.set(name, bucket);
    }
  }

  const unclassified = [...found].filter((n) => !classified.has(n)).sort();
  const stale = [...classified.keys()].filter((n) => !found.has(n)).sort();

  if (unclassified.length) {
    die(
      `[snapshot] ${unclassified.length} section(s) in ${"code/ali-je-vroce-era5/AliJeVroceERA5.tsx"} ` +
        `are not classified in tests/snapshot/sections.json:\n` +
        unclassified.map((n) => `  <${n}>`).join("\n") +
        `\n\nThe harness mirrors the page's composition rather than mounting it, so a new ` +
        `section would otherwise be silently absent from the snapshot — no error, no fixture ` +
        `miss, just a number that quietly stops being watched.\n\n` +
        `Add each one to sections.json under "covered" (and capture it in ` +
        `tests/snapshot/harness.tsx), "structural" (renders no data of its own), or ` +
        `"excluded" (with a reason and a ticket). No snapshot was written.`,
    );
  }

  if (stale.length) {
    die(
      `[snapshot] tests/snapshot/sections.json classifies ${stale.length} tag(s) that no longer ` +
        `appear in AliJeVroceERA5.tsx:\n` +
        stale.map((n) => `  <${n}>`).join("\n") +
        `\n\nEither the section was removed — in which case drop the entry, and drop its capture ` +
        `from harness.tsx — or it was renamed, in which case the harness is now mirroring ` +
        `something that is not on the page. No snapshot was written.`,
    );
  }

  return { found: [...found].sort(), sections };
}

const { sections } = assertSections();

// ── 3. fixture server ─────────────────────────────────────────────────────────

const MIME = {
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

function startFixtureServer() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (!url.pathname.startsWith("/fixtures/")) {
        res.writeHead(404).end("not found");
        return;
      }
      const rel = decodeURIComponent(url.pathname.slice("/fixtures/".length));
      const abs = resolve(FIXTURE_DIR, normalize(rel));
      if (!abs.startsWith(FIXTURE_DIR + sep)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      readFile(abs, (err, buf) => {
        if (err) {
          res.writeHead(404, { "content-type": "text/plain" }).end(`no fixture: ${rel}`);
          return;
        }
        res
          .writeHead(200, { "content-type": MIME[extname(abs)] ?? "application/octet-stream" })
          .end(buf);
      });
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

const server = await startFixtureServer();
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// ── 4. build ──────────────────────────────────────────────────────────────────

console.log("[snapshot] building harness…");
{
  const { build } = await import("vite");
  await build({ configFile: join(ROOT, "tests", "snapshot", "vite.config.mjs") });
}

// ── 5. jsdom + optional fake clock ────────────────────────────────────────────

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: `${ORIGIN}/`,
  pretendToBeVisual: true,
});

// Copy the window's own globals across before anything imports solid-js/web,
// which touches `document` at module scope.
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis) continue;
  try {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      writable: true,
      configurable: true,
    });
  } catch {
    /* read-only host intrinsics — nothing we need */
  }
}
for (const key of ["window", "document", "navigator", "location", "getComputedStyle"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    writable: true,
    configurable: true,
  });
}

// Root-relative fetch. install.ts passes "/fixtures/..." straight through as
// same-origin (install.ts:155-157); Node's fetch needs an absolute URL.
const nodeFetch = globalThis.fetch;
globalThis.fetch = function baseResolvingFetch(input, init) {
  if (typeof input === "string" && input.startsWith("/") && !input.startsWith("//")) {
    return nodeFetch(ORIGIN + input, init);
  }
  return nodeFetch(input, init);
};

if (SIMULATE_DATE) {
  // A different SYSTEM clock, not a different pinned date — the pin comes from
  // the fixture manifest and is baked into the bundle. Anything that still reads
  // the system clock and reaches rendered output will move; that is the point.
  const FIXED = new Date(SIMULATE_DATE).getTime();
  if (!Number.isFinite(FIXED)) die(`[snapshot] --simulate-date is not a date: ${SIMULATE_DATE}`);
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(FIXED);
      else super(...args);
    }
    static now() {
      return FIXED;
    }
  }
  globalThis.Date = FakeDate;
  dom.window.Date = FakeDate;
  console.log(`[snapshot] system clock faked to ${new Date(FIXED).toISOString()}`);
}

// ── 6. run ────────────────────────────────────────────────────────────────────

if (PROBE) {
  // Reports the complete fixture gap in one pass instead of one re-record per
  // missing URL. Reads as a flag inside the harness (harness.tsx PROBE) and is
  // hard-wired never to produce a file — see the exit below.
  globalThis.__SNAPSHOT_PROBE__ = true;
  console.log("[snapshot] PROBE MODE: unrecorded URLs answered with [] — no snapshot will be written");
}

const index = JSON.parse(await readFileAsync(join(FIXTURE_DIR, "index.json"), "utf8"));

let result;
try {
  const mod = await import(pathToFileURL(join(BUILD_DIR, "harness.mjs")).href);
  result = await mod.run();
} catch (err) {
  server.close();
  die(`[snapshot] harness failed:\n${err?.stack ?? err}`);
}

server.close();

if (PROBE) {
  const gaps = [...new Set(result.snapshot.fixture_misses)].sort();
  console.log(`\n[snapshot] PROBE: ${gaps.length} distinct unrecorded URL(s)`);
  for (const u of gaps) console.log(`  ${u}`);
  console.log(
    `\nAdd their parameters to tests/fixtures/manifest.json / scripts/fixtures/record.mjs ` +
      `and re-run \`yarn fixtures:record\`. NOTHING WAS WRITTEN — probe mode never produces a snapshot.`,
  );
  process.exit(gaps.length ? 2 : 0);
}

if (result.snapshot.fixture_misses.length !== 0) {
  die(
    `[snapshot] window.__FIXTURE_MISSES__ is not empty at the end of the run:\n` +
      result.snapshot.fixture_misses.map((u) => `  ${u}`).join("\n") +
      `\n\nNo snapshot was written.`,
  );
}

// ── 7. write ──────────────────────────────────────────────────────────────────

const out = {
  _readme: [
    "T-1.1 OUTPUT SNAPSHOT. Generated — do not hand-edit. Regenerate with `yarn snapshot`.",
    "",
    "Every number the ERA5 page displays, for the (station, date) matrix in",
    "tests/snapshot/cases.json, captured with the network disabled through the app's",
    "own fixture shim and with the date pinned. Values, not markup: chart figures are",
    "read out of the Highcharts options object rather than scraped from SVG.",
    "",
    "THIS IS NOT A FILE OF CORRECT VALUES. It is a file of CURRENT values. Phase 2 and",
    "Phase 3 must leave it byte-identical; Phase 4 will move numbers deliberately, and",
    "every such move updates this file in the same commit with the reason in the commit",
    "message and a row in the DECISIONS.md log (CLAUDE.md ground rule 2).",
    "",
    "IT IS ALSO ONLY VALID WITHIN ONE DATA GENERATION. All of it encodes stage's",
    "committed-CSV data as of 2026-07-22. The D-4/D-5 regeneration invalidates every",
    "fixture behind it, and Phase 4 must re-record and re-baseline deliberately rather",
    "than read the resulting diff as a regression.",
    "",
    "Known current-behaviour defects deliberately frozen here rather than fixed:",
    "  * Feb 29 returns zero rows everywhere and fetchAnnualTrend throws (T-4.5).",
    "  * The 'ERA5T · preliminarno' badge names a source the code never fetches",
    "    (D-11 open, T-4.13).",
    "  * The percentile shown is a bucket midpoint, not an empirical rank (D-6, T-4.1).",
    "",
    "NOT COVERED: the sea-level widget. See tests/snapshot/sections.json `excluded`.",
  ],
  ticket: "T-1.1",
  environment: {
    _note:
      "Pinned by scripts/snapshot/run.mjs and re-asserted by main.mjs. `recorded_at` is " +
      "deliberately absent: this file must diff only when a number moves.",
    ...result.environment,
  },
  source_fixtures: {
    _note:
      "index.json's `recorded_at` is deliberately NOT copied — it changes on every " +
      "re-record by design, and copying it would make this file diff for a non-reason.",
    primary_date: index.primary_date,
    datasette_base: index.bases.datasette,
    counts: index.counts,
  },
  sections: {
    _note:
      "Asserted against AliJeVroceERA5.tsx on every run; an unclassified section fails " +
      "the run. See tests/snapshot/sections.json.",
    covered: Object.keys(sections.covered).sort(),
    structural: Object.keys(sections.structural).sort(),
    excluded: Object.keys(sections.excluded).sort(),
  },
  ...result.snapshot,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(
  `[snapshot] wrote ${OUT} (${(JSON.stringify(out).length / 1_048_576).toFixed(2)} MB), ` +
    `${out.cases.length} cases, ${Object.keys(out.by_station).length} stations, 0 fixture misses`,
);
