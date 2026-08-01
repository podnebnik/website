// All three DOY helpers now live in api.ts (a pure .ts module), so this test needs
// no DOM and runs under the default node environment. Until T-4.5 dateToDoy lived in
// AliJeVroceERA5.tsx and forced `@vitest-environment jsdom` (its Solid JSX transform
// calls delegateEvents() at load); moving it here removed that coupling.
import { describe, expect, it } from "vitest";

import { dateToDoy, monthDayToDoy, doyToMonthDay, MONTH_LEN } from "../../code/ali-je-vroce-era5/api.ts";

// T-4.5 — day-of-year conversions, AFTER the leap-year fix. The island now uses ONE
// convention: a FIXED non-leap 365-slot year, with 29 Feb folded into 28 Feb / DOY 59
// (D-12). All three helpers agree:
//
//   * dateToDoy    (calendar date → doy) reads the date's month/day in
//     Europe/Ljubljana and folds to the non-leap slot via monthDayToDoy — so it is
//     NO LONGER leap-aware: 1 March is doy 60 in both 2023 and 2024.
//   * monthDayToDoy(month, day) reads the same fixed non-leap day table, folding
//     29 Feb to 59.
//   * doyToMonthDay(doy) walks the fixed non-leap 2001 calendar (unchanged by T-4.5).
//
// Because the forward and inverse now share one calendar, the round-trip is exact:
// the panel's date → doy → month/day no longer lands one day late in a leap year.
// This INVERTS the T-3.4 fixture, which pinned the pre-fix bug (2024-03-01 analysed
// as 2 March). Every value is hand-computed from the calendar, never read back from
// the code.

describe("dateToDoy — non-leap forward conversion (T-4.5, folds via monthDayToDoy)", () => {
  it("maps 1 January to doy 1 in both leap and non-leap years", () => {
    expect(dateToDoy("2023-01-01")).toBe(1);
    expect(dateToDoy("2024-01-01")).toBe(1);
  });

  it("agrees with the non-leap table through 28 February", () => {
    // Jan 31 + Feb 28 = 59, identical in both years.
    expect(dateToDoy("2023-02-28")).toBe(59);
    expect(dateToDoy("2024-02-28")).toBe(59);
  });

  it("folds 29 February into DOY 59 (D-12), sharing 28 February's slot", () => {
    // No distinct leap-day bin: 29 Feb pools into the Feb 28 window.
    expect(dateToDoy("2024-02-29")).toBe(59);
  });

  it("keeps 1 March on doy 60 in BOTH leap and non-leap years (the fix)", () => {
    // Non-leap 2023 = 31 + 28 + 1 = 60; leap 2024 no longer shifts to 61 — the
    // non-leap table is used unconditionally.
    expect(dateToDoy("2023-03-01")).toBe(60);
    expect(dateToDoy("2024-03-01")).toBe(60);
  });

  it("counts the whole year as 365 slots in both leap and non-leap years", () => {
    expect(dateToDoy("2023-12-31")).toBe(365);
    expect(dateToDoy("2024-12-31")).toBe(365);
  });
});

describe("monthDayToDoy — fixed non-leap day table (no year, never shifts)", () => {
  it("maps 1 January to 1 and 31 December to 365", () => {
    expect(monthDayToDoy(1, 1)).toBe(1);
    expect(monthDayToDoy(12, 31)).toBe(365);
  });

  it("returns the non-leap doy for 1 March unconditionally", () => {
    // DAYS[2] = 59 (Jan 31 + Feb 28) + day 1 = 60.
    expect(monthDayToDoy(3, 1)).toBe(60);
  });

  it("maps 28 February to 59", () => {
    expect(monthDayToDoy(2, 28)).toBe(59);
  });

  it("folds 29 February into 59, the same slot as 28 February (D-12)", () => {
    // Without the fold this would be 31 + 29 = 60, colliding with 1 March.
    expect(monthDayToDoy(2, 29)).toBe(59);
  });
});

describe("doyToMonthDay — fixed non-leap 2001 inverse (fetchRegression's step)", () => {
  it("maps doy 60 to 1 March", () => {
    expect(doyToMonthDay(60)).toEqual({ month: 3, day: 1 });
  });

  it("maps doy 61 to 2 March", () => {
    expect(doyToMonthDay(61)).toEqual({ month: 3, day: 2 });
  });

  it("maps doy 1 to 1 January", () => {
    expect(doyToMonthDay(1)).toEqual({ month: 1, day: 1 });
  });
});

describe("FIXED round-trip (T-4.5): non-leap forward + non-leap inverse agree", () => {
  // The exact path the regression panel walks:
  //   defaultDoy = dateToDoy(date)   →   fetchRegression: doyToMonthDay(doy)
  // Pre-T-4.5 this landed leap years one day late; the T-1.1 witness (snapshot cases
  // ljubljana-leap-mar01 vs ljubljana-nonleap-mar01) reported +0.589 vs +0.585
  // °C/decade for what the reader is told is the same day. Now they resolve to the
  // same month/day.
  it("sends 2024-03-01 (leap) to 1 March — the off-by-one is gone", () => {
    const doy = dateToDoy("2024-03-01"); // 60
    expect(doyToMonthDay(doy)).toEqual({ month: 3, day: 1 });
  });

  it("keeps 2023-03-01 (non-leap) on 1 March — unchanged, still correct", () => {
    const doy = dateToDoy("2023-03-01"); // 60
    expect(doyToMonthDay(doy)).toEqual({ month: 3, day: 1 });
  });

  it("sends 2024-02-29 (leap day) to 28 February (D-12 fold)", () => {
    const doy = dateToDoy("2024-02-29"); // 59
    expect(doyToMonthDay(doy)).toEqual({ month: 2, day: 28 });
  });
});

// T-5.28 — the calendar picker sizes each month's day grid from MONTH_LEN and maps a
// clicked (month, day) straight through monthDayToDoy. These pin the two things the
// operator flagged: February must offer 29 days (and not error), and no month may
// offer a day it doesn't have (no "31 April"). Values hand-computed, not read back.
describe("MONTH_LEN — the picker's per-month day counts (T-5.28)", () => {
  it("is 12 months, February 29, summing to 366 (leap day selectable)", () => {
    expect(MONTH_LEN.length).toBe(12);
    expect(MONTH_LEN[1]).toBe(29);
    expect(MONTH_LEN.reduce((a, b) => a + b, 0)).toBe(366);
  });

  it("gives 30 days to April, June, September, November (no 31st offered)", () => {
    for (const m of [4, 6, 9, 11]) expect(MONTH_LEN[m - 1]).toBe(30);
  });

  it("every selectable (month, day) maps to a valid 1..365 DOY", () => {
    for (let m = 1; m <= 12; m++) {
      for (let day = 1; day <= MONTH_LEN[m - 1]!; day++) {
        const doy = monthDayToDoy(m, day);
        expect(doy).toBeGreaterThanOrEqual(1);
        expect(doy).toBeLessThanOrEqual(365);
      }
    }
  });

  it("selecting 29 February does not error and folds to DOY 59, like 28 February", () => {
    // The exact path a Feb-29 click walks: monthDayToDoy(calMonth=2, day=29).
    expect(monthDayToDoy(2, 29)).toBe(59);
    expect(monthDayToDoy(2, 28)).toBe(59);
  });
});
