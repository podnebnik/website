// T-5.47 — the ONE source of truth for the elevation-band colours, thresholds and
// keys, shared by three consumers: the floating chooser dots + the station tags
// (RegressionPanel.tsx) and the methodology legend table (MethodologyPanel.tsx).
//
// ⚠ StationMap.tsx:12-17 (`elevColor`) holds a DEAD DUPLICATE of these thresholds and
// colours. It is intentionally NOT edited — T-5.46 hid the map but kept it revivable,
// so its self-contained palette must stay untouched. As of T-5.47 the two DIVERGE:
// this file's `foothill` is #867c70, StationMap's is still #c8b97a. That divergence is
// DELIBERATE — the foothill tan (#c8b97a) collapsed against the mountain sage (#a3c4a0)
// under deuteranopia (Machado 2009 sim distance 39.1, every other pair ≥69.8), and the
// chooser is the one site where the dot is the sole encoding (no metres, no tooltip),
// so it had to be fixed HERE. #867c70 clears every pair ≥69.8. Do NOT "resync" the two
// files — reviving the map is a separate decision that would revisit its whole palette.
//
// Thresholds match StationMap's strict `>` ladder exactly (>1500 / >800 / >400 / else),
// same convention as the tropical-day `>` in D-13.

export type BandKey = "alpine" | "mountain" | "foothill" | "lowland";

export interface Band {
  readonly key:   BandKey;
  readonly min:   number;   // metres; a station is in this band when elevation > min
  readonly color: string;   // fill for the dot / swatch
}

// High → low, so `.find(elev > min)` picks the first (highest) matching band, and the
// methodology table renders top-to-bottom.
export const ELEV_BANDS: readonly Band[] = [
  { key: "alpine",   min: 1500, color: "#7bafd4" },
  { key: "mountain", min: 800,  color: "#a3c4a0" },
  { key: "foothill", min: 400,  color: "#867c70" },  // T-5.47 CHANGE 1 (was #c8b97a)
  { key: "lowland",  min: 0,    color: "#c25a2c" },
] as const;

export function bandOf(elevation: number): Band {
  return ELEV_BANDS.find(b => elevation > b.min) ?? ELEV_BANDS[ELEV_BANDS.length - 1]!;
}

export function bandColor(elevation: number): string {
  return bandOf(elevation).color;
}

export function bandKey(elevation: number): BandKey {
  return bandOf(elevation).key;
}
