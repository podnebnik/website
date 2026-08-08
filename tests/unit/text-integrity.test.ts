/// <reference types="node" />
// T-5.12 — text-integrity guard for the Slovenian content seam.
//
// The finding this guards against: METHODOLOGY.md and the SHIPPED
// hero-content.ts both carried three Cyrillic homoglyphs — U+0435, U+043D,
// U+043E — inside the word "neuteženo". They render identically to Latin
// e/n/o, so they survived a full editorial review. Homoglyphs break Ctrl-F,
// corrupt screen-reader pronunciation (a Slovene SR may language-switch
// mid-word), and defeat text tooling — and human review structurally cannot
// catch them.
//
// This is a class, not an incident: i18n/sl.ts + hero-content.ts are the
// content-authoring seam (T-5.5/T-6.1), and content providers will keep pasting
// Slovenian prose into it from word processors, browsers and chat windows. So
// the guard GLOBS the i18n directory rather than hardcoding paths — a file added
// later is covered automatically.
//
// It fails on two classes:
//   (a) Cyrillic (U+0400–U+04FF) and Greek (U+0370–U+03FF) letters — the
//       homoglyph scripts.
//   (b) invisible / format characters: NBSP, soft hyphen, zero-width family,
//       directional marks, BOM — the same class of invisible defect.
//
// Legitimate non-Latin characters DO exist here (Kendall's tau, significance
// alpha), so a blanket ban would be wrong: see ALLOWLIST below. Every
// allowlisted codepoint carries a comment saying why it is permitted.
//
// NOTE: the constructed-fixture tests below use \u escapes, never pasted
// glyphs — the codepoint IS the assertion, and a literal homoglyph in this file
// would be exactly the invisible thing under test.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// --- Allowlist -------------------------------------------------------------
// Codepoints that are LEGITIMATE in this content seam. Each needs a reason.
// A new entry is a deliberate act: it says "this non-Latin character is meant
// to be here". Do NOT add Latin-look-alikes (Cyrillic a/e/o/c/p/x, Greek
// omicron/nu/alpha used as a word letter) — those are the exact bug this guard
// exists to catch.
const ALLOWLIST: ReadonlyMap<number, string> = new Map([
  // Kendall's tau (U+03C4) — the rank-correlation statistic shown in trend
  // labels (i18n/sl.ts trend footer, and api.ts fit_desc). A real Greek letter.
  [0x03c4, "Kendall's tau — rank-correlation statistic in trend labels"],
  // Significance level alpha (U+03B1) in the NB-GLM technical label (i18n/sl.ts).
  [0x03b1, "significance level alpha in the NB-GLM technical label"],
]);

// --- Detection -------------------------------------------------------------
type Suspect = { readonly codepoint: number; readonly reason: string };

