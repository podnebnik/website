import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

// T-3.3 — the TypeScript regression runner.
//
// Scope is deliberately narrow and separate from `yarn snapshot:check`:
//   * `yarn test` (this config) runs Node-side unit/regression tests under
//     tests/unit/, with the T-1.2 offline fixture shim installed by
//     tests/unit/setup.fixtures.ts. It NEVER reaches the network.
//   * `yarn snapshot:check` (scripts/snapshot/run.mjs) still renders the
//     Dashboard composition against the recorded fixtures and diffs
//     tests/fixtures/snapshot.json. Untouched by this ticket.
// T-3.7 gates on BOTH.
//
// T-3.4 added vite-plugin-solid so the unit tests can import the real doy helper
// dateToDoy from AliJeVroceERA5.tsx (a .tsx that needs the Solid JSX transform to
// load). Only the module's top-level function/const definitions are evaluated on
// import — the components are never rendered and the chart deps (highcharts,
// leaflet) are behind lazy()/dynamic import, so no DOM or browser global is
// touched. Pure .ts imports (api.ts, percentile.ts) are unaffected by the plugin.
export default defineConfig({
  plugins: [solid()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/unit/setup.fixtures.ts"],
    // The shim single-sources "today" from these; they must match
    // tests/fixtures/index.json (primary_date 2026-07-21, datasette default
    // base) or installFixtures() throws. VITE_FIXTURES=1 unlocks clock.ts's
    // date override off the dev-server flag.
    env: {
      VITE_FIXTURES: "1",
      VITE_PINNED_DATE: "2026-07-21",
    },
  },
});
