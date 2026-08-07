// T-6.8 (D-8) — the reference catalogue for the "Ali je vroče" ERA5 methodology.
//
// The methodology (hero-content.ts `methodologyMarkdown`) makes claims that rest
// on external standards, datasets and methods — ERA5-Land, the WMO 1991–2020
// normal, the ETCCDI/ECA&D thresholds, the 6,5 °C/km lapse rate, SPEI. The whole
// argument of the page is "we are open about our method"; without sources that is
// an assertion rather than something a reader can verify. This catalogue supplies
// the sources; the prose carries numbered [n] markers that link to them, rendered
// by components/ReferencesPanel.tsx as a third <details> sibling below the
// glossary — the same `.methodology-*` disclosure treatment.
//
// Every URL and title here was verified by the operator before build (T-6.8
// Step 1). They were TYPED, never pasted — the content seam where T-5.12's
// Cyrillic homoglyphs entered — and the text-integrity guard (T-5.12) globs this
// directory, so this file is scanned on every `yarn test`.
//
// ── i18n / l10n SHAPE (operator requirement) ──────────────────────────────────
// Structurally parallel to i18n/glossary.ts: an object keyed by a LANGUAGE-NEUTRAL,
// ASCII identifier (`era5_land_dataset`, `wmo_normals`, `spei`) — NEVER a number
// and NEVER the Slovenian text. `desc` (the plain-Slovenian one-liner) is a
// catalogue VALUE a second locale would swap; `cite` (author/issuer, year, title —
// mostly proper nouns) and `url` are the language-neutral citation data. The
// component hardcodes none of it.
//
// ── NUMBERING IS ASSIGNED AT RENDER TIME, NOT HERE ────────────────────────────
// The display number [n] is NOT encoded in this object and NOT in the prose
// markers (which carry the KEY: `[[ref:era5_land_dataset]]`). `orderedRefKeys`
// scans `methodologyMarkdown` for markers in first-appearance order; `refNumber`
// turns a key into its 1-based number. So the number a reader sees is derived from
// where the marker sits in the prose — inserting a reference later renumbers
// everything after it automatically, with no hand-editing of numbers anywhere.
//
// A key present here but NOT cited by any marker simply does not render (see
// theil_sen / yue_wang below).

import { methodologyMarkdown } from "./hero-content.ts";

export type ReferenceEntry = {
  readonly desc: string; // plain-Slovenian one-liner (a locale VALUE)
  readonly cite: string; // author/issuer, year, title/journal — the linked text
  readonly url: string; // the link a reader can actually follow
  readonly note?: string; // optional short annotation (access status, period) — a locale VALUE
};

