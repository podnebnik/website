// T-4.3a (D-4) — the ERA5 "today" boundary is Europe/Ljubljana, not UTC.
//
// This exercises calendarDateIn, the pure timezone conversion that today()'s
// production fallback calls (clock.ts). It is tested directly rather than through
// today() on purpose: vitest.config.ts sets VITE_PINNED_DATE=2026-07-21 for every
// unit test, so today() returns that pinned string via the override branch and
// never reaches the fallback under this harness. The timezone logic lives in
// calendarDateIn, so that is what the assertions pin.
//
// Every expectation is hand-computed from the UTC offset, never read back from
// the code (per the T-3.4 pattern). The window where a UTC read and a Ljubljana
// read disagree is one hour wide under CET (winter, +01:00) and two hours wide
// under CEST (summer, +02:00); both are covered. Against the OLD behaviour
// (`new Date().toISOString().slice(0,10)`, i.e. the UTC day) each of these cases
// returned the previous calendar day, so these assertions FAIL on the old code
// and PASS on the new — that is the point.
import { describe, expect, it } from "vitest";

import { calendarDateIn, LJUBLJANA_TZ } from "../../code/ali-je-vroce-era5/clock.ts";

const utcDate = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

describe("calendarDateIn — Europe/Ljubljana day boundary (T-4.3a, D-4)", () => {
  it("reads the CEST (+02:00) local date, not the UTC one, in the summer window", () => {
    // 2026-07-20 22:30 UTC = 2026-07-21 00:30 CEST (Ljubljana is UTC+2 in July).
    // Local calendar day is already the 21st; the UTC day is still the 20th.
    const instant = new Date("2026-07-20T22:30:00Z");
    expect(calendarDateIn(instant, LJUBLJANA_TZ)).toBe("2026-07-21");
    // Guard: this instant is inside the divergence window — UTC disagrees.
    expect(utcDate("2026-07-20T22:30:00Z")).toBe("2026-07-20");
  });

  it("reads the CET (+01:00) local date, not the UTC one, in the winter window", () => {
    // 2026-01-14 23:30 UTC = 2026-01-15 00:30 CET (Ljubljana is UTC+1 in January).
    // Local calendar day is the 15th; the UTC day is still the 14th.
    const instant = new Date("2026-01-14T23:30:00Z");
    expect(calendarDateIn(instant, LJUBLJANA_TZ)).toBe("2026-01-15");
    expect(utcDate("2026-01-14T23:30:00Z")).toBe("2026-01-14");
  });

  it("moves the year at the Ljubljana New Year boundary (the TropicalChart case)", () => {
    // 2025-12-31 23:30 UTC = 2026-01-01 00:30 CET. todayYear() derives from
    // today().slice(0,4), so on this instant the current-year bar highlight is
    // 2026 in Ljubljana while a UTC read would still say 2025.
    const instant = new Date("2025-12-31T23:30:00Z");
    expect(calendarDateIn(instant, LJUBLJANA_TZ)).toBe("2026-01-01");
    expect(utcDate("2025-12-31T23:30:00Z")).toBe("2025-12-31");
  });

  it("agrees with UTC outside the offset window (mid-day, both offsets)", () => {
    // No divergence away from local midnight: same calendar day either way.
    expect(calendarDateIn(new Date("2026-07-21T10:00:00Z"), LJUBLJANA_TZ)).toBe("2026-07-21");
    expect(calendarDateIn(new Date("2026-01-15T10:00:00Z"), LJUBLJANA_TZ)).toBe("2026-01-15");
  });
});
