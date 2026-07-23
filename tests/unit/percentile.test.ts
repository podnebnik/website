import { describe, expect, it } from "vitest";

import {
  rankPercentile,
  categorizeArso,
  CAT_COLORS,
  type ComputedPercentiles,
} from "../../code/ali-je-vroce-era5/percentile.ts";

// T-3.4 — the salvaged percentile helpers (D-2/D-6). Nothing imports them yet;
// T-4.1 wires them into the display (honest band as headline, REAL empirical
// percentile as the detail figure). These pin the arithmetic first, so the T-4.1
// wiring inherits a checked implementation. Every expected value is hand-computed
// from the definition, never read back from the code.

describe("rankPercentile — % of the sorted sample lying STRICTLY below value", () => {
  const s = [10, 20, 30, 40, 50]; // n = 5

  it("returns 0 when nothing is below", () => {
    expect(rankPercentile(s, 10)).toBe(0); // 0/5  (10 is not < 10)
    expect(rankPercentile(s, 5)).toBe(0); // below the whole sample
  });

  it("returns 100 when the whole sample is below", () => {
    expect(rankPercentile(s, 55)).toBe(100); // 5/5
  });

  it("counts strictly-below and rounds to a percentage", () => {
    expect(rankPercentile(s, 30)).toBe(40); // {10,20}       -> 2/5 = 40
    expect(rankPercentile(s, 50)).toBe(80); // {10,20,30,40} -> 4/5 = 80
    expect(rankPercentile(s, 25)).toBe(40); // {10,20}       -> 2/5 = 40 (interpolated point)
  });

  it("treats equal values as NOT below (the rank is strict)", () => {
    const dup = [10, 20, 20, 20, 30]; // n = 5
    expect(rankPercentile(dup, 20)).toBe(20); // only {10} is < 20 -> 1/5 = 20
  });

  it("rounds half up through Math.round", () => {
    const eight = [1, 2, 3, 4, 5, 6, 7, 8]; // n = 8
    expect(rankPercentile(eight, 4)).toBe(38); // {1,2,3} -> 3/8 = 0.375 -> 37.5 -> 38
  });
});

describe("categorizeArso — category from p05/p20/p80/p95, plus the real rank", () => {
  // sorted sample chosen so every rank is an exact integer percent. The cutoffs
  // p10/p50 are deliberately NOT used by categorizeArso — only p05/p20/p80/p95.
  const p: ComputedPercentiles = {
    p05: 5,
    p10: 8,
    p20: 10,
    p50: 15,
    p80: 20,
    p95: 25,
    n_samples: 5,
    year_min: 1991,
    year_max: 2020,
    sorted: [5, 10, 15, 20, 25],
  };

  it("hell at or above p95 (inclusive)", () => {
    expect(categorizeArso(26, p)).toEqual({ category_key: "hell", percentile: 100, color: CAT_COLORS.hell });
    // 25 == p95 -> still hell; {5,10,15,20} below 25 -> 4/5 = 80.
    expect(categorizeArso(25, p)).toEqual({ category_key: "hell", percentile: 80, color: CAT_COLORS.hell });
  });

  it("hot in [p80, p95)", () => {
    // 20 == p80 -> hot; {5,10,15} below 20 -> 3/5 = 60.
    expect(categorizeArso(20, p)).toEqual({ category_key: "hot", percentile: 60, color: CAT_COLORS.hot });
  });

  it("nope in [p20, p80)", () => {
    // {5,10} below 12 -> 2/5 = 40.
    expect(categorizeArso(12, p)).toEqual({ category_key: "nope", percentile: 40, color: CAT_COLORS.nope });
  });

  it("cold in [p05, p20)", () => {
    // {5} below 6 -> 1/5 = 20.
    expect(categorizeArso(6, p)).toEqual({ category_key: "cold", percentile: 20, color: CAT_COLORS.cold });
  });

  it("freezing below p05", () => {
    // nothing below 3 -> 0.
    expect(categorizeArso(3, p)).toEqual({ category_key: "freezing", percentile: 0, color: CAT_COLORS.freezing });
  });

  it("keys the nope/cold boundary off p20 (inclusive lower), not p10", () => {
    expect(categorizeArso(10, p).category_key).toBe("nope"); // 10 == p20 -> nope
    expect(categorizeArso(9, p).category_key).toBe("cold"); // 9 < p20 but >= p05
  });
});
