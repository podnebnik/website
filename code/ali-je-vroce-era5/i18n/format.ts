// T-5.5 (D-8) — minimal, dependency-free i18n runtime for the Slovenian-only v1.
//
// D-8 is "Slovenian only for v1: extract strings to a parameterised catalogue; NO
// switcher, NO /en/ routing, NO hreflang". So this is deliberately NOT an i18n
// framework — it is one locale, one catalogue, and the three things the operator
// required for T-5.5: catalogue lookup with parameter interpolation, proper
// Slovenian plurals, and Slovenian number/date formatting so that no inflected
// form, number or date is ever built by string concatenation.
//
// No dependency is added: the plural categories come from the platform's own
// `Intl.PluralRules("sl")` (CLDR: one / two / few / other — the 1 / 2 / 3–4 / 5+
// paradigm), and numbers/dates from `Intl.NumberFormat`/`Intl.DateTimeFormat`
// under the `sl-SI` locale (decimal COMMA, "." thousands — operator decision,
// T-5.5).
//
// The message syntax is an ICU subset:
//   • "{name}"                                     → interpolate a parameter
//   • "{count, plural, one{…} two{…} few{…} other{…}}" → plural-select on `count`;
//     "#" inside a form renders the grouped integer. Forms may nest "{name}".

import { sl } from "./sl.ts";

export const LOCALE = "sl-SI";

const PR = new Intl.PluralRules("sl");

type Params = Record<string, string | number>;

// ── Number / date formatters ────────────────────────────────────────────────────

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(opts);
  let f = nfCache.get(key);
  if (!f) { f = new Intl.NumberFormat(LOCALE, opts); nfCache.set(key, f); }
  return f;
}

// The values these format are ALL currently published via `Number.prototype
// .toFixed`. `Intl.NumberFormat` rounds off the number's shortest decimal string
// and so can disagree with toFixed on the final digit (e.g. a 0.3549…-valued
// trend: toFixed(2) → "0.35", Intl → "0,36"). Pre-rounding through toFixed and
// then formatting the already-rounded value makes the switch to Slovenian
// separators VALUE-NEUTRAL — only the decimal comma, "." grouping and "−" glyph
// change, never a rounded figure (T-5.5; CLAUDE.md ground rule 2).
const preRound = (n: number, digits: number) => Number(n.toFixed(digits));

/** Fixed-decimal number in Slovenian formatting (decimal comma). */
export function fmtNum(n: number, digits = 1): string {
  return nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(preRound(n, digits));
}

/** Integer with Slovenian grouping (e.g. 18432 → "18.432"). */
export function fmtInt(n: number): string {
  return nf({ maximumFractionDigits: 0 }).format(preRound(n, 0));
}

/**
 * Signed fixed-decimal. `signDisplay:"always"` reproduces the old
 * `${n >= 0 ? "+" : ""}${n.toFixed(d)}` intent (a leading "+" on non-negative,
 * zero included) while the minus on negatives becomes the locale glyph — no sign
 * is ever concatenated by hand.
 */
export function fmtSigned(n: number, digits = 2): string {
  return nf({ minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "always" }).format(preRound(n, digits));
}

// ── The i18n boundary (D-8, refined T-5.28) ─────────────────────────────────────
// DATE and NUMBER formatting comes from `Intl` under the `sl-SI` locale (the
// helpers below and the `Intl.NumberFormat` cache above) — this is the SOLE source
// of every Slovenian month name, weekday, decimal comma and thousands separator on
// the page, and it is deliberate (T-5.5 operator decision). ALL OTHER Slovenian
// prose lives in `i18n/sl.ts`. So a month name generated here is NOT a D-8 bypass to
// be "fixed" by hand-typing it into the catalogue: doing that would create a second
// source of truth for the same twelve words, free to diverge with nothing comparing
// them (the failure D-18 and T-5.26 exist to prevent). Extend the locale surface by
// adding a helper HERE (one place, several callers), never by calling `Intl` inline
// in a component.

const dtMonthShort = new Intl.DateTimeFormat(LOCALE, { month: "short" });

/** Slovenian short month name for a 1..12 month, e.g. 7 → "jul.". */
export function fmtMonthShort(month: number): string {
  return dtMonthShort.format(new Date(2001, month - 1, 1));
}

