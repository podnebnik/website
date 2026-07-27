import { climateRisks, heroContext } from "./hero-content.ts";

// T-5.5 (D-8) — Slovenian message catalogue for the "Ali je vroče" ERA5 island.
//
// Slovenian only for v1 (D-8): one locale, one file. Seeded from the salvaged
// `docs/i18n/sl_default.json` (T-2.4) where the wording matched what the page
// actually renders; where they diverged, the LIVE inline string was kept so the
// rendered output stays byte-identical (the sl_default.json prose was an older,
// longer draft — see PROGRESS T-5.5).
//
// Message syntax is the ICU subset implemented in ./format.ts:
//   "{name}"                                       — interpolate a parameter
//   "{count, plural, one{…} two{…} few{…} other{…}}" — Slovenian plural on `count`
// Numbers destined for display are pre-formatted by the caller (fmtNum/fmtInt/
// fmtSigned); "#" inside a plural form renders the grouped integer.
//
// ── FLAGGED FOR CONTENT REVIEW (not resolved here) ────────────────────────────
//  • Register/wording: "Peklensko" / "Izjemna vročina" (today.cat_hell), the
//    "stoletni"/"Sto let" verdict framing (hero.verdict_*) overstating the ~76-yr
//    record — both deferred from T-5.4a.
//  • The governed-genitive numeral agreement in "povprečje/vseh {N} postaj" is
//    subtler than the CLDR one/two/few/other paradigm; the forms below are the
//    nominative-count forms, correct for the only value that occurs (18 → "postaj")
//    and a reasonable default otherwise. A native pass should confirm N=1,2.
//  • Phrase-level English that was translated mechanically but may want polish:
//    reg.no_data, reg.year_round_footer, hc.* (Highcharts lang, kept English AS-IS).

