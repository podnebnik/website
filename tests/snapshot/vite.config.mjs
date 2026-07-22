// T-1.1 — build config for the snapshot harness.
//
// Builds tests/snapshot/harness.tsx into a single ESM bundle that Node runs
// against jsdom (scripts/snapshot/main.mjs). Deliberately separate from the
// site's own Vite config, which eleventy-plugin-vite generates
// (eleventy.config.mjs:141-156); nothing here can affect `yarn build`.
//
// CLIENT MODE, NOT SSR, on purpose. Solid's SSR codegen never runs onMount, and
// onMount is exactly where the two former clock leaks live
// (TodayTrendChart.tsx:41, TropicalChart.tsx:102) — the values the T-1.2 review
// requires this snapshot to pin. So the harness renders the real client-side
// component code, with a DOM under it.

import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// The pinned date is single-sourced from the fixture manifest, the same way
// scripts/fixtures/with-pinned-date.mjs does it for `yarn fixtures:start` and
// `yarn fixtures:build`. It must NOT be duplicated here: install.ts:109 aborts
// the run if clock.ts and index.json disagree, and that check is only a real
// backstop while there is exactly one place the date comes from.
const manifest = JSON.parse(readFileSync(here("../fixtures/manifest.json"), "utf8"));
const PINNED_DATE = manifest.primary_date;

export default defineConfig({
  root: here("../.."),
  logLevel: "warn",

  plugins: [solid()],

  resolve: {
    alias: [
      // Order matters: the exact-match regexes keep `highcharts/...` submodules
      // from being caught by the bare `highcharts` rule.
      { find: /^highcharts\/modules\/map$/, replacement: here("./highcharts-stub.ts") },
      { find: /^highcharts\/highcharts-more$/, replacement: here("./highcharts-stub.ts") },
      { find: /^highcharts$/, replacement: here("./highcharts-stub.ts") },
    ],
  },

  define: {
    // Set explicitly rather than leaked in from the ambient environment, so the
    // bundle is a function of the repo alone.
    //
    // VITE_FIXTURES=1 is what makes clock.ts honour the pin at all
    // (clock.ts OVERRIDES_ALLOWED) — `vite build` sets DEV false.
    "import.meta.env.VITE_FIXTURES": JSON.stringify("1"),
    "import.meta.env.VITE_PINNED_DATE": JSON.stringify(PINNED_DATE),
    // Left undefined so DS_BASE (api.ts:11) resolves to its stage default, which
    // is the base the fixtures were recorded from. install.ts:127 fails the run
    // if these ever diverge.
    "import.meta.env.VITE_DATASETTE_URL": "undefined",
    "import.meta.env.VITE_ERA5_SIDECAR_URL": "undefined",
  },

  build: {
    outDir: here("../../.snapshot-build"),
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    sourcemap: false,
    lib: {
      entry: here("./harness.tsx"),
      formats: ["es"],
      fileName: () => "harness.mjs",
    },
    rollupOptions: {
      // The island uses lazy()/dynamic import in several places; one file keeps
      // module resolution in Node trivial and chunk order deterministic.
      output: { codeSplitting: false },
    },
  },
});
