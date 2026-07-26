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

/**
 * The five category keys, in one place. Typing the lookup tables by this union
 * instead of `string` makes `CAT_COLORS.hell` a total lookup — `noUncheckedIndexedAccess`
 * only widens to `| undefined` for index signatures, not for a finite key set.
 */
export type CategoryKey = "hell" | "hot" | "nope" | "cold" | "freezing";

export const CAT_COLORS: Record<CategoryKey, string> = {
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
 * Empirical percentile of `value` as the CDF of a served KDE density curve —
 * the fraction of the distribution's mass at or below `value`, in [0, 100].
 *
 * This is T-4.1 / D-6 Option B: the honest percentile the today-card shows as its
 * detail figure, replacing `categorizeEra5`'s bucket midpoint (api.ts). `curve` is
 * the SAME `[x, density]` grid the distribution chart already draws — per-station a
 * scipy `gaussian_kde` on a 200-point linspace (precompute_datasette.py), national
 * the unweighted mean of the 18 station curves on a common grid (averageDistributions,
 * api.ts). Both are ascending in x. We trapezoid-integrate the density from the low
 * edge up to `value` and divide by the full integral, so the number equals what a
 * reader integrating the visible curve by eye would get — no normalisation needed,
 * since the two integrals share whatever mass the padded grid omits.
 *
 * Unlike `rankPercentile`, this needs no raw sorted sample (none is served); it
 * rides on the density already on the card. Guards: `value` at/below the grid's low
 * edge → 0, at/above the high edge → 100; result clamped to [0, 100]; a degenerate
 * curve (< 2 points or non-positive mass) → 0. Ranks against the 1991–2020 reference
 * that the KDE itself is built on (D-3).
 */
export function cdfPercentile(curve: [number, number][], value: number): number {
  const n = curve.length;
  if (n < 2) return 0;
  let total = 0;   // full integral over the grid
  let partial = 0; // integral from the low edge up to `value`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = curve[i]!;
    const [x1, y1] = curve[i + 1]!;
    const dx = x1 - x0;
    if (dx <= 0) continue; // non-increasing x — skip rather than integrate backwards
    total += ((y0 + y1) / 2) * dx;
    if (value >= x1) {
      partial += ((y0 + y1) / 2) * dx; // whole segment lies below `value`
    } else if (value > x0) {
      // segment straddles `value`: trapezoid from x0 to the interpolated point
      const yv = y0 + ((y1 - y0) * (value - x0)) / dx;
      partial += ((y0 + yv) / 2) * (value - x0);
    }
    // value <= x0 → this segment contributes nothing to `partial`
  }
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (partial / total) * 100));
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
