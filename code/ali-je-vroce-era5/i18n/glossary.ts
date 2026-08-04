// T-6.14 (D-8) — the glossary term catalogue for the "Ali je vroče" ERA5 island.
//
// Companion to the methodology panel (MethodologyPanel.tsx / hero-content.ts):
// the methodology explains HOW the numbers are made; this glossary defines the
// TERMS a layperson cannot be expected to know (reanaliza, percentil, KDE,
// Theil-Sen, SPEI, lapse-rate, …). Rendered by components/GlossaryPanel.tsx as a
// <dl> inside a <details>, the same disclosure treatment as the methodology.
//
// Slovenian only for v1 (D-8). Wording is the operator's, reviewed and supplied
// VERBATIM (T-6.14 Step 2); the definitions are condensed from the page's own
// reviewed prose where it explains a term, and written from the operator's own
// source where the page does not.
//
// ── i18n / l10n SHAPE (operator requirement) ──────────────────────────────────
// Structurally parallel to i18n/sl.ts: an object keyed by a LANGUAGE-NEUTRAL,
// ASCII identifier (`era5_land`, `theil_sen`, `stat_significance`) — NEVER the
// Slovenian term itself. Both the displayed `term` and its `def` are catalogue
// VALUES: a second locale swaps `term` + `def` and keeps every key. The
// component hardcodes neither.
//
// ── DISPLAY ORDER ─────────────────────────────────────────────────────────────
// The display order is NOT encoded here. GlossaryPanel.tsx sorts at render time
// with `Intl.Collator(LOCALE)` on the `term` label (LOCALE = "sl-SI", the SOLE
// locale boundary in i18n/format.ts), so Slovenian collation places č/š/ž
// correctly and the order follows whatever locale renders — a hardcoded
// alphabetical array would be wrong under translation. This object's own key
// order is therefore irrelevant to the page; it is grouped acronyms-then-concepts
// only for a human reading the source.

export type GlossaryEntry = { readonly term: string; readonly def: string };

