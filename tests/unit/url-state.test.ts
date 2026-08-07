// T-5.29 — shareable URL query-state (?postaja=&dan=).
//
// The FEATURE has no automated coverage: the snapshot harness mounts leaf components
// directly and never mounts Dashboard, where the read/write wiring lives (harness.tsx:17
// documents this). These tests pin the one thing that CAN be tested in isolation — the
// pure parse/build logic in url-state.ts: validation, degradation, foreign-param
// preservation, and the default-strip round trip. Every expectation is hand-derived, not
// read back from the code (the T-3.4 pattern).
//
// `today` here is passed explicitly (2026-07-29, matching the unit-test pin), so these
// assertions do not depend on the clock; the offline-pin interaction is exercised by the
// "future relative to today" case.
import { describe, expect, it } from "vitest";

import {
  parseUrlState,
  buildSearch,
  PARAM_STATION,
  PARAM_DATE,
  RECORD_START,
} from "../../code/ali-je-vroce-era5/url-state.ts";

const STATIONS = [
  "Celje", "Domzale", "Ilirska_Bistrica", "Kocevje", "Koper", "Kranj", "Kredarica",
  "Ljubljana", "Maribor", "Murska_Sobota", "Nova_Gorica", "Novo_Mesto", "Postojna",
  "Ptuj", "Ratece", "Tolmin", "Trbovlje", "Velenje",
] as const;
const NATIONAL = "era5:national";
const TODAY = "2026-07-29";

describe("parseUrlState — validate-and-strip (Q2/Q3)", () => {
  it("accepts a known station and an in-range ISO date", () => {
    expect(parseUrlState("?postaja=Ljubljana&dan=2020-06-15", STATIONS, TODAY))
      .toEqual({ station: "Ljubljana", date: "2020-06-15" });
  });

  it("accepts an underscored era5_name verbatim (no encoding needed)", () => {
    expect(parseUrlState("?postaja=Murska_Sobota", STATIONS, TODAY).station).toBe("Murska_Sobota");
  });

  it("also accepts a percent-encoded underscore form (URLSearchParams decodes it)", () => {
    expect(parseUrlState("?postaja=Ilirska%5FBistrica", STATIONS, TODAY).station).toBe("Ilirska_Bistrica");
  });

  it("drops an unknown station → null (?postaja=Atlantis)", () => {
    expect(parseUrlState("?postaja=Atlantis", STATIONS, TODAY).station).toBeNull();
  });

  it("drops an impossible date → null (?dan=2026-13-45)", () => {
    expect(parseUrlState("?dan=2026-13-45", STATIONS, TODAY).date).toBeNull();
  });

  it("drops a well-formed date before the record start → null (?dan=1823-01-01)", () => {
    expect(parseUrlState("?dan=1823-01-01", STATIONS, TODAY).date).toBeNull();
  });

  it("drops a date in the future relative to `today` → null (?dan=2027-01-01)", () => {
    expect(parseUrlState("?dan=2027-01-01", STATIONS, TODAY).date).toBeNull();
  });

  it("treats the pinned `today` as the upper bound — a date past it degrades offline", () => {
    // Offline `today` is VITE_PINNED_DATE; a link dated after the pin is 'future' → null,
    // so the offline preview falls back to the pin rather than breaking (§6).
    expect(parseUrlState("?dan=2026-08-05", STATIONS, TODAY).date).toBeNull();
    // …and is honoured once `today` is real enough to contain it.
    expect(parseUrlState("?dan=2026-08-05", STATIONS, "2026-08-31").date).toBe("2026-08-05");
  });

  it("accepts the record-start boundary and today itself (inclusive bounds)", () => {
    expect(parseUrlState(`?dan=${RECORD_START}`, STATIONS, TODAY).date).toBe(RECORD_START);
    expect(parseUrlState(`?dan=${TODAY}`, STATIONS, TODAY).date).toBe(TODAY);
  });

  it("validates the two parameters independently — a bad date keeps a good station", () => {
    expect(parseUrlState("?postaja=Kredarica&dan=nonsense", STATIONS, TODAY))
      .toEqual({ station: "Kredarica", date: null });
  });

  it("returns nulls for an absent query string, and never throws", () => {
    expect(parseUrlState("", STATIONS, TODAY)).toEqual({ station: null, date: null });
  });
});

describe("buildSearch — canonical, default-stripping, foreign-preserving", () => {
  it("omits both params at the default state (national + today) → bare URL", () => {
    expect(buildSearch("", NATIONAL, NATIONAL, TODAY, TODAY)).toBe("");
  });

  it("omits postaja for the national sentinel and null", () => {
    expect(buildSearch("", NATIONAL, NATIONAL, null, TODAY)).toBe("");
    expect(buildSearch("", null, NATIONAL, null, TODAY)).toBe("");
  });

  it("writes a station and a non-today date", () => {
    expect(buildSearch("", "Ljubljana", NATIONAL, "2020-06-15", TODAY))
      .toBe(`?${PARAM_STATION}=Ljubljana&${PARAM_DATE}=2020-06-15`);
  });

  it("leaves an underscored era5_name unencoded", () => {
    expect(buildSearch("", "Murska_Sobota", NATIONAL, null, TODAY))
      .toBe(`?${PARAM_STATION}=Murska_Sobota`);
  });

  it("strips an invalid station we own but PRESERVES a foreign param (Q2)", () => {
    // The page degraded ?postaja=Atlantis to national → station=null → postaja dropped;
    // utm_source is not ours to touch and survives.
    expect(buildSearch("?postaja=Atlantis&utm_source=x", null, NATIONAL, null, TODAY))
      .toBe("?utm_source=x");
  });

  it("drops dan when the date equals today (self-correcting default)", () => {
    expect(buildSearch("?dan=2020-06-15", "Kredarica", NATIONAL, TODAY, TODAY))
      .toBe(`?${PARAM_STATION}=Kredarica`);
  });
});
