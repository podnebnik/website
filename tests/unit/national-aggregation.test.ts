import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchEra5NationalWindowRow, fetchMeta } from "../../code/ali-je-vroce-era5/api.ts";
import { cdfPercentile } from "../../code/ali-je-vroce-era5/percentile.ts";

// T-3.4 / T-4.31 — the Slovenia national ±window climatology (api.ts
// fetchEra5NationalWindowRow). The distribution curve is the unweighted MEAN of the 18
// per-station KDE curves (the equally-weighted mixture, D-15); the band cutoffs p5..p95
// are read OFF that curve (curveQuantile), NOT the mean of the per-station quantiles
// (T-4.31 b2). The station pool is still all 18 INCLUDING Kredarica; D-7/T-4.6 will drop
// it to 17 ("povprečje 17 postaj"). n_samples is the clean station-count tripwire so
// T-4.6 fails loudly rather than silently moving the headline.
//
// Fixture (served offline by setup.fixtures.ts):
//   tests/fixtures/http/climate-si/daily_window__national-all__month-7__day-21.json
//   18 rows, each with n_samples = 1149.
//
// p50 is now the MEDIAN of the averaged curve, computed from the 18 fixture curves via
// averageDistributions + curveQuantile: 25.0422 °C (the old mean-of-p50 was 24.5172 —
// T-4.31 moved it). Dropping Kredarica (T-4.6) removes its low-temp component from the
// mixture and raises this, so it still moves loudly under T-4.6.

describe("fetchEra5NationalWindowRow — cutoffs read off the averaged curve (T-4.31 b2)", () => {
  // T-5.2: the national aggregate now asserts its row count against the station
  // registry, so fetchMeta must populate era5Coords first (it always does in the
  // real page — meta loads before any national card). Served offline from
  // tests/fixtures/http/climate-si/stations.json (18 rows).
  beforeAll(async () => { await fetchMeta(); });

  it("averages all 18 stations, Kredarica included", async () => {
    const row = await fetchEra5NationalWindowRow(7, 21);
    expect(row).not.toBeNull();

    // 18 × 1149 = 20682. The summed sample count is a clean integer tripwire on
    // the station count: dropping Kredarica (T-4.6) makes this 17 × 1149 = 19533.
    expect(row!.n_samples).toBe(20682);

    // Median of the averaged curve, Kredarica in the pool (T-4.31 b2). Moves the
    // moment Kredarica leaves the mixture (T-4.6).
    expect(row!.p50).toBeCloseTo(25.0422, 3);

    // T-4.31 b2 invariant — the band edge and the displayed percentile derive from ONE
    // curve, so the CDF of the served curve AT each cutoff is exactly that percentile.
    // This is the property that makes the "Vroče + 78" contradiction unrepresentable.
    const curve = JSON.parse(row!.distribution_json) as [number, number][];
    expect(cdfPercentile(curve, row!.p80)).toBeCloseTo(80, 4);
    expect(cdfPercentile(curve, row!.p95)).toBeCloseTo(95, 4);
    expect(cdfPercentile(curve, row!.p10)).toBeCloseTo(10, 4);

    expect(row!.station).toBe("era5:national");
    expect(row!.year_min).toBe(1950);
    expect(row!.year_max).toBe(2026);
  });
});

// T-5.2 — the national row-count guard (assertNationalStationRows). datasette
// silently drops rows past `_size`, so a national aggregate that comes back with
// neither 0 nor the full station count — a partial pool, or a response truncated
// at the cap — must throw and surface via the section ErrorBoundary rather than
// silently averaging a biased subset. The station registry here holds 18; a
// stubbed short response stands in for the truncated/partial case.
describe("national aggregate rejects a short row count (T-5.2)", () => {
  const realFetch = globalThis.fetch;              // the offline fixture shim
  beforeAll(async () => { await fetchMeta(); });   // era5Coords = 18 (served offline)
  afterEach(() => { globalThis.fetch = realFetch; });

  function stubRows(n: number): void {
    const body = JSON.stringify(
      Array.from({ length: n }, () => ({
        p5: 0, p10: 0, p20: 0, p50: 0, p80: 0, p95: 0,
        n_samples: 0, year_min: 2000, year_max: 2000, distribution_json: "[]",
      })),
    );
    globalThis.fetch = (async () =>
      new Response(body, { status: 200, headers: { "content-type": "application/json" } })
    ) as typeof fetch;
  }

  it("throws when the pool is partial (5 of 18 stations)", async () => {
    stubRows(5);
    await expect(fetchEra5NationalWindowRow(7, 21))
      .rejects.toThrow(/daily_window: national aggregate expected 0 or 18 station rows, got 5/);
  });

  it("still accepts a legitimately empty day (0 rows → null, no throw)", async () => {
    stubRows(0);
    await expect(fetchEra5NationalWindowRow(2, 29)).resolves.toBeNull();
  });
});
