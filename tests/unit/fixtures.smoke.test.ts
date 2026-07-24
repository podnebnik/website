import { describe, expect, it } from "vitest";

// T-3.3 — one trivial passing test: proof that the T-1.2 shim (installed in
// setup.fixtures.ts) serves a recorded datasette response offline. The real
// api.ts unit tests are T-3.4; do not add them here.
describe("T-1.2 offline fixture shim", () => {
  it("serves a recorded route from disk with no network", async () => {
    const index = (await (await fetch("/fixtures/index.json")).json()) as {
      routes: Record<string, string>;
    };

    const firstRoute = Object.keys(index.routes)[0];
    if (!firstRoute) throw new Error("fixture index has no recorded routes");

    const resp = await fetch(firstRoute);
    expect(resp.ok).toBe(true);

    const body = await resp.json();
    expect(body).toBeDefined();
  });
});
