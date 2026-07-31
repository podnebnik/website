import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  binDays,
  densityAt,
  assertFrequencySane,
  distributionTooltipHtml,
} from "../../code/ali-je-vroce-era5/charts/distribution-frequency.ts";
import type { TodayStatus } from "../../code/ali-je-vroce-era5/types.ts";

// T-5.22 — the distribution tooltip's "frequency line" once reported impossible
// counts on the national view: it multiplied the mean-of-18-stations density by the
// SUM of the 18 stations' samples (Σn = 20520), yielding station-days, not days — a
// peak of ~2021 and 1534 in a mid bin, both above the 1140-day sample. Nothing caught
// it: not typecheck, not the snapshot (it stubs Highcharts), not review. These tests
// exist so a recurrence fails LOUDLY here.
//
// The fixtures are the ACTUAL served [temp, density] curves + n_samples for 31 July
// (daily_window on stage), captured once. Per-station n = 1140; national n = Σ = 20520
// over 18 stations; the national curve is the unweighted mean of the 18 densities.
type Fixture = {
  n_samples: number;
  station_count?: number;
  dist: [number, number][];
};
const FIX = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./distribution-frequency.fixture.json", import.meta.url)),
    "utf-8",
  ),
) as Record<"Murska_Sobota" | "Ljubljana" | "national", Fixture>;

const peakBinTemp = (f: Fixture): number => {
  let best = f.dist[0]!;
  for (const p of f.dist) if (p[1] > best[1]) best = p;
  return best[0];
};

describe("binDays — reads the SOURCE density, not the plotted value", () => {
  it("per-station peak counts are physically plausible (≈ a few % of the sample)", () => {
    // Ljubljana peak ≈ 125 days, Murska Sobota peak ≈ 112 days (n = 1140).
    const lj = FIX.Ljubljana;
    const ms = FIX.Murska_Sobota;
    expect(binDays(lj.dist, peakBinTemp(lj), lj.n_samples)).toBe(125);
    expect(binDays(ms.dist, peakBinTemp(ms), ms.n_samples)).toBe(112);
  });

  it("Murska Sobota [28, 29) ≈ 94 days — the bin the ticket flagged", () => {
    // Ticket cited ~1534 here on the national view; the per-station truth is ~94.
    expect(binDays(FIX.Murska_Sobota.dist, 28.5, FIX.Murska_Sobota.n_samples)).toBe(94);
  });

  it("no comparison-day count can exceed the per-station sample", () => {
    for (const key of ["Murska_Sobota", "Ljubljana"] as const) {
      const f = FIX[key];
      const lo = Math.floor(f.dist[0]![0]);
      const hi = Math.floor(f.dist[f.dist.length - 1]![0]);
      for (let b = lo; b <= hi; b++) {
        expect(binDays(f.dist, b, f.n_samples)).toBeLessThanOrEqual(f.n_samples);
      }
    }
  });

  it("is constant within a whole-degree bin and steps at the boundary", () => {
    const f = FIX.Ljubljana;
    // same bin → identical count regardless of cursor position within it
    expect(binDays(f.dist, 24.0, f.n_samples)).toBe(binDays(f.dist, 24.9, f.n_samples));
    // both read the bin CENTRE (24.5), not the cursor
    expect(binDays(f.dist, 24.3, f.n_samples))
      .toBe(Math.round(densityAt(f.dist, 24.5) * f.n_samples));
  });
});

describe("national view — the T-5.22 bug and its fix (D-15)", () => {
  const nat = FIX.national;
  const stationCount = nat.station_count!;
  const perStationN = nat.n_samples / stationCount; // = 1140

  it("dividing by the station count yields a real per-station day count", () => {
    // peak ≈ 112 days per station (option a). Matches a single station's magnitude.
    expect(binDays(nat.dist, peakBinTemp(nat), perStationN)).toBe(112);
    expect(binDays(nat.dist, 28.5, perStationN)).toBe(85);
  });

  it("multiplying by Σn (the shipped bug) reproduces the impossible figures", () => {
    // These are exactly the numbers the ticket observed on stage.
    expect(binDays(nat.dist, 25.4, nat.n_samples)).toBe(2021);
    expect(binDays(nat.dist, 28.5, nat.n_samples)).toBe(1534);
  });
});