// Invisible / format characters (class b). Fixed, finite set.
const INVISIBLE: ReadonlyMap<number, string> = new Map([
  [0x00a0, "NO-BREAK SPACE"],
  [0x00ad, "SOFT HYPHEN"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x200e, "LEFT-TO-RIGHT MARK"],
  [0x200f, "RIGHT-TO-LEFT MARK"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE (BOM)"],
]);

// Names for the codepoints we actually flag. The Cyrillic/Greek Latin
// look-alikes are enumerated; anything else in those blocks falls back to a
// block label — enough, with the codepoint and word, to fix by hand.
const NAMED: ReadonlyMap<number, string> = new Map<number, string>([
  ...INVISIBLE,
  [0x0430, "CYRILLIC SMALL LETTER A"],
  [0x0435, "CYRILLIC SMALL LETTER IE"],
  [0x043d, "CYRILLIC SMALL LETTER EN"],
  [0x043e, "CYRILLIC SMALL LETTER O"],
  [0x0440, "CYRILLIC SMALL LETTER ER"],
  [0x0441, "CYRILLIC SMALL LETTER ES"],
  [0x0443, "CYRILLIC SMALL LETTER U"],
  [0x0445, "CYRILLIC SMALL LETTER HA"],
  [0x0410, "CYRILLIC CAPITAL LETTER A"],
  [0x0415, "CYRILLIC CAPITAL LETTER IE"],
  [0x041e, "CYRILLIC CAPITAL LETTER O"],
  [0x0421, "CYRILLIC CAPITAL LETTER ES"],
  [0x03b1, "GREEK SMALL LETTER ALPHA"],
  [0x03bd, "GREEK SMALL LETTER NU"],
  [0x03bf, "GREEK SMALL LETTER OMICRON"],
  [0x03c1, "GREEK SMALL LETTER RHO"],
  [0x03c4, "GREEK SMALL LETTER TAU"],
]);

function hex(cp: number): string {
  return cp.toString(16).toUpperCase().padStart(4, "0");
}

function unicodeName(cp: number): string {
  const known = NAMED.get(cp);
  if (known) return known;
  if (cp >= 0x0400 && cp <= 0x04ff) return `CYRILLIC CHARACTER U+${hex(cp)}`;
  if (cp >= 0x0370 && cp <= 0x03ff) return `GREEK CHARACTER U+${hex(cp)}`;
  return `CHARACTER U+${hex(cp)}`;
}

function suspectAt(cp: number): Suspect | null {
  if (ALLOWLIST.has(cp)) return null;
  if (INVISIBLE.has(cp)) return { codepoint: cp, reason: "invisible/format character (class b)" };
  if (cp >= 0x0400 && cp <= 0x04ff) return { codepoint: cp, reason: "Cyrillic letter (class a)" };
  if (cp >= 0x0370 && cp <= 0x03ff) return { codepoint: cp, reason: "Greek letter (class a)" };
  return null;
}

function wordAround(line: string, idx: number): string {
  let start = idx;
  while (start > 0 && !/[\s"'`]/.test(line[start - 1]!)) start -= 1;
  let end = idx;
  while (end < line.length && !/[\s"'`]/.test(line[end]!)) end += 1;
  return line.slice(start, end);
}

type Finding = {
  readonly file: string;
  readonly line: number;
  readonly codepoint: number;
  readonly name: string;
  readonly reason: string;
  readonly word: string;
};

// Pure, exported-for-test: scan one file's text, return every suspect hit.
// This is the whole guard — the directory walk below just feeds it real files,
// and the fixture tests below feed it constructed homoglyphs to prove it fires.
export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Iterate by UTF-16 code unit; our target ranges are all in the BMP, so a
    // per-unit read gives the right codepoint and column for them.
    for (let j = 0; j < line.length; j++) {
      const cp = line.charCodeAt(j);
      const s = suspectAt(cp);
      if (s) {
        findings.push({
          file,
          line: i + 1,
          codepoint: cp,
          name: unicodeName(cp),
          reason: s.reason,
          word: wordAround(line, j),
        });
      }
    }
  }
  return findings;
}

function formatFinding(f: Finding): string {
  return `${f.file}:${f.line} — U+${hex(f.codepoint)} ${f.name} (${f.reason}) in word ${JSON.stringify(f.word)}`;
}

// --- The guard over the real content seam ----------------------------------
// Two seams now carry hand-authored Slovenian:
//   • code/ali-je-vroce-era5/i18n/*.ts(x) — the island's string catalogues.
//   • pages/*.md — standalone content pages. T-6.22 moved the methodology, glossary
//     and reference prose OUT of the i18n catalogues (hero-content.ts / glossary.ts /
//     references.ts, all deleted) and INTO pages/methodology.md + pages/glossary.md.
//     Without extending the glob here, that prose would have left its ONLY automated
//     homoglyph protection — the exact regression this guard exists to prevent.
// Both are GLOBBED (not hardcoded paths) so a file added later is covered automatically.
const I18N_DIR = fileURLToPath(new URL("../../code/ali-je-vroce-era5/i18n", import.meta.url));
const PAGES_DIR = fileURLToPath(new URL("../../pages", import.meta.url));

function i18nSourceFiles(): string[] {
  const i18n = readdirSync(I18N_DIR, { recursive: true })
    .map((e) => String(e))
    .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"))
    .map((p) => `${I18N_DIR}/${p}`);
  const pages = readdirSync(PAGES_DIR, { recursive: true })
    .map((e) => String(e))
    .filter((p) => p.endsWith(".md"))
    .map((p) => `${PAGES_DIR}/${p}`);
  return [...i18n, ...pages];
}

describe("text-integrity guard — Slovenian content seam (T-5.12)", () => {
  it("i18n directory is non-empty (guard has something to check)", () => {
    expect(i18nSourceFiles().length).toBeGreaterThan(0);
  });

  it("contains no Cyrillic/Greek homoglyphs or invisible characters (allowlist aside)", () => {
    const findings: Finding[] = [];
    for (const file of i18nSourceFiles()) {
      findings.push(...scanText(file, readFileSync(file, "utf-8")));
    }
    if (findings.length > 0) {
      throw new Error(
        `Text-integrity guard found ${findings.length} suspect character(s) in the Slovenian content seam.\n` +
          `If a character is legitimate (e.g. Kendall's tau), add its codepoint to ALLOWLIST in this file with a reason.\n` +
          findings.map(formatFinding).join("\n"),
      );
    }
    expect(findings).toEqual([]);
  });
});

// --- Proof the guard actually fires ----------------------------------------
// A guard never seen fail is not known to work. These feed scanText constructed
// homoglyph fixtures (\u escapes only) and assert it catches them — separately
// from the clean pass above.
describe("text-integrity guard -- fires on constructed homoglyphs (T-5.12)", () => {
  it("catches the exact Cyrillic homoglyphs from the neuteZeno bug this ticket fixed", () => {
    // The word is "neute" + Latin z-caron (\u017e, never flagged) + Cyrillic
    // ie-en-o (\u0435 \u043d \u043e) -- reproducing the shipped defect. Written
    // with \u escapes because the codepoints ARE the assertion; a pasted glyph
    // would be exactly the invisible thing under test.
    const poisoned = "intro: neute\u017e\u0435\u043d\u043e povprecje";
    const findings = scanText("fixture.ts", poisoned);
    expect(findings.map((f) => f.codepoint)).toEqual([0x0435, 0x043d, 0x043e]);
    expect(findings[0]!.name).toBe("CYRILLIC SMALL LETTER IE");
    expect(findings[0]!.word).toContain("neute");
    expect(findings[0]!.line).toBe(1);
  });

  it("catches an invisible character (NBSP)", () => {
    // A NO-BREAK SPACE (\u00a0) between two words on line 2.
    const findings = scanText("fixture.ts", "prva vrstica\ndan\u00a0dva");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.codepoint).toBe(0x00a0);
    expect(findings[0]!.name).toBe("NO-BREAK SPACE");
    expect(findings[0]!.line).toBe(2);
  });

  it("does NOT flag allowlisted Greek (tau, alpha) or Slovenian c/s/z carons", () => {
    // tau (\u03c4) and alpha (\u03b1) are allowlisted; the caron letters c/s/z
    // (\u010d \u0161 \u017e) are Latin Extended-A and never flagged; the middle
    // dot (\u00b7) is neither Cyrillic/Greek nor invisible.
    const clean = "foot: \u03c4 = {tau} \u00b7 \u03b1={alpha} \u010d\u0161\u017e najvi\u0161ja";
    expect(scanText("fixture.ts", clean)).toEqual([]);
  });
});
