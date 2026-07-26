import { afterEach, describe, expect, it } from "vitest";

import {
  parseJsonColumn,
  fetchSpeiHeatmap,
  fetchSpeiStationSeasonal,
  fetchEra5Tropical,
} from "../../code/ali-je-vroce-era5/api.ts";

// T-5.1 — kill silent failures. Two behaviours are pinned here:
//
//   Part 2 — parseJsonColumn wraps every JSON.parse of a datasette `*_json` column
//   so malformed data becomes a descriptive, handled throw (which the section
//   ErrorBoundary renders) rather than a bare "Unexpected token" SyntaxError.
//
//   Part 1 — the three helpers that used to swallow a fetch/parse failure into an
//   "unavailable" sentinel (so the section silently vanished) now let the failure
//   propagate. A genuinely empty result set is still legitimate "no data" and keeps
//   returning the sentinel — that distinction is the point.

describe("parseJsonColumn (T-5.1 Part 2)", () => {
  it("parses valid JSON", () => {
    expect(parseJsonColumn<number[]>("[1,2,3]", "spei_station.years_json")).toEqual([1, 2, 3]);
  });

  it("throws a descriptive error naming the column on malformed JSON", () => {
    expect(() => parseJsonColumn("{not json", "tropical.trend_json"))
      .toThrowError(/Malformed JSON in datasette column tropical\.trend_json/);
  });
});

// ── fetch propagation vs. swallow (Part 1) ──────────────────────────────────────

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Stub the network for one call. `body` is the JSON text the datasette would return;
// `ok:false` simulates an HTTP error (dsGet throws on !resp.ok).
function stubFetch(body: string, ok = true): void {
  globalThis.fetch = (async () =>
    new Response(body, { status: ok ? 200 : 500, headers: { "content-type": "application/json" } })
  ) as typeof fetch;
}

describe("section-fetch failures propagate instead of vanishing (T-5.1 Part 1)", () => {
  it("fetchSpeiHeatmap rejects on an HTTP error (was: swallowed to available:false)", async () => {
    stubFetch("", false);
    await expect(fetchSpeiHeatmap()).rejects.toThrow(/Datasette 500/);
  });

  it("fetchSpeiHeatmap still returns the unavailable sentinel on genuinely empty data", async () => {
    stubFetch("[]");
    await expect(fetchSpeiHeatmap()).resolves.toMatchObject({ available: false });
  });

  it("fetchSpeiStationSeasonal rejects on a malformed *_json row (was: swallowed)", async () => {
    // A well-formed outer row whose spei_json payload is corrupt — the exact case
    // that used to blank the whole SPEI-trend section without a trace.
    stubFetch(JSON.stringify([
      { era5_name: "Ljubljana", series: "spei3", years_json: "[2000]", spei_json: "{bad", trend_json: "{}" },
    ]));
    await expect(fetchSpeiStationSeasonal())
      .rejects.toThrow(/Malformed JSON in datasette column spei_station\.spei_json/);
  });

  it("fetchEra5Tropical rejects on an HTTP error (was: swallowed to null)", async () => {
    stubFetch("", false);
    await expect(fetchEra5Tropical("Ljubljana", "days", 30, 1)).rejects.toThrow(/Datasette 500/);
  });

  it("fetchEra5Tropical still returns null on genuinely empty data", async () => {
    stubFetch("[]");
    await expect(fetchEra5Tropical("Ljubljana", "days", 30, 1)).resolves.toBeNull();
  });
});
