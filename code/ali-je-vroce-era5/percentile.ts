// Empirical percentile ranking + category assignment.
//
// SALVAGED, NOT YET WIRED. `rankPercentile` and `categorizeArso` were extracted
// verbatim from the ARSO/Vremenar path deleted under D-2 (T-2.2); they lived at
// `api.ts:154-162,194-201` before that deletion and are recoverable in full from
// commit `e81e462`.
//
// Why they were kept when the rest of that path was not: this is the CORRECT
// implementation of the thing D-6 says the page currently gets wrong. The live
// ERA5 path (`categorizeEra5`, api.ts) assigns a fixed BUCKET MIDPOINT as the
// percentile — every day above p95 displays as "98. percentil", so a 96th- and a
// 99.9th-percentile day are indistinguishable. `rankPercentile` computes the real
// empirical rank against the reference sample instead.
//
// `categorizeArso` keeps its historical name so it stays greppable against D-2,
// D-6 and AUDIT §4.1; there is nothing ARSO-specific left in it. It is the pairing
// of the SAME five category cutoffs the live path uses with a real rank rather
// than a midpoint.
//
//   >>> T-4.1 (D-6) is where this gets wired into the display: honest band as the
//   >>> headline, real empirical percentile as the detail figure, ranked against
//   >>> the 1991-2020 reference (D-3). Until then NOTHING IMPORTS the two
//   >>> functions below, deliberately — T-2.2 is a Phase 2 ticket and must not
//   >>> move a snapshot value. Only CAT_COLORS is consumed today (by api.ts).
//
// Note for T-4.1: `ComputedPercentiles` is the shape the deleted ARSO path built
// from a pooled +/-7-day window of raw daily observations. Nothing constructs it
// any more — the datasette serves `daily_window` rows (p5..p95 plus a
// `distribution_json` curve) but NOT the underlying sorted sample that
// `rankPercentile` needs. Sourcing that sample is part of T-4.1, not of this
// extraction.

export const CAT_COLORS: Record<string, string> = {
  hell:     "#962c1a",
  hot:      "#c25a2c",
  nope:     "#e7d9b8",
  cold:     "#6c8fb6",
  freezing: "#3a5a8a",
};

/** A reference climatology for one calendar day: cutoffs plus the sorted sample. */
export interface ComputedPercentiles {
  p05: number; p10: number; p20: number; p50: number; p80: number; p95: number;
  n_samples: number; year_min: number; year_max: number;
  sorted: number[];
}

/**
 * Binary-search rank: the percentage of `sorted` lying strictly below `value`.
 * `sorted` must be ascending. Returns 0-100, rounded.
 */
export function rankPercentile(sorted: number[], value: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}

/**
 * Category + REAL empirical percentile for `temp` against the reference `p`.
 * Contrast `categorizeEra5` (api.ts), which returns a bucket midpoint.
 */
export function categorizeArso(temp: number, p: ComputedPercentiles): { category_key: string; percentile: number; color: string } {
  const category_key =
    temp >= p.p95 ? "hell"     :
    temp >= p.p80 ? "hot"      :
    temp >= p.p20 ? "nope"     :
    temp >= p.p05 ? "cold"     : "freezing";
  return { category_key, percentile: rankPercentile(p.sorted, temp), color: CAT_COLORS[category_key] };
}
