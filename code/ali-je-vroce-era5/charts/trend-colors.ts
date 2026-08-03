// T-5.51 (E1) — the single source for the year-round trend palette, shared by the
// chart bars (`barColor`, YearRoundChart) and the legend swatches (`swatchColors`,
// RegressionPanel). These MUST NOT be duplicated: a second copy would let the legend
// and the bars drift apart — the exact contradiction T-5.51e removes, where the legend
// said warming/cooling while the precipitation bars were already blue/amber. Both
// surfaces read these constants, so the words follow the colours by construction.
//
// Colour semantics, verified against `barColor` (trend10 >= 0 → pos, < 0 → neg):
//   temperature     red   = warming (pos)   ·  blue  = cooling (neg)
//   precip / ET₀     blue  = more    (pos)   ·  amber = less    (neg)
// Red never appears for precipitation or ET₀.
const IS_PRECIP = new Set(["precipitation_sum", "et0_evapotranspiration"]);

const POS_TEMP   = [210, 55,  35] as const;  // red   — warming
const NEG_TEMP   = [35,  90,  210] as const; // blue  — cooling
const POS_PRECIP = [35,  100, 210] as const; // blue  — more (wetter / greater drying power)
const NEG_PRECIP = [180, 105, 25] as const;  // amber — less (drier / lower drying power)

type RGB = readonly [number, number, number];

/** The (positive-trend, negative-trend) colour pair for a variable. */
function trendPair(variable: string): { pos: RGB; neg: RGB } {
  return IS_PRECIP.has(variable)
    ? { pos: POS_PRECIP, neg: NEG_PRECIP }
    : { pos: POS_TEMP,   neg: NEG_TEMP };
}

/** Per-bar colour: sign of the trend picks pos/neg, significance sets the alpha. */
export function barColor(trend10: number, p_val: number, variable: string): string {
  const { pos, neg } = trendPair(variable);
  const [r, g, b] = trend10 >= 0 ? pos : neg;
  const alpha = p_val < 0.001 ? 0.95 : p_val < 0.01 ? 0.70 : p_val < 0.05 ? 0.40 : 0.12;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Legend swatch colours (opaque) for a variable — the SAME palette the bars use. */
export function swatchColors(variable: string): { pos: string; neg: string } {
  const rgba = ([r, g, b]: RGB) => `rgba(${r},${g},${b},0.9)`;
  const { pos, neg } = trendPair(variable);
  return { pos: rgba(pos), neg: rgba(neg) };
}
