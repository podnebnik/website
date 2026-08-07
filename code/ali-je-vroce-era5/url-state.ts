// Shareable URL query-state for the ERA5 page (T-5.29, T-6.5 tier 0).
//
// Before this module the page encoded NOTHING in the URL — a reload always returned
// to national + device-today, and no reader could link anyone to a specific station
// or day. This adds exactly two query parameters, station and date, and nothing else
// (not the Okno window, not the variable selector — operator scope).
//
// ── The parameter KEYS are Slovenian, and they live HERE, not in i18n/sl.ts ──────
//
// `postaja` (station) and `dan` (date) are a WIRE PROTOCOL — the contract a shared
// link encodes — NOT display strings a reader sees. D-8 governs prose rendered on the
// page; a URL key is machine-facing and must stay byte-stable regardless of the UI
// language (a link shared today must still open the right view if the page ever gains
// an English locale). So they are plain constants here, deliberately outside the i18n
// catalogue.
//
// ── The VALUES are stable machine formats, never localised ───────────────────────
//
//   * station = the era5_name (station.name, api.ts:467) — the ASCII key with
//     underscores ("Murska_Sobota", "Ilirska_Bistrica"), NOT the diacritic display
//     label (T-5.27). era5_name is already the datasette wire format every fetch URL
//     filters on, so a renamed display label can never break an existing link.
//     Underscore is an RFC-3986 unreserved character, so these need no encoding; we
//     still route through URLSearchParams so any value round-trips correctly.
//   * date = an ISO `YYYY-MM-DD` (e.g. 2026-08-05), never an Intl sl-SI string — a
//     shared link must not depend on the reader's locale to parse.
//
// Both functions are pure and NEVER THROW: an unparseable input degrades to the
// default (null), because one unhandled throw at the island root blanks the whole
// page (T-5.56). The caller turns each null into its own default and lets the write
// path scrub the offending parameter back out of the URL.

export const PARAM_STATION = "postaja";
export const PARAM_DATE = "dan";

// The hero date picker's lower bound: the record start (TodayCard.tsx — 1950-01-01 is
// the disabled-prev cutoff and the calendar's clamp floor). Kept as one literal so the
// URL range and the picker range cannot drift.
export const RECORD_START = "1950-01-01";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface UrlState {
  station: string | null; // an era5_name, or null (absent / unknown → national default)
  date: string | null; // an ISO date in [RECORD_START, today], or null (absent / invalid)
}

// Validate-and-strip parse (Q2/Q3): return nulls for anything absent OR proven invalid
// against the live station list and the date bounds. Only what we can PROVE wrong is
// dropped; a parameter we do not own (utm_source, …) is never inspected here and is
// preserved by buildSearch. `today` is the upper date bound — clock.today(), which is
// VITE_PINNED_DATE offline, so the pin wins offline (T-1.2 / §6): a link dated after the
// pin degrades to the pinned today rather than breaking the offline preview.
export function parseUrlState(
  search: string,
  stationNames: readonly string[],
  today: string,
): UrlState {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { station: null, date: null };
  }

  const rawStation = params.get(PARAM_STATION);
  const station = rawStation != null && stationNames.includes(rawStation) ? rawStation : null;

  const rawDate = params.get(PARAM_DATE);
  const date = rawDate != null && isValidDate(rawDate, today) ? rawDate : null;

  return { station, date };
}

// Well-formed ISO, a real calendar day, and within [RECORD_START, today]. The
// round-trip re-serialisation rejects impossible dates the regex admits (2026-13-45 →
// Date normalises it to a different day → mismatch → invalid). `>` string compare is
// safe because both operands are zero-padded ISO.
function isValidDate(s: string, today: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  return s >= RECORD_START && s <= today;
}

// Rebuild the query string, mutating ONLY our two keys and PRESERVING every other
// parameter (Q2 — a utm_source is not ours to strip). National / null station → drop
// `postaja`; today's date → drop `dan`; so the default view (national + today) is a
// clean bare URL and only a non-default selection appears. `station` is the hero
// location: an era5_name, or the national sentinel / null → omitted.
export function buildSearch(
  search: string,
  station: string | null,
  nationalLoc: string,
  date: string | null,
  today: string,
): string {
  const params = new URLSearchParams(search);

  if (station && station !== nationalLoc) params.set(PARAM_STATION, station);
  else params.delete(PARAM_STATION);

  if (date && date !== today) params.set(PARAM_DATE, date);
  else params.delete(PARAM_DATE);

  const q = params.toString();
  return q ? `?${q}` : "";
}