export const references: Record<string, ReferenceEntry> = {
  era5_land_dataset: {
    desc: "Podatkovni niz, iz katerega stran zajema vse temperaturne vrednosti.",
    cite: "ERA5-Land hourly data from 1950 to present — Copernicus Climate Change Service (C3S) / ECMWF",
    url: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
  },
  era5_land_paper: {
    desc: "Znanstveni članek, ki opisuje reanalizo ERA5-Land in njeno izdelavo.",
    cite: "Muñoz-Sabater in sod. (2021), Earth System Science Data 13, 4349–4383",
    url: "https://doi.org/10.5194/essd-13-4349-2021",
  },
  hersbach_era5: {
    desc: "Matična reanaliza ERA5 — opis metode, asimilacije opazovanj in ločljivosti.",
    cite: "Hersbach et al. (2020), Quarterly Journal of the Royal Meteorological Society",
    url: "https://rmets.onlinelibrary.wiley.com/doi/10.1002/qj.3803",
    note: "Odprt dostop.",
  },
  open_meteo: {
    desc: "Arhivski spletni vmesnik, prek katerega stran dostopa do podatkov ERA5-Land.",
    cite: "Zippenfenig, P. (2023), Open-Meteo.com Weather API, Zenodo",
    url: "https://doi.org/10.5281/zenodo.7970649",
  },
  lapse_rate: {
    desc: "Standardna stopnja ohlajanja ozračja z višino (6,5 °C/km), kot jo določa standardna atmosfera (formalno ISO 2533 oziroma ICAO).",
    cite: "Glossary of Meteorology: »standard atmosphere« — American Meteorological Society",
    url: "https://glossary.ametsoc.org/wiki/Standard_atmosphere",
  },
  wmo_normals: {
    desc: "Smernice za izračun 30-letnih klimatoloških normal (npr. 1991–2020).",
    cite: "WMO Guidelines on the Calculation of Climate Normals (WMO-No. 1203, 2017)",
    url: "https://library.wmo.int/viewer/55797",
  },
  spei: {
    desc: "Izvirni članek, ki uvaja indeks suše SPEI.",
    cite: "Vicente-Serrano, Beguería & López-Moreno (2010), Journal of Climate 23, 1696–1718",
    url: "https://doi.org/10.1175/2009JCLI2909.1",
  },
  fao56: {
    desc: "Smernice za izračun referenčne evapotranspiracije (ET₀), ki vstopa v vodno bilanco indeksa SPEI.",
    cite: "Allen, Pereira, Raes & Smith (1998), FAO Irrigation and Drainage Paper 56",
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
  },
  etccdi: {
    desc: "Pregled mednarodno poenotenih kazalnikov podnebnih skrajnosti.",
    cite: "Zhang in sod. (2011), WIREs Climate Change 2, 851–870",
    url: "https://doi.org/10.1002/wcc.147",
  },
  ecad: {
    desc: "Slovar kazalnikov z natančnimi definicijami in pragovi (vroči dnevi, tropske noči).",
    cite: "ECA&D — Indices dictionary",
    url: "https://www.ecad.eu/indicesextremes/indicesdictionary.php",
  },
  wmo_c3s_esotc: {
    desc: "Evropa se segreva približno dvakrat hitreje od svetovnega povprečja.",
    cite: "WMO & Copernicus, European State of the Climate (2022)",
    url: "https://climate.copernicus.eu/copernicus-temperatures-europe-increase-more-twice-global-average-europe-presents-live-picture",
    note: "Obdobje 1991–2021.",
  },

  // ── HELD — no marker in the prose yet (T-6.8 finding 2) ──────────────────────
  // The methodology explains the NB-GLM count trend but says NOTHING about the
  // Theil-Sen slope + Mann-Kendall significance that drive the regression panel
  // and the year-round calendar — the page's headline number. The operator is
  // writing that sentence; until it ships (with `[[ref:theil_sen]]` and
  // `[[ref:yue_wang]]` at the new claim site), these two keys carry no marker, so
  // `orderedRefKeys` omits them and they do NOT render or take a number. They live
  // here, verified and ready, so lighting them up is only adding two markers.
  //
  // ⚠ yue_wang cites Yue & Wang (2004) — the effective-sample-size variance
  // correction the code actually runs (pymannkendall.yue_wang_modification_test).
  // T-5.62 removed the earlier "Yue-Wang TFPW" mislabel from reg.explain_reg; the
  // footer now reads "Yue-Wang Mann-Kendall". Do NOT reintroduce "TFPW" — that is a
  // DIFFERENT method (trend-free pre-whitening, Yue/Pilon/Phinney/Cavadias 2002)
  // that this pipeline never ran.
  theil_sen: {
    desc: "Izvirni članek o Theil-Senovi oceni naklona trenda.",
    cite: "Sen, P. K. (1968), Journal of the American Statistical Association 63, 1379–1389",
    url: "https://doi.org/10.1080/01621459.1968.10480934",
  },
  yue_wang: {
    desc: "Popravek Mann-Kendallovega testa za avtokorelacijo z efektivno velikostjo vzorca.",
    cite: "Yue, S. & Wang, C. (2004), Water Resources Management 18, 201–218",
    url: "https://doi.org/10.1023/B:WARM.0000043140.61082.60",
  },
} as const;

// Marker syntax in the prose: `[[ref:<key>]]`. Scanned in first-appearance order,
// deduped (a source cited twice keeps its first number). Only keys that exist in
// the catalogue are admitted, so an unknown marker silently no-ops rather than
// numbering a hole.
const MARKER_RE = /\[\[ref:([a-z0-9_]+)\]\]/g;

export function orderedRefKeys(md: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of md.matchAll(MARKER_RE)) {
    const key = m[1];
    if (key && references[key] && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

// Computed once — the document is static. Both MethodologyPanel (marker rendering)
// and ReferencesPanel (the list) read this, so the [n] on a marker and the [n] in
// the list are the same derivation and cannot drift apart.
export const REF_ORDER: readonly string[] = orderedRefKeys(methodologyMarkdown);

/** 1-based display number for a reference key, or null if it is not cited. */
export function refNumber(key: string): number | null {
  const i = REF_ORDER.indexOf(key);
  return i === -1 ? null : i + 1;
}
