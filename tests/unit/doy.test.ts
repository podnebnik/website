// @vitest-environment jsdom
//
// jsdom, not node: this file imports dateToDoy from AliJeVroceERA5.tsx, and that
// module's Solid JSX transform calls delegateEvents() at load, which needs a DOM.
// The charts (highcharts, leaflet) are behind lazy()/dynamic import, so importing
// the module only evaluates its top-level definitions — nothing renders.
import { describe, expect, it } from "vitest";

import { dateToDoy } from "../../code/ali-je-vroce-era5/AliJeVroceERA5.tsx";
import { monthDayToDoy, doyToMonthDay } from "../../code/ali-je-vroce-era5/api.ts";

// T-3.4 — day-of-year conversions, the machinery T-4.5 (the leap-year doy fix)
// will rework. Two conventions live in the island and DISAGREE at the leap-year
// boundary:
//
//   * dateToDoy (AliJeVroceERA5.tsx) parses the real calendar date, so it is
//     LEAP-AWARE — 1 March is doy 61 in 2024 but doy 60 in 2023.
//   * monthDayToDoy (api.ts) reads a FIXED non-leap day table, so it returns the
//     non-leap doy regardless of year — 1 March is always 60.
//   * doyToMonthDay (api.ts), which fetchRegression uses to turn the panel's doy
//     back into a month/day, walks a FIXED non-leap 2001 calendar.
//
// The panel feeds dateToDoy's leap-aware doy straight into doyToMonthDay's
// non-leap inverse, so for any day after 28 Feb IN A LEAP YEAR the round-trip
// lands one day late. T-1.1 froze this: 2024-03-01 is analysed as 2 March
// (snapshot cases ljubljana-leap-mar01 +0.589 vs ljubljana-nonleap-mar01 +0.585
// °C/decade).
//
// EVERYTHING BELOW ASSERTS THE CURRENT, KNOWN-BUGGY BEHAVIOUR. When T-4.5 fixes
// the conversion these expectations INVERT — that is the point: the fix must not
// pass silently. Every value is hand-computed from the calendar, never read back
// from the code.

describe("dateToDoy — leap-aware forward conversion (real calendar)", () => {
  it("maps 1 January to doy 1 in both leap and non-leap years", () => {
    expect(dateToDoy("2023-01-01")).toBe(1);
    expect(dateToDoy("2024-01-01")).toBe(1);
  });

  it("agrees with the non-leap table through 28 February", () => {
    // Jan 31 + Feb 28 = 59, identical in both years up to here.
    expect(dateToDoy("2023-02-28")).toBe(59);
    expect(dateToDoy("2024-02-28")).toBe(59);
  });

  it("gives 29 February its own doy 60 in a leap year", () => {
    // Jan 31 + Feb 29th day = 60.
    expect(dateToDoy("2024-02-29")).toBe(60);
  });

  it("SHIFTS every post-February day by +1 in a leap year (the bug's source)", () => {
    // 1 March: non-leap 2023 = 31 + 28 + 1 = 60; leap 2024 = 31 + 29 + 1 = 61.
    expect(dateToDoy("2023-03-01")).toBe(60);
    expect(dateToDoy("2024-03-01")).toBe(61);
  });

  it("counts the whole year (365 non-leap, 366 leap)", () => {
    expect(dateToDoy("2023-12-31")).toBe(365);
    expect(dateToDoy("2024-12-31")).toBe(366);
  });
});

describe("monthDayToDoy — fixed non-leap day table (no year, never shifts)", () => {
  it("maps 1 January to 1 and 31 December to 365", () => {
    expect(monthDayToDoy(1, 1)).toBe(1);
    expect(monthDayToDoy(12, 31)).toBe(365);
  });

  it("returns the NON-LEAP doy for 1 March unconditionally", () => {
    // DAYS[2] = 59 (Jan 31 + Feb 28) + day 1 = 60. There is no leap branch, so
    // unlike dateToDoy this never becomes 61 — the two disagree in a leap year.
    expect(monthDayToDoy(3, 1)).toBe(60);
  });

  it("maps 28 February to 59", () => {
    expect(monthDayToDoy(2, 28)).toBe(59);
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

describe("FROZEN BUG (T-1.1): leap-aware forward + non-leap inverse round-trip", () => {
  // This is the exact path the regression panel walks:
  //   defaultDoy = dateToDoy(date)   →   fetchRegression: doyToMonthDay(doy)
  // T-4.5 will fix it; when it does, THESE TWO ASSERTIONS FLIP.
  it("sends 2024-03-01 (leap) to 2 March — off by one, the pinned bug", () => {
    const doy = dateToDoy("2024-03-01"); // 61
    expect(doyToMonthDay(doy)).toEqual({ month: 3, day: 2 });
  });

  it("keeps 2023-03-01 (non-leap) on 1 March — correct, no shift", () => {
    const doy = dateToDoy("2023-03-01"); // 60
    expect(doyToMonthDay(doy)).toEqual({ month: 3, day: 1 });
  });
});
