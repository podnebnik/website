import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchEra5NationalWindowRow, fetchMeta } from "../../code/ali-je-vroce-era5/api.ts";

// T-3.4 — the Slovenia national ±window climatology (api.ts fetchEra5NationalWindowRow)
// is the UNWEIGHTED MEAN of the per-station daily_window rows for a month/day.
// TODAY it averages all 18 stations INCLUDING Kredarica; D-7/T-4.6 will drop
// Kredarica to 17 ("povprečje 17 postaj"). This pins the current 18-station mean
// against the recorded fixture so T-4.6 fails loudly rather than silently moving
// the headline number.
//
// Fixture (served offline by setup.fixtures.ts):
//   tests/fixtures/http/climate-si/daily_window__national-all__month-7__day-21.json
//   18 rows, each with n_samples = 1140.
//
// Expected values hand-computed from the 18 fixture p50 values:
//   Σ p50 = 25.65 + 24.97 + 25.21 + 24.68 + 26.62 + 24.41 + 11.19 + 24.89 + 25.37
//         + 26.06 + 26.88 + 26.04 + 24.05 + 25.81 + 22.14 + 26.33 + 25.61 + 24.69
//         = 440.60
//   mean p50 over 18 = 440.60 / 18 = 24.4778 °C   ← Kredarica's 11.19 drags it down
//   mean p50 over 17 = (440.60 − 11.19) / 17 = 25.2594 °C   ← what T-4.6 will produce

describe("fetchEra5NationalWindowRow — unweighted mean of the 18 stations", () => {
  // T-5.2: the national aggregate now asserts its row count against the station
  // registry, so fetchMeta must populate era5Coords first (it always does in the
  // real page — meta loads before any national card). Served offline from
  // tests/fixtures/http/climate-si/stations.json (18 rows).
  beforeAll(async () => { await fetchMeta(); });

  it("averages all 18 stations, Kredarica included", async () => {
    const row = await fetchEra5NationalWindowRow(7, 21);
    expect(row).not.toBeNull();

    // 18 × 1140 = 20520. The summed sample count is a clean integer tripwire on
    // the station count: dropping Kredarica (T-4.6) makes this 17 × 1140 = 19380.
    expect(row!.n_samples).toBe(20520);

    // Mean p50 with Kredarica in the pool (24.4778); the 17-station mean would be
    // 25.2594, so this assertion moves the moment Kredarica leaves the average.
    expect(row!.p50).toBeCloseTo(24.4778, 3);

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
