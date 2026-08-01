// T-5.27 — station DISPLAY names (nominative, with Slovene diacritics), keyed on era5_name.
//
// WHY THIS MAP EXISTS — no column in the `stations` datasette table carries the
// nominative diacritic town name, so it has to be authored:
//   • `name`          is `era5_name` with underscores→spaces: ASCII, no diacritics
//                     ("Kocevje", "Ratece", "Domzale").
//   • `official_name` is the ARSO OBSERVING-STATION identity — a *different place* for
//                     several towns: "Nova Gorica"→"Bilje", "Murska Sobota"→"Rakičan",
//                     "Ljubljana"→"Ljubljana Bežigrad". Wrong for a location picker.
//   • `name_locative` is the locative case ("v Kočevju", "v Novi Gorici"): right town,
//                     wrong grammar, and cannot be mechanically de-inflected to nominative.
// Do NOT delete this map believing a column would do. Three sources — the T-5.27 ticket,
// D-26, and the step-1a audit — each stated `name` held the display name; the correction
// to `official_name` was wrong too. All of it survived scrutiny only because no consumer
// displayed a diacritic station until now: the chart titles read correctly solely because
// "Nova Gorica" happens to have no diacritics. Three wrong answers resting on a sample-data
// coincidence. The eventual proper home is a real `display_name` in build_stations'
// metadata dict (A3, PROGRESS 2026-08-01) — that needs a datasette rebuild + redeploy and
// a fixtures re-record, which is why it is not this ticket.
//
// COMPLETE ON PURPOSE — every one of the 18 stations is listed, including the 14 whose
// display name equals `name`, so a station added upstream without an entry here fails
// LOUDLY via displayNameFor() rather than silently rendering ASCII for one station nobody
// notices (same reasoning as the ensure-label fix, T-6.6b).
//
// "Novo mesto" — the lowercase "mesto" is CORRECT Slovene, not a typo. A multi-word
// settlement name capitalises only its first word unless a later word is itself a proper
// noun: "Murska Sobota" keeps its capital S because Sobota is a proper noun, while "mesto"
// (= town) is a common noun and stays lowercase. Do not "fix" it to "Novo Mesto".
//
// This file lives under i18n/ so the T-5.12 text-integrity guard (tests/unit/
// text-integrity.test.ts globs i18n/) scans these hand-authored diacritics for
// Cyrillic/Greek homoglyphs and invisible characters automatically — exactly the vector
// four pasted Slovenian proper nouns present.
export const STATION_DISPLAY_NAME: Readonly<Record<string, string>> = {
  Celje:            "Celje",
  Domzale:          "Domžale",
  Ilirska_Bistrica: "Ilirska Bistrica",
  Kocevje:          "Kočevje",
  Koper:            "Koper",
  Kranj:            "Kranj",
  Kredarica:        "Kredarica",
  Ljubljana:        "Ljubljana",
  Maribor:          "Maribor",
  Murska_Sobota:    "Murska Sobota",
  Nova_Gorica:      "Nova Gorica",
  Novo_Mesto:       "Novo mesto",
  Postojna:         "Postojna",
  Ptuj:             "Ptuj",
  Ratece:           "Rateče",
  Tolmin:           "Tolmin",
  Trbovlje:         "Trbovlje",
  Velenje:          "Velenje",
};

// Loud failure on an unknown station — never a silent ASCII fallback (condition 3).
export function displayNameFor(era5Name: string): string {
  const name = STATION_DISPLAY_NAME[era5Name];
  if (name === undefined) {
    throw new Error(
      `[T-5.27] no display name for station "${era5Name}". STATION_DISPLAY_NAME ` +
        `(i18n/station-names.ts) must list every era5_name — add it there (see the file ` +
        `comment on why no datasette column can supply it).`,
    );
  }
  return name;
}
