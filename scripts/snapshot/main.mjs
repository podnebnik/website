#!/usr/bin/env node
// T-1.1 — snapshot harness runner. Invoked by scripts/snapshot/run.mjs, which
// pins TZ and locale before Node starts; do not run this file directly.
//
// Order of operations, and why:
//
//   1. Assert the pinned environment actually took effect.
//   2. Assert the source-mirror set against code/ali-je-vroce-era5, BEFORE doing
//      any work — a drifted mirror should fail in a second, not after a
//      two-minute render. Three assertions: the section set
//      (tests/snapshot/sections.json), the raw-JSX copy the harness mirrors, and
//      cases.json `analysis_defaults` against the createSignal defaults.
//   3. Serve tests/fixtures over loopback, so the app's own shim
//      (code/ali-je-vroce-era5/fixtures/install.ts) can be used unmodified
//      rather than reimplemented for Node.
//   4. Build the harness bundle (tests/snapshot/vite.config.mjs).
//   5. Install jsdom globals, and the fake clock if asked.
//   6. Import the bundle and run it.
//   7. Write the snapshot (--write) or diff it against the committed baseline
//      (--check). Writing is never the default: a harness that rewrites its own
//      baseline every run enforces nothing.

import { createServer } from "node:http";
import { readFile, readFileSync, writeFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE_DIR = join(ROOT, "tests", "fixtures");
const BUILD_DIR = join(ROOT, ".snapshot-build");
const PAGE_SRC = join(ROOT, "code", "ali-je-vroce-era5", "AliJeVroceERA5.tsx");
const PANEL_SRC = join(ROOT, "code", "ali-je-vroce-era5", "components", "RegressionPanel.tsx");
const SECTIONS = join(ROOT, "tests", "snapshot", "sections.json");
const CASES = join(ROOT, "tests", "snapshot", "cases.json");
const BASELINE = join(FIXTURE_DIR, "snapshot.json");
const DEFAULT_OUT = BASELINE;

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
const WRITE = argv.includes("--write");
const CHECK = argv.includes("--check");

// A mode has to be asked for. The harness used to write tests/fixtures/snapshot.json
// whenever it was run with no other flag, which meant the committed baseline was
// whatever the last run produced — it was never READ, so it could not fail, so
// it enforced nothing. Both directions are now explicit.
if (!PROBE && !WRITE && !CHECK) {
  die(
    `[snapshot] no mode given. One of:\n` +
      `  --check                 render and diff against ${"tests/fixtures/snapshot.json"}, exit non-zero on any difference\n` +
      `  --write                 render and overwrite the baseline (say why in the commit message)\n` +
      `  --probe-fixture-gaps    report unrecorded URLs; never writes\n\n` +
      `\`yarn snapshot:check\`, \`yarn snapshot:write\`, \`yarn snapshot:verify\`.`,
  );
}

if (WRITE && CHECK) die(`[snapshot] --write and --check are mutually exclusive.`);

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

// ── 2. source-mirror assertions ───────────────────────────────────────────────
//
// WHAT THE SECTION-SET ASSERTION CAN AND CANNOT SEE.
//
// It extracts capitalised JSX tags — `/<([A-Z][A-Za-z0-9_]*)/` — and requires
// each to be classified. That covers everything the page delegates to a
// component, and NOTHING the page renders itself. AliJeVroceERA5.tsx:99-112 and
// :137-145 are bare <div>/<p> holding displayed numbers (the distribution
// chart's title and footer — median cutoff, sample count, record years — and the
// station count); no capitalised tag appears, so this assertion is structurally
// blind to them. Widening the regex to lowercase tags would classify every <div>
// on the page and assert nothing.
//
// assertMirroredCopy below is the cover for that blind spot: the harness mirrors
// those fragments verbatim, and each mirrored template must still appear in the
// source. It is a whitelist, not a sweep — a NEW raw-JSX number added to the page
// is still invisible to both assertions. Moving such copy into components is the
// real fix and belongs to T-5.5 (string catalogue), not here.

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

/**
 * Every raw-JSX fragment tests/snapshot/harness.tsx mirrors, as it appears in the
 * page. Whitespace is collapsed on both sides before comparing, so reformatting is
 * tolerated and a changed STRING is not.
 */
const MIRRORED = [
  {
    file: PAGE_SRC,
    cite: "AliJeVroceERA5.tsx:102",
    mirror: "harness.tsx TodayChartCopy — title, national branch",
    fragment:
      "`Dnevne najvišje temperature v Sloveniji za dva tedna okoli ${fmtDayLabel(todayData()!.day_label ?? \"\")} od ${todayData()!.year_min}`",
  },
  {
    file: PAGE_SRC,
    cite: "AliJeVroceERA5.tsx:103",
    mirror: "harness.tsx TodayChartCopy — title, per-station branch",
    fragment:
      "`Dnevne najvišje temperature na postaji ${todayData()!.loc!.replace(/_/g, \" \")} za dva tedna okoli ${fmtDayLabel(todayData()!.day_label ?? \"\")} od ${todayData()!.year_min}`",
  },
  {
    file: PAGE_SRC,
    cite: "AliJeVroceERA5.tsx:110",
    mirror: "harness.tsx TodayChartCopy — footer (median cutoff, sample count, record years)",
    fragment:
      "`${isNat() ? \"Slovenija\" : \"Danes\"}: ${todayData()!.today_temp!.toFixed(1)} °C · ${todayData()!.percentile!.toFixed(0)}. percentil · mediana ${todayData()!.cutoffs!.p50.toFixed(1)} °C · ${(todayData()!.n_samples ?? 0).toLocaleString()} opazovanj · ${todayData()!.year_min}–${todayData()!.year_max}`",
  },
  {
    file: PAGE_SRC,
    cite: "AliJeVroceERA5.tsx:107",
    mirror: "harness.tsx TodayChartCopy — explain paragraph",
    // Anchored on the closing tag: a text node's fragment would otherwise still
    // "appear in" a LONGER version of itself.
    fragment:
      "Krivulja prikazuje, kako pogosto se je pojavila vsaka vrhunska temperatura na dneve, kot je danes, v vseh letih. Barve označujejo klimatološke cone — od hladne modre prek tipičnega bežastega pasu do ekstremne rdeče. </p>",
  },
  {
    file: PAGE_SRC,
    cite: "AliJeVroceERA5.tsx:140",
    mirror: "harness.tsx MapPanelHeader — title",
    fragment: '{mapLoc() ? mapLoc()!.replace(/_/g, " ") : "Slovenija — vse postaje"}',
  },
  {
    file: PAGE_SRC,
    cite: "AliJeVroceERA5.tsx:143",
    mirror: "harness.tsx MapPanelHeader — station count",
    fragment: "{era5Stations.length} postaj · ERA5 </div>",
  },
];

const collapse = (s) => s.replace(/\s+/g, " ").trim();

/**
 * A plain `includes` is not enough: it passes when the page EXTENDS the copy, and
 * extending is the common edit. `postaj · ERA5` still "appears in" `postaj ·
 * ERA5-Land`, so a label change would sail through while the harness went on
 * mirroring the old string. So the match has to sit between delimiters — the
 * fragment must be bounded by whitespace, a bracket, a quote or a separator on
 * both sides, not by a character that continues it.
 */
const BOUNDARY = /[\s<>{}()[\],;:?`"'=]/;

function appearsVerbatim(haystack, fragment) {
  const bounded = (i) => {
    const before = i === 0 ? "" : haystack[i - 1];
    const after = haystack[i + fragment.length] ?? "";
    return (before === "" || BOUNDARY.test(before)) && (after === "" || BOUNDARY.test(after));
  };
  for (let i = haystack.indexOf(fragment); i !== -1; i = haystack.indexOf(fragment, i + 1)) {
    if (bounded(i)) return true;
  }
  return false;
}

function assertMirroredCopy() {
  const cache = new Map();
  const drifted = [];
  for (const m of MIRRORED) {
    if (!cache.has(m.file)) cache.set(m.file, collapse(readFileSync(m.file, "utf8")));
    if (!appearsVerbatim(cache.get(m.file), collapse(m.fragment))) drifted.push(m);
  }
  if (drifted.length) {
    die(
      `[snapshot] ${drifted.length} mirrored source fragment(s) no longer appear in the page:\n` +
        drifted.map((m) => `  ${m.cite}\n    mirrored by: ${m.mirror}\n    expected:    ${collapse(m.fragment)}`).join("\n") +
        `\n\nThese are displayed numbers the page renders as raw JSX, outside any component. ` +
        `The harness reproduces them character-for-character because nothing else can capture ` +
        `them, and the section-set assertion cannot see them at all (it matches capitalised ` +
        `tags only). Update tests/snapshot/harness.tsx and the MIRRORED table together, or the ` +
        `snapshot pins a string the page stopped rendering. No snapshot was written.`,
    );
  }
}

/**
 * tests/snapshot/cases.json `analysis_defaults` is a hand-copy of the analysis
 * panel's createSignal defaults. Nothing made it a copy OF anything — changing a
 * default in the source would leave the harness snapshotting the old value under
 * the claim that it is "what a default page load uses". Each entry below names
 * where the real value lives and how to read it out.
 */
const DEFAULT_SOURCES = [
  { key: "variable", file: PANEL_SRC, cite: "RegressionPanel.tsx:38", from: /const \[selVar,\s*setSelVar\]\s*=\s*createSignal\("([^"]+)"\)/, cast: String },
  { key: "window_days", file: PANEL_SRC, cite: "RegressionPanel.tsx:40", from: /const \[window_,\s*setWindow\]\s*=\s*createSignal\((\d+)\)/, cast: Number },
  { key: "method", file: PANEL_SRC, cite: "RegressionPanel.tsx:42 (useOls)", from: /const \[useOls,\s*setUseOls\]\s*=\s*createSignal\((true|false)\)/, cast: (v) => (v === "true" ? "ols" : "theilsen") },
  { key: "elevation_correction", file: PANEL_SRC, cite: "RegressionPanel.tsx:41 (corr)", from: /const \[corr,\s*setCorr\]\s*=\s*createSignal\((true|false)\)/, cast: (v) => (v === "true" ? "corr" : "raw") },
  { key: "tropical_days_threshold", file: PAGE_SRC, cite: "AliJeVroceERA5.tsx:212", from: /const \[daysThr,\s*setDaysThr\]\s*=\s*createSignal\((\d+)\)/, cast: Number },
  { key: "tropical_nights_threshold", file: PAGE_SRC, cite: "AliJeVroceERA5.tsx:213", from: /const \[nightsThr,\s*setNightsThr\]\s*=\s*createSignal\((\d+)\)/, cast: Number },
  { key: "tropical_streak", file: PAGE_SRC, cite: "AliJeVroceERA5.tsx:214", from: /const \[streak,\s*setStreak\]\s*=\s*createSignal\((\d+)\)/, cast: Number },
];

function assertAnalysisDefaults() {
  const declared = JSON.parse(readFileSync(CASES, "utf8")).analysis_defaults;
  const cache = new Map();
  const problems = [];

  for (const d of DEFAULT_SOURCES) {
    if (!cache.has(d.file)) cache.set(d.file, readFileSync(d.file, "utf8"));
    const m = cache.get(d.file).match(d.from);
    if (!m) {
      problems.push(
        `  ${d.key}: could not find the declaration at ${d.cite} — the signal was renamed, ` +
          `moved, or its default is no longer a literal.`,
      );
      continue;
    }
    const actual = d.cast(m[1]);
    if (actual !== declared[d.key]) {
      problems.push(
        `  ${d.key}: cases.json says ${JSON.stringify(declared[d.key])}, ${d.cite} says ` +
          `${JSON.stringify(actual)}`,
      );
    }
  }

  if (problems.length) {
    die(
      `[snapshot] tests/snapshot/cases.json \`analysis_defaults\` does not match the source:\n` +
        problems.join("\n") +
        `\n\nThose values claim to be "the analysis panel's own controls at the values a default ` +
        `page load uses", and every tropical, regression and calendar figure in the snapshot is ` +
        `taken at them. A default that moved in the source without moving here would be ` +
        `snapshotted as if the page still used the old one. Update cases.json (and expect the ` +
        `numbers to move — that is a Phase 4-style baseline change, with a reason). ` +
        `No snapshot was written.`,
    );
  }
}

