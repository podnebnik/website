// T-5.21 / T-5.22 — the distribution-chart tooltip logic: the zone label and the
// "frequency line" (how many comparison days fall in the hovered whole-degree bin).
// Pure logic, split out of DistributionChart.tsx so it can be unit-tested without the
// solid/Highcharts import chain (CLAUDE.md: put pure logic in a helper and test the
// helper directly), and so the whole tooltip string is derived from a plain data
// object — the component formatter passes the CURRENT data at hover time (T-5.22 B).

import type { TodayStatus } from "../types.ts";
import { t, fmtNum, fmtInt } from "../i18n/format.ts";

// Bin width is a fixed 1 °C, NOT the served grid spacing: that spacing (≈0.13 °C) is a
// linspace(200) artefact, and a count per 0.13 °C would be a fraction of a day. The
// served curve is an empirical KDE (D-15) smoothed with a Scott-rule bandwidth of
// ≈0.9 °C, so 1 °C is about the finest bin the smoothing can actually resolve.
export const BIN_WIDTH = 1;

// Density is sampled at the FIXED bin centre (⌊temp⌋ + 0.5), so the count is constant
// across [b, b+1) and steps at each whole degree. This is deliberate: the within-bin
// curvature of the KDE is kernel shape, not resolvable data, so a count that slid
// smoothly with the cursor would display precision the smoothing already removed. Do
// NOT "fix" this by interpolating at the cursor value.
export function densityAt(dist: readonly [number, number][], x: number): number {
  const first = dist[0];
  const last  = dist[dist.length - 1];
  if (!first || !last || x <= first[0] || x >= last[0]) return 0;
  for (let i = 0; i < dist.length - 1; i++) {
    const a = dist[i]!;
    const b = dist[i + 1]!;
    if (a[0] <= x && x <= b[0]) {
      const f = (x - a[0]) / (b[0] - a[0]);
      return a[1] + f * (b[1] - a[1]);
    }
  }
  return 0;
}

// Estimated number of comparison days in the whole-degree bin containing `temp`:
// KDE density at the bin centre × 1 °C × the PER-STATION sample size. `perStationN`
// is `n_samples` on a single station; on the national view it is `n_samples ÷ station
// count`, because the national curve is the MEAN of the per-station densities while
// `n_samples` is their SUM — multiplying the mean density by the sum would yield
// station-days, not days (T-5.22; that was the shipped national bug). The count is
// read from the SOURCE density, independent of any Highcharts plotting transform.
export function binDays(
  dist: readonly [number, number][], temp: number, perStationN: number,
): number {
  return Math.round(densityAt(dist, Math.floor(temp) + 0.5) * BIN_WIDTH * perStationN);
}

// Loud guard against the class of bug T-5.22 fixed. The shipped national tooltip
// multiplied the mean-of-18 density by the SUM of 18 stations' samples, giving a peak
// of ~2023 "days" — impossible — yet it passed typecheck, tests, the snapshot (which
// stubs Highcharts) and review. It also would have passed a naive "count ≤ n_samples"
// check, since 2023 < Σn = 20520. So the physical anchor here is the PER-STATION
// ceiling (`nSamples / stationCount`), computed INDEPENDENTLY of the multiplier that
// binDays actually used: a per-station day-count in one bin cannot exceed the days
// sampled at a single station. Peak KDE density is ≈0.11 /°C, so a correct count sits
// ~9× below this ceiling — a 13×–18× inflation trips it with wide margin, while real
// data never comes close.
export function assertFrequencySane(
  dist: readonly [number, number][],
  perStationN: number,
  nSamples: number,
  stationCount: number,
): void {
  if (dist.length < 2) return;
  const ceiling = stationCount > 0 ? nSamples / stationCount : nSamples;
  if (ceiling <= 0) return;
  const loBin  = Math.floor(dist[0]![0]);
  const hiBin  = Math.floor(dist[dist.length - 1]![0]);
  const maxBin = Math.ceil(ceiling * 1.02);   // slack for rounding at the sample edge
  let total = 0;
  for (let b = loBin; b <= hiBin; b++) {
    const d = binDays(dist, b, perStationN);
    total += d;
    if (d > maxBin) {
      throw new Error(
        `[T-5.22] distribution frequency: bin [${b}, ${b + 1}) count ${d} exceeds the ` +
        `per-station sample ${Math.round(ceiling)} — the day-count multiplier is wrong ` +
        `(station-days leaking into a per-station count?)`,
      );
    }
  }
  // The integer-bin midpoint counts must sum to ≈ the per-station sample (the KDE
  // integrates to 1; verified 0.9995–0.9999 across stations and the national mean).
  if (total > Math.ceil(ceiling * 1.1)) {
    throw new Error(
      `[T-5.22] distribution frequency: bin day-counts sum to ${total}, exceeding the ` +
      `per-station sample ${Math.round(ceiling)} — the day-count multiplier is wrong`,
    );
  }
}

// Full tooltip HTML for the hovered temperature, derived ENTIRELY from `d`. The chart
// formatter calls this with the CURRENT data at hover time — never a mount-time capture
// — so both the zone label (from d.cutoffs) and the day-count (from d.distribution /
// d.n_samples / d.station_count) always match the location on screen. The pre-T-5.22
// formatter closed over the mount-time snapshot, so after a location switch it kept
// classifying against the FIRST location's cutoffs and counting against its curve — a
// defect that predated T-5.21 (the zone label) and that T-5.21's impossible count made
// visible. Returns "" when the data has no distribution/cutoffs yet.
export function distributionTooltipHtml(d: TodayStatus, temp: number): string {
  const c    = d.cutoffs;
  const dist = d.distribution;
  if (!c || !dist || dist.length < 2) return "";

  const zone =
    temp < c.p10 ? t("dist.zone_cold") :
    temp < c.p20 ? t("dist.zone_cool") :
    temp < c.p80 ? t("dist.zone_normal") :
    temp < c.p95 ? t("dist.zone_hot") : t("dist.zone_extreme");
  const line1 = t("dist.tooltip", { temp: fmtNum(temp, 1), zone });

  // Per-station: "približno N dni …". National (mean-of-stations curve): "povprečno N
  // dni na postajo …", dividing the summed n_samples by the station count so the figure
  // is a real day count, not station-days (T-5.22). See binDays for the rationale.
  const nSamples     = d.n_samples ?? 0;
  const stationCount = d.station_count ?? 1;
  const perStationN  = stationCount > 0 ? nSamples / stationCount : nSamples;
  const isNational   = stationCount > 1;
  const lo   = Math.floor(temp);
  const hi   = lo + 1;
  const days = binDays(dist, temp, perStationN);
  const line2 = days === 0
    ? t(isNational ? "dist.tooltip_freq_nat_lt1" : "dist.tooltip_freq_lt1",
        { lo: fmtInt(lo), hi: fmtInt(hi) })
    : t(isNational ? "dist.tooltip_freq_nat" : "dist.tooltip_freq",
        { count: days, lo: fmtInt(lo), hi: fmtInt(hi) });

  return `${line1}<br>${line2}`;
}