describe("assertFrequencySane — the loud guard that was missing", () => {
  it("passes for a correct per-station curve", () => {
    const f = FIX.Ljubljana;
    expect(() => assertFrequencySane(f.dist, f.n_samples, f.n_samples, 1)).not.toThrow();
  });

  it("passes for the FIXED national curve (multiplier ÷ station count)", () => {
    const nat = FIX.national;
    const perStationN = nat.n_samples / nat.station_count!;
    expect(() =>
      assertFrequencySane(nat.dist, perStationN, nat.n_samples, nat.station_count!),
    ).not.toThrow();
  });

  it("THROWS for the national units bug — Σn multiplier, station-days leaking in", () => {
    const nat = FIX.national;
    // The guard's ceiling (n / stationCount) is independent of the wrong multiplier,
    // so it catches this even though 2021 < Σn = 20520 (a naive "≤ n_samples" would not).
    expect(() =>
      assertFrequencySane(nat.dist, nat.n_samples, nat.n_samples, nat.station_count!),
    ).toThrow(/T-5\.22/);
  });

  it("is inert on empty or degenerate input", () => {
    expect(() => assertFrequencySane([], 100, 100, 1)).not.toThrow();
    expect(() => assertFrequencySane(FIX.Ljubljana.dist, 0, 0, 1)).not.toThrow();
  });
});

describe("distributionTooltipHtml — derives the WHOLE tooltip from the passed data (T-5.22 B)", () => {
  // The pre-existing bug: the formatter closed over mount-time cutoffs + distribution,
  // so after a location switch the zone label and count reflected the FIRST location.
  // This function takes the data as an argument, so the component can pass live data;
  // these tests prove the output tracks the argument, not any captured state.
  const asStatus = (f: Fixture, station_count: number): TodayStatus => ({
    available: true,
    n_samples: f.n_samples,
    station_count,
    distribution: f.dist,
    // Cutoffs chosen so 26 °C lands in a DIFFERENT zone per fixture, to catch a
    // frozen-cutoffs regression: "normal" for MS, "hot" for the tight-banded one.
    cutoffs: { p5: 10, p10: 15, p20: 18, p50: 24, p80: 30, p95: 34 },
  });

  it("zone label + count are computed from the argument's cutoffs and curve", () => {
    const ms = asStatus(FIX.Murska_Sobota, 1);
    const out = distributionTooltipHtml(ms, 26);
    // 26 < p80(30) → "Normalno"; count from MS curve at bin centre 26.5.
    expect(out).toContain("Normalno");
    expect(out).toContain(String(binDays(FIX.Murska_Sobota.dist, 26, FIX.Murska_Sobota.n_samples)));
  });

  it("switching the data object switches BOTH zone and count (no stale capture)", () => {
    const station = distributionTooltipHtml(asStatus(FIX.Ljubljana, 1), 26);
    const national = distributionTooltipHtml(asStatus(FIX.national, FIX.national.station_count!), 26);
    // Per-station form vs national "na postajo" form — different by data alone.
    expect(station).toContain("s temperaturo med 26 in 27 °C");
    expect(station).not.toContain("na postajo");
    expect(national).toContain("na postajo");
    // And the national count is the per-station-divided figure, never station-days.
    const perN = FIX.national.n_samples / FIX.national.station_count!;
    expect(national).toContain(String(binDays(FIX.national.dist, 26, perN)));
    expect(national).not.toContain("2021");
    expect(national).not.toContain("1534");
  });

  it("returns empty string when the data has no distribution/cutoffs yet", () => {
    expect(distributionTooltipHtml({ available: false }, 26)).toBe("");
  });
});
