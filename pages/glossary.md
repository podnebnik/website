---
title: Slovarček pojmov
layout: page.html
---

## absolutni prag {#gloss-absolute_threshold}

Fiksna meja v °C, neodvisna od referenčnega obdobja.

## ARSO {#gloss-arso}

Agencija Republike Slovenije za okolje, državna služba, ki upravlja slovensko mrežo merilnih postaj.

## avtokorelacija / AR(1) {#gloss-autocorrelation}

Zaporedna leta si niso povsem neodvisna: toplo leto pogosto sledi toplemu. To lahko lažno okrepi videz trenda, zato ga test popravi.

## CDS {#gloss-cds}

Copernicus Climate Data Store, uradni evropski portal za dostop do podatkov ERA5.

## DWD {#gloss-dwd}

Nemška državna vremenska služba, navedena kot primer drugačne izbire praga.

## ECMWF {#gloss-ecmwf}

Evropski center za srednjeročne vremenske napovedi, ki izdeluje niz ERA5-Land.

## ERA5 {#gloss-era5}

Matična reanaliza ECMWF na mreži približno 31 km, ki združuje meritve, satelitske posnetke in fizikalni model. ERA5-Land iz nje izpelje podrobnejšo sliko razmer pri tleh.

## ERA5-Land {#gloss-era5_land}

Podatkovni niz ECMWF na mreži ~9 km, ki podrobneje izračuna razmere pri tleh. Vremenske podatke dobi iz reanalize ERA5 in sam ne vključuje nobenih meritev.

## ERA5T {#gloss-era5t}

Predhodna, še ne dokončna različica teh podatkov za zadnjih ~6 dni; vrednosti se lahko še popravijo.

## ET₀ (referenčna evapotranspiracija) {#gloss-et0}

Koliko vode bi v danem obdobju izhlapelo z referenčne travnate površine; merilo »sušilne moči« ozračja, prav tako v mm. Višja vrednost pomeni bolj sušne razmere, ne več vode.

## ETCCDI / ECA&D {#gloss-etccdi}

Mednarodni strokovni skupini, ki sta poenotili definicije podnebnih kazalnikov (npr. kdaj šteje vroč dan).

## interval zaupanja (95 %) {#gloss-confidence_interval}

Razpon, znotraj katerega je prava vrednost naklona z 95-odstotno zanesljivostjo. Širši razpon pomeni bolj negotovo oceno. Nanaša se na trendno črto, ne na posamezno leto — za to glej [napovedni interval](#gloss-prediction_interval).

## KDE {#gloss-kde}

Način, kako iz preteklih vrednosti narišemo gladko krivuljo porazdelitve, ki sledi dejanski obliki podatkov.

## klimatološka normala / referenčno obdobje {#gloss-climatological_normal}

Dogovorjeno 30-letno obdobje (tu 1991–2020), s katerim primerjamo.

## korekcija na nadmorsko višino postaje (lapse-rate) {#gloss-lapse_rate}

Ker mreža ne leži točno na višini postaje, vrednost prilagodimo za razliko v nadmorski višini po pravilu 6,5 °C na kilometer.

## Mann-Kendall {#gloss-mann_kendall}

Test, ali vrednosti skozi leta dosledno naraščajo ali upadajo. Ne predpostavlja oblike trenda, le vrstni red vrednosti.

## mediana {#gloss-median}

Srednja vrednost: polovica vrednosti je manjših, polovica večjih. Za razliko od povprečja je odporna na osamelce.

## mrežna celica / mrežna ločljivost {#gloss-grid_cell}

Model ozemlje razdeli na kvadrate ~9 km; vrednost velja za cel kvadrat, zato ne ujame posebnosti, manjših od tega.

## NB GLM (negativna binomska regresija) {#gloss-nb_glm}

Statistični model, s katerim ocenimo trend letnega števila (npr. vročih dni); primeren za števila, ki so bolj razpršena, kot bi bila naključno.

## odklon {#gloss-anomaly}

Koliko je dan toplejši ali hladnejši od »normale« (referenčnega obdobja 1991–2020).

## Open-Meteo {#gloss-open_meteo}

Spletni arhiv, prek katerega stran dostopa do podatkov ERA5-Land.

## padavine {#gloss-precipitation}

Količina dežja, snega in druge vode, ki v danem obdobju pade na tla; merjena v milimetrih (mm) višine vode. Na strani so vrednosti v oknu seštete, ne povprečene.

## percentil {#gloss-percentile}

Pove, od kolikšnega deleža primerljivih dni v zgodovini je današnji dan toplejši. 90. percentil = topleje kot 90 % primerjalnih dni.

## PI (napovedni interval) {#gloss-prediction_interval}

Razpon, v katerem bi se z 95-odstotno zanesljivostjo znašla posamezna prihodnja vrednost. Je širši od intervala zaupanja, ker poleg negotovosti trenda vključuje tudi naravno nihanje med posameznimi leti.

## porazdelitev {#gloss-distribution}

Prikaz, kako pogosti so bili posamezni odkloni na ta dan v letu skozi vsa leta.

## projekcija do 2050 {#gloss-projection_2050}

Groba ocena, kam bi trend vodil do leta 2050, če se nadaljuje po istem tempu; približek, ne napoved.

## reanaliza {#gloss-reanalysis}

Rekonstrukcija preteklega vremena: računalniški model združi meritve, satelitske posnetke in fiziko ozračja v enotno mrežo vrednosti brez vrzeli. Ni isto kot meritev posamezne postaje.

## SPEI {#gloss-spei}

Standardiziran indeks padavin in evapotranspiracije; primerja vodno bilanco obdobja z zgodovinsko porazdelitvijo. Negativne vrednosti pomenijo bolj sušno kot običajno.

## SPEI-3 / SPEI-30 {#gloss-spei_scales}

Obdobje, čez katero se vodna bilanca sešteva: tri mesece oziroma trideset dni.

## statistična značilnost (p) {#gloss-stat_significance}

Kako verjetno bi videli tak vzorec, če trenda v resnici ne bi bilo. p = 0,05 pomeni, da bi se to zgodilo po naključju v enem primeru od dvajsetih. Ni verjetnost, da je trend resničen.

## temperaturna inverzija {#gloss-temperature_inversion}

Ko je zrak v višini toplejši od zraka pri tleh — pogosto pozimi v kotlinah. Takrat korekcija na nadmorsko višino slabše deluje.

## Theil-Sen {#gloss-theil_sen}

Način risanja trendne črte: izračuna naklon med vsemi pari let in vzame srednjega. Posamezno izjemno leto tako ne potegne črte za sabo.

## Tmax / Tmean / Tmin {#gloss-temp_stats}

Najvišja / povprečna / najnižja dnevna temperatura. Stran privzeto prikazuje Tmax.

## vodna bilanca {#gloss-water_balance}

Razlika med padavinami in izhlapevanjem (P − ET₀). Negativna pomeni, da je izhlapelo več, kot je padlo.

## vroč dan / tropska noč {#gloss-hot_day_tropical_night}

Vroč dan: dnevna temperatura preseže izbrani prag (npr. 30 °C). Tropska noč: temperatura tudi ponoči ostane nad pragom (npr. 20 °C).

## WMO {#gloss-wmo}

Svetovna meteorološka organizacija (World Meteorological Organization), ki določa mednarodne standarde, med njimi 30-letno klimatološko normalo.
