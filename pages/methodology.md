---
title: Metodologija
layout: page.html
summary: Kako nastanejo številke na strani »Ali je vroče?«
---

## Na kratko

Ta stran prikazuje, kako topel je današnji dan v Sloveniji v primerjavi z zgodovino od leta 1950. Nekaj stvari, ki jih je dobro vedeti pri branju:

- **Podatki niso meritve slovenskih vremenskih postaj ([ARSO](/glossary/#gloss-arso)).** Prihajajo iz **[reanalize](/glossary/#gloss-reanalysis) [ERA5-Land](/glossary/#gloss-era5_land)** (evropski podatkovni model, dostopen prek arhiva [Open-Meteo](/glossary/#gloss-open_meteo)). Reanaliza združi meritve, satelite in fizikalni model v enotno mrežo vrednosti. Zato **vrednosti niso neposredno primerljive** z uradnimi objavami ARSO, ki temeljijo na meritvah postaj.
- **Stran privzeto prikazuje najvišjo dnevno temperaturo ([Tmax](/glossary/#gloss-temp_stats))** — »kako vroč je bil dan«. Povprečno in najnižjo temperaturo lahko izberete ročno, a nista privzeti (razlog je spodaj).
- **Vsaka postaja je popravljena na nadmorsko višino.** Ker mrežna točka modela ni točno na višini postaje, vrednosti prilagodimo za razliko v nadmorski višini. **Za Kredarico je ta popravek −7,85 °C** — daleč največji na strani. Podrobnosti so spodaj; navajamo jih odkrito, ker gre za velik poseg v prikazano vrednost.
- **»Slovenija« pomeni povprečje 18 postaj**, ne ene same meritve na specifični postaji. Postaje segajo od morske gladine (10 m) do Kredarice (2514 m).
- **Referenčno obdobje za [odklone](/glossary/#gloss-anomaly) je 1991–2020** (veljavna [klimatološka norma](/glossary/#gloss-climatological_normal) [WMO](/glossary/#gloss-wmo)). Ker je to razmeroma toplo obdobje, se velik del zapisov 1950–2026 prikaže kot negativni odklon.

Podroben tehnični opis sledi spodaj.

---

## Vir podatkov

Stran uporablja **reanalizo ERA5-Land**[^era5_land_dataset][^era5_land_paper], dostopano prek **arhivskega API-ja Open-Meteo**[^open_meteo] (ne neposredno prek [ECMWF](/glossary/#gloss-ecmwf)/[CDS](/glossary/#gloss-cds)). ERA5-Land je globalni reanalizni niz Evropskega centra za srednjeročne vremenske napovedi (ECMWF) z [mrežno ločljivostjo](/glossary/#gloss-grid_cell) približno 9 km.

Reanaliza ni enaka meritevam posameznih postaj. Je rekonstrukcija preteklega vremena, ki nastane tako, da model združi številne vire opazovanj — meritve postaj, satelitske posnetke, podatke z ladij in letal — v enotno, prostorsko in časovno polno mrežo vrednosti.

**ERA5-Land sam ne vključuje nobenih meritev.** Opazovanja združi matična reanaliza **[ERA5](/glossary/#gloss-era5)** na mreži približno 31 km.[^hersbach_era5] ERA5-Land te vrednosti uporabi kot vhod in z njimi na gostejši mreži (~9 km) podrobneje izračuna razmere pri tleh. Gostejša mreža torej ne pomeni več opazovanj, le podrobnejši izračun iz istega vira.

**Dejanska ločljivost je slabša od mrežne.** Dejanska uporabna ločljivost ERA5 je približno tri- do štirikrat slabša od nazivne — okoli **100 km**, ne 31 km.

Zadnjih ~6 dni prihaja iz predhodne različice reanalize ([ERA5T](/glossary/#gloss-era5t)), zato se te vrednosti lahko še spremenijo.

Za današnje in najnovejše vrednosti, kjer reanaliza še ni na voljo, stran uporabi napoved Open-Meteo. Takšna vrednost je na strani označena z **»napoved«**; reanalizne vrednosti oznake nimajo.

## Postaje

Stran zajema **18 lokacij** po Sloveniji. Za vsako je vrednost vzeta iz mrežne celice ERA5-Land nad njo. Nabor postaj sega od nižin do visokogorja — med drugim Koper (blizu morske gladine, ~10 m), Postojna (549 m), Rateče (864 m) in Kredarica (2514 m). Celoten razpon nadmorskih višin je **10–2514 m**.

## [Korekcija na nadmorsko višino postaje](/glossary/#gloss-lapse_rate)

Mrežna celica ERA5-Land redko leži točno na nadmorski višini postaje. Da bi vrednosti ustrezale višini postaje in ne višini mrežne celice, vsako popravimo s **fiksno stopnjo 6,5 °C na kilometer** razlike med višino postaje in višino mrežne celice. To je standardna vrednost povprečne stopnje ohlajanja ozračja z višino.[^lapse_rate]

Za 17 od 18 postaj je ta popravek majhen. **Za Kredarico je velik: −7,85 °C.** Postaja leži na 2514 m, pripadajoča mrežna celica ERA5-Land pa na 1307 m — razlika 1207 m, kar pri 6,5 °C/km da popravek −7,85 °C. To je **daleč največji posamezni popravek na strani.**

Odkrito navajamo njegove omejitve:

- Popravljene vrednosti ERA5-Land za Kredarico smo **primerjali z meritvami ARSO in so bile blizu.** A šlo je za primerjavo, **ne za sistematično validacijo** — ni bila opravljena analiza pristranskosti po mesecih.
- Fiksna stopnja 6,5 °C/km je **povprečje za prosto ozračje.** Dejanska prizemna stopnja nad gorskim pobočjem se spreminja s sezono in se lahko **splošči ali celo obrne pri zimskih [temperaturnih inverzijah](/glossary/#gloss-temperature_inversion).** Popravek je torej lahko dober v letnem povprečju, a sistematično odstopa v posameznih mesecih (predvsem pozimi).
- Empirični popravek po postaji in mesecu bi bil boljša dolgoročna rešitev; zaenkrat ni izveden.

## Katera temperatura je privzeta

Stran privzeto prikazuje **najvišjo dnevno temperaturo (Tmax)** — na prvih karticah, ob nalaganju in v trendu, ki ga stran postavi v ospredje. Povprečna (Tmean) in najnižja (Tmin) dnevna temperatura sta na voljo za ročno izbiro, a nista privzeti.

Razlog je kakovost podatkov. Reanaliza ERA5-Land sistematično slabše oceni **najnižjo** temperaturo v pozidanih območjih, saj tudi matična reanaliza ERA5 v modelu eksplicitno ne upošteva učinkov mestnega toplotnega otoka. Ker se **povprečna** temperatura izračuna tudi iz najnižje, to pristranskost podeduje — ravno v naseljenih krajih, ki bralce najbolj zanimajo. Najvišja dnevna temperatura te pristranskosti ne nosi in se ujema z vprašanjem strani (»ali je vroče« — občutena dnevna vročina). Zato stran vodi s Tmax, izbira Tmean/Tmin pa ostaja bralcu, ki omejitev razume.

## Kaj pomeni »Slovenija«

Vrednost predstavlja **neuteženo povprečje vseh 18 postaj**, vključno s Kredarico, popravljeno na nadmorsko višino — na strani poimenovano »povprečje 18 postaj«, s prikazanim naborom postaj in razponom višin.

Uteževanje po površini ali višinskih pasovih smo pretehtali in **zavrnili**: ker je nad 1000 m le ena postaja (Kredarica), bi ta sama nosila cel višinski pas. To bi bilo videti natančno, a bi slonelo na eni sami točki. Neuteženo povprečje nad vidnim, poimenovanim naborom postaj je bolj poštena izbira.

## Časovni pas in dnevna meja

Dnevne vrednosti in meja »danes« sta določeni po času **Europe/Ljubljana**. Dnevni podatki so agregirani iz arhiva Open-Meteo v tem časovnem pasu. (Dan po UTC bi napačno razvrstil skrajne vrednosti blizu lokalne polnoči, kar je najbolj občutljivo pri štetju tropskih noči.)

## Referenčno obdobje in odkloni

Odkloni (koliko je dan topel »glede na normalo«) se merijo proti **referenčnemu obdobju 1991–2020** — veljavni klimatološki normali WMO[^wmo_normals] — enotno po vsej strani.

Ena posledica je pomembna za branje: ker je obdobje 1991–2020 razmeroma toplo, se **velik del zapisov 1950–2026 prikaže kot negativni odklon.** To ni napaka, temveč posledica primerjave s toplo sodobno normalo.

**Izjema — [SPEI](/glossary/#gloss-spei) (suša):** indeks suše SPEI[^spei] je ločen in umerjen na obdobje **1950–1980**, ne 1991–2020. [Absolutni pragovi](/glossary/#gloss-absolute_threshold) (npr. za vroče dneve in tropske noči) na referenčno obdobje niso vezani.

## Porazdelitev in percentil

Za vsak dan v letu stran prikaže **[porazdelitev](/glossary/#gloss-distribution)** preteklih vrednosti (kako pogosti so bili posamezni odkloni) in v kateri **[percentil](/glossary/#gloss-percentile)** porazdelitve se uvršča današnja vrednost (topleje od kolikšnega deleža primerjalnih dni).

- Porazdelitev je **empirična ocena gostote ([KDE](/glossary/#gloss-kde))** — sledi dejanski obliki podatkov — ne simetrična zvonasta (Gaussova) krivulja. Temperaturne porazdelitve so pogosto nesimetrične, zato bi Gaussova krivulja napačno prikazala repe, ravno tam, kjer se presoja »kako izjemen je današnji dan«.
- Percentil je **pravi empirični percentil**, izračunan iz te krivulje (integral gostote do današnje vrednosti), ne približek iz barvnega pasu.
- Krivulja, ki predstavlja Slovenijo, je **povprečje 18 krivulj posameznih postaj**, ne skupni bazen vzorcev — s čimer ohrani pomen »povprečja 18 postaj«.
- **Kategorije**, ki veljajo za Slovenijo (barvni pasovi in besede kot »Vroče« ali »Ekstremno«), izhajajo **iz iste krivulje** kot percentil, ne iz povprečja mej posameznih postaj. Ker je združenih 18 postaj z različnimi podnebji, so "repi" v porazdelitvi širši kot pri posameznih postajah, zato meja »med najtoplejšimi 5 %« leži nekoliko višje kot povprečje 5-odstotnih mej postaj. Posledica: oznaka in številka **vedno soglašata** (dan v pasu »Vroče« ima percentil ≥ 80), oznaka »Ekstremno« pa je **nekoliko redkejša** kot prej — meje niso bile sproščene, temveč usklajene s krivuljo, ki jo bralec že vidi.

Primerjalni vzorec za vsak koledarski dan je **združeno okno ±7 dni** čez vsa leta — tako ima vsak dan dovolj gost in stabilen vzorec. **Isto okno ±7 dni** uporablja tudi letni trend: vsaka letna točka na grafu trenda je **povprečje** vrednosti v tem oknu za posamezno leto — pri [padavinah](/glossary/#gloss-precipitation) in [ET₀](/glossary/#gloss-et0)[^fao56] pa **vsota**, saj sta to globini v mm in ima smisel le seštevek. **29. februar** se pri tem pridruži oknu 28. februarja (redki prestopni dnevi se ne obravnavajo kot ločen, statistično šumeč dan). Objavljena vrednost povsod uporablja okno ±7 dni; v panelu z analizo trendov lahko bralec izbere tudi ožje ali širše okno, kar velja le za tisti prikaz.

## Besedna ocena trenda (kategorija)

Besedo ob stoletnem trendu vsake postaje (»Izhodiščno«, »Zmerno«, »Slabo«, »Ekstremno«, »Zelo zaskrbljujoče«) določimo iz naklona trenda po mejah **0,05 · 0,10 · 0,20 · 0,30 °C na desetletje**; zgornja kategorija (≥ 0,30 °C/desetletje) je odprta navzgor. **Te meje so uredniška izbira te strani, ne standard, članek ali predhodna odločitev** — služijo le kot groba besedna oznaka relativne hitrosti segrevanja med postajami. Kako dobro so izbrane, je vprašanje za strokovni pregled.

Za primerjavo: Evropa se segreva približno dvakrat hitreje od svetovnega povprečja, kar je najhitreje med celinami[^wmo_c3s_esotc].

## Trend in statistična značilnost

Trendno črto skozi leta ocenimo z metodo **[Theil-Sen](/glossary/#gloss-theil_sen)**[^theil_sen]: naklon izračuna kot mediano naklonov med vsemi pari let, zato ga posamezno izjemno leto ne potegne za sabo. Ali je trend statistično značilen, presodimo z **[Mann-Kendallovim](/glossary/#gloss-mann_kendall) testom** s popravkom za [avtokorelacijo](/glossary/#gloss-autocorrelation) po Yueju in Wangu[^yue_wang] — sosednja leta si namreč niso povsem neodvisna in bi brez popravka trend deloval močnejši, kot je.

## Pragovi za »vroče«

Štetje [vročih dni in tropskih noči](/glossary/#gloss-hot_day_tropical_night) uporablja **stroge pragove (`>`, ne `≥`).** To je usklajeno s standardom [ETCCDI/ECA&D](/glossary/#gloss-etccdi)[^etccdi][^ecad] (medtem ko npr. nemški [DWD](/glossary/#gloss-dwd) uporablja `≥`). Standard je dejansko sporen; izbrali smo `>`. Sprememba na `≥` bi premaknila štetje vsakega mejnega dne, zato je izbira zapisana zavestno.

## Trend vročih dni in tropskih noči

Letni trend na grafih vročih dni in tropskih noči je **model negativne binomske regresije ([NB GLM](/glossary/#gloss-nb_glm))** čez letno število — primeren za številske podatke z večjo razpršenostjo od Poissonove. Gre za **približek**, ne za dokončno napoved: prikazana stopnja rasti in [projekcija do leta 2050](/glossary/#gloss-projection_2050) sta odvisni od izbranega praga in dolžine zaporedja.

**Trenda ne prikažemo, kadar mu ne moremo zaupati.** Za nekatere kombinacije (redki dogodki, skoraj ravna časovna vrsta) statistični model ne da zanesljivega rezultata — ne skonvergira ali pa ocena njegove negotovosti ni veljavna. V takih primerih trenda **ne objavimo** (letno štetje ostane prikazano), namesto da bi navedli navidezno natančno, a nezanesljivo številko. Enako velja, kadar je premalo let s podatki (potrebnih je vsaj 10). To je isto načelo kot pri indeksu suše SPEI: raje odklonimo objavo, kot da objavimo negotovo vrednost.

## Povzetek omejitev

- **Ne bazira direktno na meritvah ARSO.** Vrednosti so iz reanalize ERA5-Land, ne meritev postaj, in **niso neposredno primerljive** z objavami ARSO.
- **Korekcija na nadmorsko višino Kredarice** (−7,85 °C) je velika, preverjena, a ne validirana po mesecih, in lahko odstopa pozimi (glej zgoraj).
- **ERA5-Land Tmin** je v mestih nezanesljiva (toplotni otok); zato stran privzeto ne prikazuje Tmean/Tmin.
- **Ločljivost.** Mreža ERA5-Land je ~9 km, a vremenska informacija prihaja iz ERA5, katere učinkovita ločljivost je okoli 100 km. Lokalnih posebnosti pod to velikostjo vrednosti ne upoštevajo.
- **Najnovejše vrednosti** so lahko napoved (označene z »napoved«), dokler reanaliza ni na voljo.
- **Trend vročih dni/tropskih noči je približek** in ni na voljo za vse kombinacije praga in zaporedja: kjer se model ne ustali, trenda ne prikažemo (glej zgoraj).

## Višinski pasovi postaj

<!-- ⚠ STATIC TABLE — the counts (1 alpine / 1 mountain / 4 foothill / 12 lowland = 18)
     are DERIVED from the 18-station list in data/climate-si/sources/si.yaml by the
     elevation-band thresholds >1500 / >800 / >400 / else (code/ali-je-vroce-era5/i18n/
     station-bands.ts). This markdown does NOT recompute — if a station is added or
     removed, UPDATE these counts by hand or they go stale. -->

| Višinski pas | Postaje |
| --- | --- |
| Alpska (>1500m) | 1 postaja |
| Gorska (800–1500m) | 1 postaja |
| Predgorska (400–800m) | 4 postaje |
| Nižinska (<400m) | 12 postaj |

---

*Za morebitne popravke ali vprašanja o metodologiji nas kontaktirajte na [info@podnebnik.org](mailto:info@podnebnik.org).*

[^era5_land_dataset]: Podatkovni niz, iz katerega stran zajema vse temperaturne vrednosti. [ERA5-Land hourly data from 1950 to present — Copernicus Climate Change Service (C3S) / ECMWF](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land)
[^era5_land_paper]: Znanstveni članek, ki opisuje reanalizo ERA5-Land in njeno izdelavo. [Muñoz-Sabater in sod. (2021), Earth System Science Data 13, 4349–4383](https://doi.org/10.5194/essd-13-4349-2021)
[^open_meteo]: Arhivski spletni vmesnik, prek katerega stran dostopa do podatkov ERA5-Land. [Zippenfenig, P. (2023), Open-Meteo.com Weather API, Zenodo](https://doi.org/10.5281/zenodo.7970649)
[^hersbach_era5]: Matična reanaliza ERA5 — opis metode, asimilacije opazovanj in ločljivosti. [Hersbach et al. (2020), Quarterly Journal of the Royal Meteorological Society](https://rmets.onlinelibrary.wiley.com/doi/10.1002/qj.3803) Odprt dostop.
[^lapse_rate]: Standardna stopnja ohlajanja ozračja z višino (6,5 °C/km), kot jo določa standardna atmosfera (formalno ISO 2533 oziroma ICAO). [Glossary of Meteorology: »standard atmosphere« — American Meteorological Society](https://glossary.ametsoc.org/wiki/Standard_atmosphere)
[^wmo_normals]: Smernice za izračun 30-letnih klimatoloških normal (npr. 1991–2020). [WMO Guidelines on the Calculation of Climate Normals (WMO-No. 1203, 2017)](https://library.wmo.int/viewer/55797)
[^spei]: Izvirni članek, ki uvaja indeks suše SPEI. [Vicente-Serrano, Beguería & López-Moreno (2010), Journal of Climate 23, 1696–1718](https://doi.org/10.1175/2009JCLI2909.1)
[^fao56]: Smernice za izračun referenčne evapotranspiracije (ET₀), ki vstopa v vodno bilanco indeksa SPEI. [Allen, Pereira, Raes & Smith (1998), FAO Irrigation and Drainage Paper 56](https://www.fao.org/4/x0490e/x0490e00.htm)
[^wmo_c3s_esotc]: Evropa se segreva približno dvakrat hitreje od svetovnega povprečja. [WMO & Copernicus, European State of the Climate (2022)](https://climate.copernicus.eu/copernicus-temperatures-europe-increase-more-twice-global-average-europe-presents-live-picture) Obdobje 1991–2021.
[^theil_sen]: Izvirni članek o Theil-Senovi oceni naklona trenda. [Sen, P. K. (1968), Journal of the American Statistical Association 63, 1379–1389](https://doi.org/10.1080/01621459.1968.10480934)
[^yue_wang]: Popravek Mann-Kendallovega testa za avtokorelacijo z efektivno velikostjo vzorca. [Yue, S. & Wang, C. (2004), Water Resources Management 18, 201–218](https://doi.org/10.1023/B:WARM.0000043140.61082.60)
[^etccdi]: Pregled mednarodno poenotenih kazalnikov podnebnih skrajnosti. [Zhang in sod. (2011), WIREs Climate Change 2, 851–870](https://doi.org/10.1002/wcc.147)
[^ecad]: Slovar kazalnikov z natančnimi definicijami in pragovi (vroči dnevi, tropske noči). [ECA&D — Indices dictionary](https://www.ecad.eu/indicesextremes/indicesdictionary.php)