assertMirroredCopy();
assertAnalysisDefaults();

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

const serialised = JSON.stringify(out, null, 2) + "\n";

if (WRITE) {
  writeFileSync(OUT, serialised);
  console.log(
    `[snapshot] wrote ${OUT} (${(serialised.length / 1_048_576).toFixed(2)} MB), ` +
      `${out.cases.length} cases, ${Object.keys(out.by_station).length} stations, 0 fixture misses`,
  );
  if (OUT === BASELINE) {
    console.log(
      `[snapshot] THE BASELINE WAS OVERWRITTEN. If any number moved, the reason belongs in ` +
        `the commit message and in the DECISIONS.md log (CLAUDE.md ground rule 2).`,
    );
  }
} else {
  // ── --check: the baseline is READ, and disagreement is a failure ────────────
  //
  // This is the whole point of committing snapshot.json. Phase 2 and Phase 3
  // claim "no behaviour change"; that claim is only worth something if something
  // compares the rendered output against the committed file and fails.
  let baselineRaw;
  try {
    baselineRaw = readFileSync(BASELINE, "utf8");
  } catch {
    die(
      `[snapshot] --check: no baseline at ${BASELINE}. Create one with \`yarn snapshot:write\` ` +
        `and commit it.`,
    );
  }

  if (baselineRaw === serialised) {
    console.log(
      `[snapshot] --check: identical to ${"tests/fixtures/snapshot.json"} ` +
        `(${out.cases.length} cases, ${Object.keys(out.by_station).length} stations, ` +
        `0 fixture misses).`,
    );
    process.exit(0);
  }

  const diffs = diffPaths(JSON.parse(baselineRaw), out);

  if (diffs.length === 0) {
    // Byte difference with no value difference: key order or formatting.
    die(
      `[snapshot] --check: ${BASELINE} differs byte-for-byte but no VALUE differs — the file ` +
        `was reformatted or hand-edited. Regenerate it with \`yarn snapshot:write\` and commit ` +
        `the result unmodified.`,
    );
  }

  const SHOWN = 60;
  console.error(
    `\n[snapshot] --check FAILED: ${diffs.length} path(s) differ from the committed baseline ` +
      `${"tests/fixtures/snapshot.json"}.\n`,
  );
  for (const d of diffs.slice(0, SHOWN)) console.error(`  ${d}`);
  if (diffs.length > SHOWN) console.error(`  … and ${diffs.length - SHOWN} more`);
  console.error(
    `\nA published number moved. If that was intended, the change updates the baseline in the ` +
      `SAME commit (\`yarn snapshot:write\`), with the reason in the commit message and a row ` +
      `in the DECISIONS.md log — CLAUDE.md ground rule 2. Phase 2 and Phase 3 tickets must ` +
      `produce an EMPTY diff here; if one does not, stop and report rather than re-baselining.`,
  );
  process.exit(1);
}

/**
 * Every path at which `actual` differs from `expected`, as `a.b[0].c: x -> y`.
 * Depth-first and order-stable so the report reads the same on every run.
 */
function diffPaths(expected, actual, path = "", out = []) {
  const brief = (v) => {
    if (v === undefined) return "<absent>";
    const s = JSON.stringify(v);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  };

  if (expected === actual) return out;

  const bothObjects =
    expected && actual && typeof expected === "object" && typeof actual === "object" &&
    Array.isArray(expected) === Array.isArray(actual);

  if (!bothObjects) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      out.push(`${path || "<root>"}: ${brief(expected)} -> ${brief(actual)}`);
    }
    return out;
  }

  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      out.push(`${path}.length: ${expected.length} -> ${actual.length}`);
    }
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      diffPaths(expected[i], actual[i], `${path}[${i}]`, out);
    }
    return out;
  }

  for (const k of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    diffPaths(expected[k], actual[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}