export const glossary: Record<string, GlossaryEntry> = {
  // ── Acronyms / named identifiers ──────────────────────────────────────────
  era5_land: {
    term: "ERA5-Land",
    def: "Podatkovni niz, ki za vsak košček ozemlja in vsak dan oceni vreme z računalniškim modelom; izdeluje ga ECMWF, prostorska gostota je približno 9 km.",
  },
  era5t: {
    term: "ERA5T",
    def: "Predhodna, še ne dokončna različica teh podatkov za zadnjih ~6 dni; vrednosti se lahko še popravijo.",
  },
  ecmwf: {
    term: "ECMWF",
    def: "Evropski center za srednjeročne vremenske napovedi, ki izdeluje niz ERA5-Land.",
  },
  open_meteo: {
    term: "Open-Meteo",
    def: "Spletni arhiv, prek katerega stran dostopa do podatkov ERA5-Land.",
  },
  arso: {
    term: "ARSO",
    def: "Agencija Republike Slovenije za okolje, državna služba, ki upravlja slovensko mrežo merilnih postaj.",
  },
  wmo: {
    term: "WMO",
    def: "Svetovna meteorološka organizacija (World Meteorological Organization), ki določa mednarodne standarde, med njimi 30-letno klimatološko normalo.",
  },
  etccdi: {
    term: "ETCCDI / ECA&D",
    def: "Mednarodni strokovni skupini, ki sta poenotili definicije podnebnih kazalnikov (npr. kdaj šteje vroč dan).",
  },
  cds: {
    term: "CDS",
    def: "Copernicus Climate Data Store, uradni evropski portal za dostop do podatkov ERA5.",
  },
  spei: {
    term: "SPEI",
    def: "Standardiziran indeks padavin in evapotranspiracije; primerja vodno bilanco obdobja z zgodovinsko porazdelitvijo. Negativne vrednosti pomenijo bolj sušno kot običajno.",
  },
  spei_scales: {
    term: "SPEI-3 / SPEI-30",
    def: "Obdobje, čez katero se vodna bilanca sešteva: tri mesece oziroma trideset dni.",
  },
  kde: {
    term: "KDE",
    def: "Način, kako iz preteklih vrednosti narišemo gladko krivuljo porazdelitve, ki sledi dejanski obliki podatkov.",
  },
  nb_glm: {
    term: "NB GLM (negativna binomska regresija)",
    def: "Statistični model, s katerim ocenimo trend letnega števila (npr. vročih dni); primeren za števila, ki so bolj razpršena, kot bi bila naključno.",
  },
  temp_stats: {
    term: "Tmax / Tmean / Tmin",
    def: "Najvišja / povprečna / najnižja dnevna temperatura. Stran privzeto prikazuje Tmax.",
  },
  dwd: {
    term: "DWD",
    def: "Nemška državna vremenska služba, navedena kot primer drugačne izbire praga.",
  },

  // ── Concepts ──────────────────────────────────────────────────────────────
  reanalysis: {
    term: "reanaliza",
    def: "Rekonstrukcija preteklega vremena: računalniški model združi meritve, satelitske posnetke in fiziko ozračja v enotno mrežo vrednosti brez vrzeli. Ni isto kot meritev posamezne postaje.",
  },
  percentile: {
    term: "percentil",
    def: "Pove, od kolikšnega deleža primerljivih dni v zgodovini je današnji dan toplejši. 90. percentil = topleje kot 90 % primerjalnih dni.",
  },
  anomaly: {
    term: "odklon",
    def: "Koliko je dan toplejši ali hladnejši od »normale« (referenčnega obdobja 1991–2020).",
  },
  climatological_normal: {
    term: "klimatološka normala / referenčno obdobje",
    def: "Dogovorjeno 30-letno obdobje (tu 1991–2020), s katerim primerjamo.",
  },
  grid_cell: {
    term: "mrežna celica / mrežna ločljivost",
    def: "Model ozemlje razdeli na kvadrate ~9 km; vrednost velja za cel kvadrat, zato ne ujame posebnosti, manjših od tega.",
  },
  lapse_rate: {
    term: "višinski popravek (lapse-rate)",
    def: "Ker mreža ne leži točno na višini postaje, vrednost prilagodimo za razliko v nadmorski višini po pravilu 6,5 °C na kilometer.",
  },
  distribution: {
    term: "porazdelitev",
    def: "Prikaz, kako pogosti so bili posamezni odkloni na ta dan v letu skozi vsa leta.",
  },
  hot_day_tropical_night: {
    term: "vroč dan / tropska noč",
    def: "Vroč dan: dnevna temperatura preseže izbrani prag (npr. 30 °C). Tropska noč: temperatura tudi ponoči ostane nad pragom (npr. 20 °C).",
  },
  absolute_threshold: {
    term: "absolutni prag",
    def: "Fiksna meja v °C, neodvisna od referenčnega obdobja.",
  },
  projection_2050: {
    term: "projekcija do 2050",
    def: "Groba ocena, kam bi trend vodil do leta 2050, če se nadaljuje po istem tempu; približek, ne napoved.",
  },
  precipitation: {
    term: "padavine",
    def: "Količina dežja, snega in druge vode, ki v danem obdobju pade na tla; merjena v milimetrih (mm) višine vode. Na strani so vrednosti v oknu seštete, ne povprečene.",
  },
  et0: {
    term: "ET₀ (referenčna evapotranspiracija)",
    def: "Koliko vode bi v danem obdobju izhlapelo z referenčne travnate površine; merilo »sušilne moči« ozračja, prav tako v mm. Višja vrednost pomeni bolj sušne razmere, ne več vode.",
  },
  theil_sen: {
    term: "Theil-Sen",
    def: "Način risanja trendne črte: izračuna naklon med vsemi pari let in vzame srednjega. Posamezno izjemno leto tako ne potegne črte za sabo.",
  },
  mann_kendall: {
    term: "Mann-Kendall",
    def: "Test, ali vrednosti skozi leta dosledno naraščajo ali upadajo. Ne predpostavlja oblike trenda, le vrstni red vrednosti.",
  },
  stat_significance: {
    term: "statistična značilnost (p)",
    def: "Kako verjetno bi videli tak vzorec, če trenda v resnici ne bi bilo. p = 0,05 pomeni, da bi se to zgodilo po naključju v enem primeru od dvajsetih. Ni verjetnost, da je trend resničen.",
  },
  confidence_interval: {
    term: "interval zaupanja (95 %)",
    def: "Razpon, znotraj katerega je prava vrednost naklona z 95-odstotno zanesljivostjo. Širši razpon pomeni bolj negotovo oceno.",
  },
  autocorrelation: {
    term: "avtokorelacija / AR(1)",
    def: "Zaporedna leta si niso povsem neodvisna: toplo leto pogosto sledi toplemu. To lahko lažno okrepi videz trenda, zato ga test popravi.",
  },
  median: {
    term: "mediana",
    def: "Srednja vrednost: polovica vrednosti je manjših, polovica večjih. Za razliko od povprečja je odporna na osamelce.",
  },
  temperature_inversion: {
    term: "temperaturna inverzija",
    def: "Ko je zrak v višini toplejši od zraka pri tleh — pogosto pozimi v kotlinah. Takrat višinski popravek slabše deluje.",
  },
  water_balance: {
    term: "vodna bilanca",
    def: "Razlika med padavinami in izhlapevanjem (P − ET₀). Negativna pomeni, da je izhlapelo več, kot je padlo.",
  },
} as const;
