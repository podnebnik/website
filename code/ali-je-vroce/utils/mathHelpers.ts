/**
 * Mathematical utility functions for chart components
 */

/**
 * Clamp a value between minimum and maximum bounds
 * @param value The value to clamp
 * @param min Minimum bound
 * @param max Maximum bound
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round a number to a specified number of decimal places
 * @param value The value to round
 * @param decimals Number of decimal places
 * @returns Rounded value
 */
export function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Convert a number to a zero-padded hexadecimal string
 * @param value Number to convert (0-255)
 * @returns Two-character hexadecimal string
 */
export function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

/**
 * Generate color based on value relative to min/max range using blue-to-red gradient
 * @param z Value to colorize
 * @param zmin Minimum value in range
 * @param zmax Maximum value in range
 * @returns Hex color string (e.g., "#ff0000")
 */
export function colorFor(z: number, zmin: number, zmax: number): string {
  if (!isFinite(z)) return "#aaaaaa";
  
  const mid = 0.5;
  const u = clamp((z - zmin) / (zmax - zmin || 1), 0, 1);
  let r: number, g: number, b: number;
  
  if (u <= mid) {
    // Blue to white gradient for lower half
    const k = u / mid;
    r = 0 + (240 - 0) * k;
    g = 70 + (240 - 70) * k;
    b = 170 + (240 - 170) * k;
  } else {
    // White to red gradient for upper half
    const k = (u - mid) / (1 - mid);
    r = 240 + (200 - 240) * k;
    g = 240 + (50 - 240) * k;
    b = 240 + (50 - 240) * k;
  }
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