export const sl = {
  common: {
    unit_c: "°C",
    unit_mm: "mm",
    unit_cm: "cm",
    today: "danes",
    ci95: "95% CI",
    temp_c: "{temp} °C",
  },

  loading: "Nalaganje…",

  error: {
    section: "Tega razdelka trenutno ni bilo mogoče naložiti.",
    retry: "Poskusi znova",
  },

  sections: {
    today_title: "ERA5 — Ali je vroče?",
    today_subtitle: "reanaliza ERA5-Land v primerjavi z zgodovinskimi percentili",
    trends_analysis: "Analiza trendov · ERA5-Land reanaliza",
    location_details: "Podrobnosti lokacije",
    season_overview: "Sezonski pregled",
    season_overview_sub: "Povprečna najvišja temperatura po sezonah · ERA5-Land · barve glede na referenčno obdobje {baseline}",
    spei: "Sezonski sušni indeks (SPEI)",
    spei_trend: "Sušni trend po postaji — SPEI",
    spei_trend_sub: "Sezonski (SPEI-3) in mesečni (SPEI-30) indeks vodne bilance · Theil-Sen · ERA5-Land",
    tropical_days: "Tropski dnevi",
    tropical_days_sub: "Število dni z najvišjo temperaturo nad pragom · ERA5-Land · lapsna korekcija nadmorske višine",
    tropical_nights: "Tropske noči",
    tropical_nights_sub: "Število noči z najnižjo temperaturo nad pragom · ERA5-Land · lapsna korekcija nadmorske višine",
    sea_level: "Dvig morske gladine — Koper",
    sea_level_sub: "Projekcije dviga morske gladine po scenarijih IPCC AR6 z viharnimi nalivi · severni Jadran",
  },

  today: {
    prev_day: "Prejšnji dan",
    next_day: "Naslednji dan",
    loc_national: "Slovenija — povprečje {count, plural, one{# postaja} two{# postaji} few{# postaje} other{# postaj}}",
    arso_group: "ARSO postaje",
    era5_group: "ERA5 postaje",

    cat_freezing: "Zmrzujoče",
    cat_cold: "Hladno",
    cat_nope: "Normalno",
    cat_hot: "Vroče",
    cat_hell: "Peklensko",

    // ARSO cutoffs vs ERA5 record — kept as separate templates as in TodayCard.
    desc_arso_freezing: "Med najhladnejšimi {d} v naših zapisih ARSO.",
    desc_arso_cold: "Hladneje od večine izmerjenih {d}.",
    desc_arso_nope: "Točno takšno, kot {d} v {country} ponavadi je.",
    desc_arso_hot: "Med najtoplejšimi {d} v naših zapisih.",
    desc_arso_hell: "Izjemna vročina — vrh 5 % vseh {d} glede na meritve ARSO.",
    desc_era5_freezing: "Med najhladnejšimi {d} v naših {record_years} letih zapisov.",
    desc_era5_cold: "Hladneje od večine izmerjenih {d}.",
    desc_era5_nope: "Točno takšno, kot {d} v {country} ponavadi je.",
    desc_era5_hot: "Med najtoplejšimi {d} v naših zapisih.",
    desc_era5_hell: "Izjemna vročina — vrh 5 % vseh {d} od {year_min}.",

    national_explain: "Povprečje najvišjih dnevnih temperatur {count, plural, one{# slovenske postaje} two{# slovenskih postaj} few{# slovenskih postaj} other{# slovenskih postaj}} (nadmorska višina {elMin}–{elMax} m), razvrščeno glede na zapise ERA5-Land od leta {yearMin} za isto ±7-dnevno okno.",
    explain_arso: "Temperatura na ARSO postaji {label}, razvrstena glede na percentilne zapise ARSO meritev.",
    explain_station: "Temperatura na postaji {station}, razvrstena glede na zapise ERA5-Land od leta {year_min} za isto ±7-dnevno okno.",
    explain_national: "Današnji vrh je najvišja napovedana temperatura, razvrstena glede na zapise ERA5-Land od leta {year_min} za isto ±7-dnevno okno.",

    context: "Slovenija leži na stičišču štirih podnebnih con — alpske, sredozemske, celinsko in panonske — stisnjenih v eno izmed podnebno najbolj raznolikih držav v Evropi. Srednja Evropa se segreva približno 1,5-krat hitreje od svetovnega povprečja. Temperature so v zadnjih 70 letih narasle za skoraj 2 °C. Pomlad v Alpah prihaja vse prej, sredozemske suše segajo vse globlje v notranjost, severovzhodni panonski del pa se sooča z vedno hujšimi vročinskimi vali. Kar je bilo leta 1980 tipično poletje, danes sodi med hladnejšo polovico nedavnih desetletij.",

    last7_title: "Zadnjih 7 dni",
    pct_label: "percentil",
    pct_samples_arso: "ARSO meritve",
    pct_samples: "{count, plural, one{# vzorec} two{# vzorca} few{# vzorci} other{# vzorcev}}",
    badge_forecast: "napoved",
    unavailable: "Podatki za ta dan niso na voljo.",

    // Footer under the today card. {suffix} is one of foot_suffix_* below (or "").
    foot: "{temp} °C · {pct}. percentil{suffix}",
    foot_suffix_arso: " · {count, plural, one{# vzorec} two{# vzorca} few{# vzorci} other{# vzorcev}} ({year_min}–{year_max}) · vir: ARSO",
    foot_suffix: " · {count, plural, one{# vzorec} two{# vzorca} few{# vzorci} other{# vzorcev}} ({year_min}–{year_max})",

    rank_hot: "#{rank} najtoplejši {d}",
    rank_cold: "#{rank} najhladnejši {d}",
    rank_top5_hot: "Najtoplejši {d}",
    rank_top5_cold: "Najhladnejši {d}",

    chart_title_nat: "Dnevne najvišje temperature v Sloveniji za dva tedna okoli {day} od {year_min}",
    chart_title_station: "Dnevne najvišje temperature na postaji {station} za dva tedna okoli {day} od {year_min}",
    chart_explain: "Krivulja prikazuje, kako pogosto se je pojavila vsaka vrhunska temperatura na dneve, kot je danes, v vseh letih. Barve označujejo klimatološke cone — od hladne modre prek tipičnega bežastega pasu do ekstremne rdeče.",
    // {region} = "Slovenija" | "Danes"
    foot2: "{region}: {temp} °C · {pct}. percentil · mediana {median} °C · {count, plural, one{# opazovanje} two{# opazovanji} few{# opazovanja} other{# opazovanj}} · {year_min}–{year_max}",
    foot2_region_nat: "Slovenija",
    foot2_region_day: "Danes",
  },

  // DistributionChart
  dist: {
    zone_cold: "Hladno",
    zone_cool: "Sveže",
    zone_normal: "Normalno",
    zone_hot: "Vroče",
    zone_extreme: "Ekstremno",
    tooltip: "{temp} °C · {zone}",
    today_line: "DANES: {temp} °C",
    band_below: "< {p}°C",
    band_range: "{a}–{b}°C",
    band_above: "> {p}°C",
    a11y: "Porazdelitev najvišjih dnevnih temperatur na dneve okoli izbranega datuma v vseh letih zabeleženega obdobja. Navpična črta označuje današnjo vrednost; barvni pasovi ločijo klimatološke cone od hladne do ekstremne.",
  },

  // TodayLast7Chart
  last7: {
    cat_freezing: "Zmrzujoče",
    cat_cold: "Hladno",
    cat_nope: "Normalno",
    cat_hot: "Vroče",
    cat_hell: "Peklensko",
    tooltip: "{label}: {cat} · {temp} °C ({pct}. percentil)",
    a11y: "Gibanje toplotne kategorije v zadnjih sedmih dneh — vsaka točka je en dan, uvrščen od zmrzujoče do peklensko glede na zgodovinske percentile.",
  },

  // TodayTrendChart (annual trend + projection)
  trend: {
    title_station: "Najvišje temperature na postaji {station} okoli {day} · {yearMin}–{yearMax} · trend s projekcijo do 2050",
    title_nat: "Najvišje temperature v Sloveniji okoli {day} · {yearMin}–{yearMax} · trend s projekcijo do 2050",
    explain: "Vsaka pika je 90. percentil {source} v ±30-dnevnem oknu okoli tega datuma za vsako leto od {yearMin}. Trend Theil-Sen je {trend} °C/desetletje ({sig}). Po tem tempu projekcija kaže {proj2050} °C do leta 2050. Zasenčeni pas je 95% interval zaupanja za nagib.",
    explain_source_station: "lapsno popravljene dnevne najvišje temperature na postaji {station}",
    explain_source_nat: "nacionalne povprečne dnevne najvišje temperature vseh {count, plural, one{# postaje} two{# postaj} few{# postaj} other{# postaj}}",
    foot: "Theil-Sen + TFPW MK: {trend} °C/desetletje · {sig} · τ = {tau} · 95% CI · {count, plural, one{# leto} two{# leti} few{# leta} other{# let}}",
    tooltip_annual: "<b>{x}</b>: {y} °C",
    tooltip_milestone: "<b>{x}</b>: {y} °C <em>(projekcija)</em>",
    a11y: "Letni trend najvišjih temperatur okoli izbranega datuma z linijo Theil-Sen, 95-odstotnim intervalom zaupanja in projekcijo do leta 2050. Vsaka pika je vrednost enega leta.",
  },

  // RegressionPanel toolbar + cards
  reg: {
    var_temperature_max: "Najvišja temperatura (°C)",
    var_temperature_min: "Najnižja temperatura (°C)",
    var_temperature_mean: "Povprečna temperatura (°C)",
    var_precipitation_sum: "Padavine (mm)",
    var_et0: "ET₀ (mm)",

    location: "Lokacija",
    select_locations: "Izberite lokacije (največ 6)",
    variable: "Spremenljivka",
    day: "Dan",
    locations_multi: "{count, plural, one{# lokacija} two{# lokaciji} few{# lokacije} other{# lokacij}}",

    years_sig: "{count, plural, one{# leto} two{# leti} few{# leta} other{# let}} · {sig}",
    change_over_record: "sprememba v celotnem obdobju",
    under_mean: "Pod povprečjem",
    over_mean: "Nad povprečjem",
    trend_line: "Trendna linija",
    no_data: "Ni podatkov za izbrani dan in lokacijo.",

    year_round_title: "Celoletni trend · {station}",
    year_round_sub: "trend na desetletje za vsak dan v letu · rdeča črta = izbrani dan",
    warming: "Segrevanje",
    cooling: "Ohlajanje",
    year_round_footer: "prosojnost = značilnost · p < 0,001 povsem neprosojno",

    explain_reg: "Theil-Sen regresija + Yue-Wang TFPW Mann-Kendall test · ERA5-Land · nadmorska korekcija",
    explain_cal: "Trend na desetletje za vsak dan v letu · rdeča = ogrevanje · modra = ohlajanje · prosojnost = statistična značilnost",
  },

  // RegressionChart (Highcharts)
  regchart: {
    tooltip: "<b>{loc}</b><br/>{x}: <b>{y}</b> {unit}",
    tooltip_anomaly: "<br/>anomalija: {a}",
    baseline_label: "POVPREČJE {count, plural, one{# leta} two{# let} few{# let} other{# let}}: {baseline}",
    a11y: "Razsevni diagram letnih vrednosti izbrane spremenljivke z regresijsko linijo trenda in 95-odstotnim intervalom zaupanja; črtkana črta označuje povprečje referenčnega obdobja.",
  },

  // YearRoundChart (Highcharts)
  yearround: {
    tooltip: "<b>{label}</b><br>Trend: {trend} {unit}/desetletje<br>p = {p}",
    a11y: "Trend spremembe po dnevih v letu čez celotno koledarsko leto — vsak stolpec je en dan, višina je trend na desetletje, navpična črta pa označuje izbrani datum.",
  },

  // HeroCards
  hero: {
    verdict_warming: "Sto let segrevanja za <em>{t100} {unit}</em> – pri trenutnem tempu vsaka <em>{yrs} let</em> doda eno stopinjo.",
    verdict_cooling: "Sto let ohlajanja za <em>{t100} {unit}</em> – pri trenutnem tempu vsaka <em>{yrs} let</em> odšteje eno stopinjo.",
    verdict_none: "Na ta dan v letu ni zaznati trenda.",
    method_theilsen: "Theil-Sen + TFPW Mann-Kendall",

    cat_catastrophic: "Katastrofalno",
    cat_extreme: "Ekstremno",
    cat_bad: "Slabo",
    cat_moderate: "Zmerno",
    cat_baseline: "Izhodiščno",

    eyebrow_var: "najvišja temperatura",
    unit_decade: "°C / desetletje",
    risk_label: "Tveganje vpliva:",
    stat_significance: "Značilnost",
    stat_sample: "Vzorec",
    stat_autocorrelation: "Avtokorelacija",
    sample_full: "{count, plural, one{# opazovanje} two{# opazovanji} few{# opazovanja} other{# opazovanj}} · {count2, plural, one{# leto} two{# leti} few{# leta} other{# let}}",
    sample_years: "{count, plural, one{# leto} two{# leti} few{# leta} other{# let}}",
    ar1: "AR(1) = {ar1} · {strength}",
    ar1_negligible: "zanemarljiva",
    ar1_weak: "šibka",
    ar1_moderate: "zmerna",
    group_a11y: "Podrobnosti lokacije {station}: stoletni temperaturni trend, kategorija tveganja in vpliv podnebne spremembe.",
  },

  // Per-location content tables, moved VERBATIM from HeroCards.tsx (T-5.5) so the
  // rendered prose stays byte-identical. Looked up as climate_risks.<Loc> and
  // hero_context.<Loc>.<category>. Wording is content-provider territory (FLAGGED).
  climate_risks: climateRisks,
  hero_context: heroContext,

  // Season heatmap
  season: {
    label_Autumn: "Jesen",
    label_Summer: "Poletje",
    label_Spring: "Pomlad",
    label_Winter: "Zima",
    cat_cold: "Hladno (<10. pct)",
    cat_cool: "Sveže (10–20. pct)",
    cat_normal: "Normalno (20–80. pct)",
    cat_hot: "Vroče (80–95. pct)",
    cat_extreme: "Ekstremno (>95. pct)",
    mode_all: "Vse letne čase",
    mode_extremes: "Samo ekstremi",
    anim_stop: "⏹ Ustavi",
    anim_play: "▶ Animacija",
    stat_extreme: "Ekstremne sezone",
    stat_cold: "Hladne sezone",
    stat_extreme_since: "Ekstremne od 2010",
    stat_hot_recent: "Vroče ali ekstremne ({from}–{to})",
    tooltip_avg_label: "Povprečni maks:",
    tooltip_rank: "{rank}. najtoplejša {season} od {count, plural, one{# leta} two{# let} few{# let} other{# let}}",
    grid_a11y: "Toplotna karta letnih časov po letih od {from} do {to}: vsak stolpec je eno leto, vsaka vrstica en letni čas, barva pa uvršča povprečno najvišjo temperaturo od hladne do ekstremne glede na referenčno obdobje. Celotni podatki so v tabeli pod grafom.",
    table_caption: "Podatki toplotne karte letnih časov po letih",
    th_season: "Letni čas",
    th_year: "Leto",
    th_category: "Kategorija",
    th_avg: "Povprečni maksimum (°C)",
    th_rank: "Uvrstitev",
    rank_of: "{rank}. od {total}",
  },

  // SPEI heatmap
  spei: {
    label_Autumn: "Jesen",
    label_Summer: "Poletje",
    label_Spring: "Pomlad",
    label_Winter: "Zima",
    cat_extreme_dry: "Huda suša (SPEI < −1,5)",
    cat_dry: "Suho (SPEI −1,5 do −1,0)",
    cat_normal: "Normalno (SPEI −1,0 do 1,0)",
    cat_wet: "Mokro (SPEI 1,0 do 1,5)",
    cat_extreme_wet: "Zelo mokro (SPEI > 1,5)",
    mode_all: "Vse letne čase",
    mode_extremes: "Samo ekstremi",
    anim_stop: "⏹ Ustavi",
    anim_play: "▶ Animacija",
    stat_extreme_dry: "Sezone hude suše (SPEI < −1,5)",
    stat_extreme_wet: "Izjemno mokre sezone (SPEI > 1,5)",
    stat_extreme_dry_since: "Sezone hude suše od 2000",
    stat_dry_recent: "Suho ali suša ({from}–{to})",
    tooltip_spei: "SPEI: ",
    tooltip_balance: "Vodni bilans: ",
    tooltip_balance_unit: " mm P−ET₀",
    tooltip_rank: "{rank}. najsušnejša {season} od {count, plural, one{# leta} two{# let} few{# let} other{# let}}",
    grid_a11y: "Toplotna karta sušnega indeksa SPEI po letnih časih in letih od {from} do {to}: vsak stolpec je eno leto, vsaka vrstica en letni čas, barva pa označuje razmere od hude suše do zelo mokrega. Celotni podatki so v tabeli pod grafom.",
    table_caption: "Podatki toplotne karte sušnega indeksa SPEI po letnih časih in letih",
    th_season: "Letni čas",
    th_year: "Leto",
    th_category: "Kategorija",
    th_spei: "SPEI",
    th_balance: "Vodna bilanca (mm)",
    th_rank: "Uvrstitev",
    rank_of: "{rank}. od {total}",
  },

  // SPEI trend per station
  speitrend: {
    season_Annual: "Letno",
    season_Winter: "Zima",
    season_Spring: "Pomlad",
    season_Summer: "Poletje",
    season_Autumn: "Jesen",
    tooltip_cat_huda: "Huda suša",
    tooltip_cat_suho: "Suho",
    tooltip_cat_normalno: "Normalno",
    tooltip_cat_mokro: "Mokro",
    tooltip_cat_zelo_mokro: "Zelo mokro",
    tooltip: "<b>{season} {x}</b><br>{scale}: <b>{v}</b><br>{cat}",
    threshold_dry: "huda suša",
    threshold_wet: "zelo mokro",
    header_count: "{count, plural, one{# {unit1}} two{# {unit2}} few{# {unit2}} other{# {unit2}}} · {y0}–{y1}",
    unit_months_one: "mesec",
    unit_months_other: "mesecev",
    unit_seasons_one: "sezona",
    unit_seasons_other: "sezon",
    slope_unit: "SPEI / desetletje",
    sig_significant: "statistično značilen (p < 0,05)",
    sig_not: "ni statistično značilen (p = {p})",
    threshold_crossed_dry: "Trendna linija je že prečkala prag hude suše (SPEI −1,5).",
    threshold_reach_dry: "Pri tem trendu doseže hudo sušo (SPEI −1,5) okoli leta {year}.",
    threshold_crossed_wet: "Trendna linija je že prečkala prag zelo mokrega (SPEI +1,5).",
    threshold_reach_wet: "Pri tem trendu doseže zelo mokro (SPEI +1,5) okoli leta {year}.",
    tech: "Theil-Sen naklon: {slope} SPEI/desetletje · Mann-Kendall: {mk} · {sig}. Negativen trend pomeni, da razmere postajajo sušnejše glede na osnovno obdobje {baseline}.{threshold}",
    too_little: "Premalo podatkov za izračun trenda.",
    a11y: "Razsevni diagram sušnega indeksa SPEI po letih za izbrano postajo in obdobje, z linijo trenda Theil-Sen ter pragovoma hude suše (−1,5) in zelo mokrega (+1,5).",
  },

  // Tropical days / nights
  tropical: {
    unit_days: "dni",
    unit_nights: "noči",
    noun_days: "Tropski dnevi",
    noun_nights: "Tropske noči",
    plain_noun_days: "tropski dan",
    plain_noun_nights: "tropska noč",
    ctrl_threshold: "Prag:",
    ctrl_streak_days: "Min. zap. dni:",
    ctrl_streak_nights: "Min. zap. noči:",
    header_count: "{count, plural, one{# leto} two{# leti} few{# leta} other{# let}} · {nonzero} z vrednostjo > 0",
    year_legend: "Zadnji stolpec — leto v teku",
    year_in_progress: "(leto v teku)",
    trend_label: "trend do {year}",
    tooltip_trend: "<b>{x}</b><br>Trend: <b>{y}</b> {unit}",
    tooltip_bar: "<b>{x}</b>{partial}<br>{noun}: <b>{y}</b>",
    nb_fit: "NB fit ({dpd} {unit}/des · {p})",
    plain_desc_days: "Tropski dan — ko dnevna temperatura preseže {th} °C — povečuje toplotni stres in zdravstvena tveganja.",
    plain_desc_nights: "Tropska noč — ko temperatura čez noč ostane nad {th} °C — preprečuje telesu okrevanje po dnevni vročini.",
    tech: "NB GLM: {rate}%/leto · {dpd} {unit}/desetletje · 95% CI · {sigphrase} · AIC {aic} · α={alpha}.",
    sig_yes: "statistično značilen ({p})",
    sig_no: "ni značilen ({p})",
    forward_yes: "Če trend nadaljuje, bi bilo do 2050 tipičnih okoli {proj2050} {unit} na leto.",
    forward_no: "Podatki ne kažejo jasnega signala, a smer spremembe je vredna pozornosti.",
    sig_trend_yes: "statistično značilen trend",
    sig_trend_no: "trend, ki še ni statistično značilen",
    dir_more: "več",
    dir_less: "manj",
    plain: "{plainDesc} Postaja {station} kaže {sig}: grobe {dpd} {dir} {unit} na desetletje. {forward}",
    no_trend: "Premalo let z {plainNoun}i za izračun trenda ({count, plural, one{# leto} two{# leti} few{# leta} other{# let}} z vrednostjo > 0). Potrebnih je vsaj 10.",
    a11y: "Stolpčni prikaz letnega števila — {noun}, torej koliko {unit} na leto preseže izbrani temperaturni prag — z modelom trenda negativne binomske regresije in intervalom zaupanja; zadnji stolpec je leto v teku.",
  },

  // StationMap + map legend
  map: {
    a11y: "Zemljevid Slovenije z merilnimi postajami; barva točke označuje višinski pas postaje. Postajo lahko izberete tudi s spustnim seznamom v analizi trendov.",
    panel_title_all: "Slovenija — vseh {count, plural, one{# postaja} two{# postaji} few{# postaje} other{# postaj}}",
    panel_sub_count: "{count, plural, one{# postaja} two{# postaji} few{# postaje} other{# postaj}} · ERA5",
    legend_alpine: "Alpska (>1500m)",
    legend_mountain: "Gorska (800–1500m)",
    legend_foothill: "Predgorska (400–800m)",
    legend_lowland: "Nižinska (<400m)",
  },

  // Sea level widget
  sea: {
    a11y: "Interaktivni prikaz dviga morske gladine v Kopru po scenarijih IPCC AR6; gumbi izberejo scenarij in verjetnost, drsnik leto, ločnica pa primerja sedanjost s projekcijo.",
    scenario: "Scenarij",
    scn_mid: "Srednja pot",
    scn_highway: "Vožnja po avtocesti",
    prob: "Verjetnost ekstremov",
    prob_common: "pogost (70 %)",
    prob_rare: "redek (20 %)",
    prob_extreme: "ekstrem (1 %)",
    year: "Leto:",
    buildings_short: "stavb",
    play: "Predvajaj",
    pause: "Ustavi",
    move_divider: "Premakni ločnico",
    today: "DANES",
    total_rise: "Skupni dvig gladine",
    mean_sub: "srednja vrednost · {scn}",
    impact_ha: "ha poplavljenih",
    impact_build: "ogroženih stavb",
    legend_today: "Danes in prihodnost",
    legend_future: "Novo v prihodnosti",
    sources: "Viri podatkov",
    src_proj: "Projekcije: IPCC AR6 (Fox-Kemper et al. 2021), lokalizirano za severni Jadran — DRSV 2023.",
    src_impact: "Posledice: Kovačič et al. 2016/2019.",
    src_map: "Karta:",
    src_warn: "⚠ Poplavne cone so shematske — zamenjava z LIDAR DEM poligoni sledi.",
  },

  // Site meta (fallbacks)
  meta: {
    name: "Slovenija",
    site_title: "Podnebnik · Ali je vroče?",
  },

  // ── Highcharts `lang` — extracted AS-IS (English library defaults). D-8 is
  // Slovenian-only, so these want translation, but the operator instruction for
  // T-5.5 was to CENTRALISE them here without re-wording. FLAGGED for a Highcharts
  // a11y-lang translation pass. Only the export-data "view as data table" affordance
  // (exporting hidden, T-5.4a) surfaces these to a screen-reader today.
  hc: {
    viewData: "View data table",
    hideData: "Hide data table",
    downloadCSV: "Download CSV",
    downloadXLS: "Download XLS",
  },
} as const;

export type Catalogue = typeof sl;