const dtMonthLong = new Intl.DateTimeFormat(LOCALE, { month: "long" });

/** Slovenian full month name for a 1..12 month, e.g. 8 → "avgust". Slovenian
 * months are lowercase; capitalise for a heading with CSS, not string surgery. */
export function fmtMonthLong(month: number): string {
  return dtMonthLong.format(new Date(2001, month - 1, 1));
}

const dtShort = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });

/** Slovenian short date for a (month, day) pair, e.g. (7, 27) → "27. jul.". */
export function fmtMonthDay(month: number, day: number): string {
  // Year is arbitrary (2001, non-leap) — only month/day are rendered.
  return dtShort.format(new Date(2001, month - 1, day));
}

const dtShortYear = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });

/** Slovenian short date WITH the year, e.g. (8, 1, 1994) → "1. avg. 1994". The
 * real year is passed (not the 2001 stand-in of fmtMonthDay) so a leap day like
 * (2, 29, 2024) renders — the year is genuine and Intl formats it as a bare "1994"
 * (no thousands grouping for a year). */
export function fmtMonthDayYear(month: number, day: number, year: number): string {
  return dtShortYear.format(new Date(year, month - 1, day));
}

/** Slovenian short date for an ISO "YYYY-MM-DD" string, e.g. "2026-07-22" →
 * "22. jul. 2026". Parses the parts by hand (not `new Date(iso)`, which would apply a
 * UTC/local offset) and defers all formatting to fmtMonthDayYear (T-6.12). */
export function fmtIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fmtMonthDayYear(m!, d!, y!);
}

/** Slovenian short date for a day-of-year (1..365 on the 2001 non-leap calendar). */
export function fmtDoy(doy: number): string {
  const d = new Date(Date.UTC(2001, 0, 1));
  d.setUTCDate(d.getUTCDate() + doy - 1);
  return fmtMonthDay(d.getUTCMonth() + 1, d.getUTCDate());
}

// ── Message formatting (ICU subset) ─────────────────────────────────────────────

function readArg(str: string, start: number): { body: string; end: number } {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") { depth--; if (depth === 0) return { body: str.slice(start + 1, i), end: i }; }
  }
  throw new Error("i18n: unbalanced braces in message");
}

function parseForms(s: string): Record<string, string> {
  const forms: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i++;
    let j = i;
    while (j < s.length && s[j] !== "{") j++;
    if (j >= s.length) break;
    const kw = s.slice(i, j).trim();
    const { body, end } = readArg(s, j);
    if (kw) forms[kw] = body;
    i = end + 1;
  }
  return forms;
}

function renderArg(body: string, params: Params): string {
  const comma = body.indexOf(",");
  if (comma !== -1 && body.slice(comma + 1).trim().startsWith("plural")) {
    const name = body.slice(0, comma).trim();
    const formsStr = body.slice(comma + 1).trim().slice("plural".length).replace(/^\s*,\s*/, "");
    const n = Number(params[name] ?? 0);
    const forms = parseForms(formsStr);
    const chosen = forms[PR.select(n)] ?? forms.other ?? "";
    return interpolate(chosen.replace(/#/g, fmtInt(n)), params);
  }
  const key = body.trim();
  const v = params[key];
  return v === undefined ? `{${key}}` : String(v);
}

function interpolate(tpl: string, params: Params): string {
  let out = "", i = 0;
  while (i < tpl.length) {
    if (tpl[i] === "{") {
      const { body, end } = readArg(tpl, i);
      out += renderArg(body, params);
      i = end + 1;
    } else {
      out += tpl[i];
      i++;
    }
  }
  return out;
}

function lookup(key: string): string | undefined {
  let cur: unknown = sl;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * Translate a catalogue `key` (dotted path into `sl`), interpolating `params`.
 * Numbers meant for display must be pre-formatted with `fmtNum`/`fmtInt`/
 * `fmtSigned` by the caller (so precision is explicit); `{count, plural, …}`
 * blocks take the raw number as the parameter and render "#" via `fmtInt`.
 */
export function t(key: string, params: Params = {}): string {
  const tpl = lookup(key);
  if (tpl === undefined) {
    if (import.meta.env?.DEV) console.warn(`i18n: missing key "${key}"`);
    return key;
  }
  return interpolate(tpl, params);
}
