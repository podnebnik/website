import { defineConfig } from "vitest/config";

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
export default defineConfig({
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
