/**
 * Statistical utility functions for chart components
 */

/**
 * Calculate percentile from a sorted array of numbers
 * @param sortedAsc Array of numbers sorted in ascending order
 * @param p Percentile (0-100)
 * @returns Calculated percentile value or NaN if array is empty
 */
export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return NaN;
  const idx = (sortedAsc.length - 1) * (p / 100);
  const lo = Math.floor(idx),
    hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const w = idx - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

/**
 * Calculate linear regression coefficients for y = a + bx
 * @param xs Array of x values
 * @param ys Array of y values (must be same length as xs)
 * @returns Object with intercept (a) and slope (b) coefficients
 */
export function linreg(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (!n) return { a: 0, b: 0 };
  const sx = xs.reduce((s, v) => s + v, 0);
  const sy = ys.reduce((s, v) => s + v, 0);
  const sxx = xs.reduce((s, v) => s + v * v, 0);
  const sxy = xs.reduce((s, v, i) => s + v * ys[i]!, 0);
  const den = n * sxx - sx * sx;
  if (den === 0) return { a: sy / n, b: 0 };
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  return { a, b };
}

/**
 * Calculate arithmetic mean (average) of an array of numbers
 * @param a Array of numbers
 * @returns Mean value
 */
export function mean(a: number[]): number {
  return a.reduce((s, v) => s + v, 0) / a.length;
}

/**
 * Calculate sample standard deviation of an array of numbers
 * @param a Array of numbers
 * @returns Standard deviation
 */
export function stddev(a: number[]): number {
  const m = mean(a);
  const v = a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1);
  return Math.sqrt(v);
}

/**
 * Epanechnikov kernel function for kernel density estimation
 * @param u Normalized distance from center
 * @returns Kernel weight (0 if |u| >= 1, otherwise 0.75 * (1 - u²))
 */
export function epanechnikovKernel(u: number): number {
  return Math.abs(u) >= 1 ? 0 : 0.75 * (1 - u * u);
}
