// T-5.32 — the HERO date picker (TodayCard) selects a real dated day, so its grid must
// size February by the YEAR: 29 days only in leap years. Unlike the yearless DOY picker
// (T-5.28, which always offers 29 Feb via MONTH_LEN), this is the year-aware count from
// daysInMonth. A pure .ts export, so no Solid island is mounted here. Every value is
// hand-computed from the Gregorian calendar, never read back from the code.
import { describe, expect, it } from "vitest";

import { daysInMonth } from "../../code/ali-je-vroce-era5/api.ts";

describe("daysInMonth — year-aware month length for the hero picker (T-5.32)", () => {
  it("gives February 29 days in a leap year and 28 in a common year", () => {
    expect(daysInMonth(2024, 2)).toBe(29); // divisible by 4, not by 100 → leap
    expect(daysInMonth(2023, 2)).toBe(28); // common year → NO 29 Feb offered
  });

  it("handles the century leap-year rule (÷100 not leap, ÷400 leap)", () => {
    expect(daysInMonth(1900, 2)).toBe(28); // ÷100, not ÷400 → common
    expect(daysInMonth(2000, 2)).toBe(29); // ÷400 → leap
  });

  it("gives 30 days to April, June, September, November (no 31st offered)", () => {
    for (const y of [1950, 1994, 2026]) {
      for (const m of [4, 6, 9, 11]) expect(daysInMonth(y, m)).toBe(30);
    }
  });

  it("gives 31 days to the long months, in any year", () => {
    for (const y of [1950, 2026]) {
      for (const m of [1, 3, 5, 7, 8, 10, 12]) expect(daysInMonth(y, m)).toBe(31);
    }
  });

  it("sums to 366 in a leap year and 365 in a common year", () => {
    const sum = (y: number) => Array.from({ length: 12 }, (_, i) => daysInMonth(y, i + 1)).reduce((a, b) => a + b, 0);
    expect(sum(2024)).toBe(366);
    expect(sum(2023)).toBe(365);
  });

  it("matches the record bounds' years (1950 and 2026 both handled)", () => {
    // The picker's real range is 1950-01-01 .. device-today; February at both ends:
    expect(daysInMonth(1950, 2)).toBe(28); // common
    expect(daysInMonth(2026, 2)).toBe(28); // common
  });
});
