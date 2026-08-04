// T-5.5 (D-8) — per-location HeroCards content, MOVED VERBATIM from HeroCards.tsx.
//
// These two tables are single-locale editorial CONTENT (18 stations × the climate
// risk line + 5 trend-category descriptions). They were relocated here unchanged so
// the catalogue is the single source, WITHOUT retyping the prose — the exact bytes
// from HeroCards.tsx were preserved to keep the rendered output byte-identical.
// Wording is content-provider territory and is FLAGGED for review (PROGRESS T-5.5),
// e.g. "stletni"/"stletni poplavni viški" and other typos live in the source prose.

export const climateRisks: Record<string, string> = {
  Ljubljana:        "Mestni toplotni otok — poletni vročinski stres in tveganje hudourniških poplav v Ljubljanski kotlini",
  Maribor:          "Sušni stres v vinogradništvu — zgodnejše trgatve in premik vinskih sort",
  Celje:            "Okrepitev poplav Savinje v kombinaciji z naraščajočo poletno sušo",
  Kranj:            "Izguba alpske snežne odeje, ki zmanjšuje poletni pretok Save",
  Koper:            "Podaljšanje sredozemske suše — tveganje vdora slane vode in dviga morske gladine",
  Novo_Mesto:       "Suša reke Krke ogroža pridelavo hmelja in sadja",
  Murska_Sobota:    "Panonska vročina in suša — najtoplejše temperaturne razlike v Sloveniji",
  Nova_Gorica:      "Sredozemsko sušenje — ekosistem hladnovodne Soče in kraško vinogradništvo v nevarnosti",
  Postojna:         "Suša kraškega vodonosnika — jamski ekosistem in endemska favna pod toplotnim stresom",
  Ptuj:             "Nizki vodostaji Drave — vodni stres v vinogradništvu in zmanjšanje hidroenergetskih zmogljivosti",
  Velenje:          "Upravljanje z vodo po izkopavanju premoga ob stopnjevanju suše in poplav",
  Trbovlje:         "Ojačanje vročine v savski soteski in naraščajoče tveganje poplav",
  Tolmin:           "Stopnjevanje ekstremnih poplav Soče — krčenje ekosistema hladnovodnih rib",
  Kocevje:          "Propad pragozdov pod napadom lubadarja — izguba habitata velikih zveri",
  Ilirska_Bistrica: "Izčrpavanje kraških izvirov — motnja podzemnega rečnega sistema Pivke",
  Domzale:          "Mestni toplotni otok v kotlini — kombinirani vročinski in sušni stres za Ljubljansko regijo",
  Ratece:           "Izguba alpske snežne odeje — grožnja smučarskemu gospodarstvu in nestabilnost permafrost pobočij",
  Kredarica:        "Izguba Triglavskega ledenika — izsušitev izvirnih vod za Slovenijo reke",
};

export const heroContext: Record<string, Record<string, string>> = {
  Ljubljana: {
    baseline:     "Glavno mesto v Ljubljanski kotlini, ki jo obkrožajo hribi in pozimi pastuje hladen zrak. Celinsko podnebje s toplimi poletji in hladnimi zimami, okrepljeno z mestnim toplotnim otokom.",
    moderate:     "Segrevanje skrajšuje zimsko megleno sezono, a povečuje poletni toplotni stres. Mestno tkivo zadržuje toploto, ponoči postaja vse toplejše po vsej metropolitanski regiji.",
    bad:          "Vročinski valovi presegajo 35 °C več zaporednih dni. Smrtnost starejših narašča. Kotlinska lega kopiči toploto; poraba klimatskih naprav se poveča in preobremeni omrežje.",
    extreme:      "Podaljšane vročinske izredne razmere postanejo letni pojav. Reka Ljubljanica poleti splahni, kar ogroža vodooskrbo. Mestna zelenjava trpi pod hudim sušnim stresom.",
    catastrophic: "Podaljšani poletni vročinski valovi presegajo hladilne zmogljivosti mesta. Hudourniške poplave iz okrepljenih alpskih padavin večkrat ogrozijo nizko ležečo kotlino.",
  },
  Maribor: {
    baseline:     "Drugo največje mesto, dolina reke Drave, severovzhodna Slovenija. Celinsko podnebje z vročimi poletji. Pomembna vinorodna regija — segrevanje že pomika datume trgatve naprej.",
    moderate:     "Podaljšana rastna sezona kratkoročno koristi vinu, a naraščajoč sušni stres in tveganje poznih zmrzali po zgodnji brstovitvi začenjata ogrožati pridelke.",
    bad:          "Datumi trgatve se premaknejo 3–4 tedne naprej. Tradicionalne štajerske sorte trpijo pod vročinskim stresom. Fitosanitarni problemi se bistveno okrepijo.",
    extreme:      "Tradicionalne štajerske vinogradniške sorte postanejo ekonomsko neobstojne. Povpraševanje po namakanju iz Drave se spopada z ekološkimi zahtevami pretoka.",
    catastrophic: "Ponavljajoča se huda sušna leta sesedejo štajersko vinsko gospodarstvo. Ekstremno nizki vodostaji Drave ogrožajo vodooskrbo doline in obrečne ekosisteme.",
  },
  Celje: {
    baseline:     "Dolina reke Savinje, zgodovinsko podvržena hudim poplavam. Celinsko podnebje. Zaprta dolina ustvarja temperaturne inverzije in zmrzalne žepe pozimi.",
    moderate:     "Segrevanje zmanjšuje zmrzalne dni, a krepi konvektivne padavine, ki sprožajo poplave Savinje, po katerih je mesto že znano.",
    bad:          "Dogodki, ki so bili prej stletni poplavni viški, se ponavljajo v desetletjih. Protipoplavna infrastruktura, zgrajena za zgodovinske povratne dobe, je sistematično prekoračena.",
    extreme:      "Kombinirani poletni sušni in zimski poplavni ekstremi hkrati destabilizirajo kmetijstvo in infrastrukturo v dolini Savinje.",
    catastrophic: "Pogostejši ekstremni poplavni dogodki preplavljajo staro protipoplavno infrastrukturo. Izmenjava suša–poplava destabilizira kmetijsko savinjsko ravnino.",
  },
  Kranj: {
    baseline:     "Ob vznožju Kamniško-Savinjskih Alp, dolina reke Save, 387 m. Alpski vpliv ohranja razmeroma hladna poletja. Vhod v Triglavski narodni park.",
    moderate:     "Upadanje alpske snežne odeje zmanjšuje poletni pretok Save, kar vpliva na vodooskrbo za odvodne uporabnike, vključno z Ljubljano.",
    bad:          "Poletni nizki vodostaji Save postanejo hudi. Hidroelektrična proizvodnja na savski verigi elektrarn v sušnih letih občutno pade.",
    extreme:      "Umikanje ledenikov v Kamniško-Savinjskih Alpah se pospeši. Kamenje iz destabilizirajočih se pobočij ogroža infrastrukturo v dolini.",
    catastrophic: "Izguba zanesljive poletne savenice, ki jo napaja snežna odeja, ogroža hidroelektrično hrbtenico slovenskega elektroenergetskega sistema.",
  },
  Koper: {
    baseline:     "Edino slovensko morsko pristanišče, Jadransko morje, 10 m nadmorske višine. Sredozemsko podnebje: mile zime, suha poletja, burjni vetrovi.",
    moderate:     "Segrevanje morske gladine podaljšuje kopalno sezono. Tveganje suše se poleti povečuje z naraščajočim sredozemskim sušnim signalom.",
    bad:          "Vdor slane vode v obalne vodonosnike se krepi. Mediteranske invazivne vrste se ustanavljajo v slovenskih obalnih vodah.",
    extreme:      "Pogostost in resnost neviht s sodro narašča. Obalno kmetijsko zemljišče se sooča s slanostjo od morskih razpršilcev in vdorov podzemne vode.",
    catastrophic: "Dvig gladine Jadranskega morja ogroža pristaniško infrastrukturo in obalno kmetijstvo. Ekstremni burjni dogodki se krepijo z naraščajočimi temperaturnimi gradienti.",
  },
  Novo_Mesto: {
    baseline:     "Dolina reke Krke, jugovzhodna Slovenija, 220 m. Celinsko s ponekod panonskim vplivom. Pomembna regija za sadje — jabolka, hruške in hmelj.",
    moderate:     "Segrevanje podaljšuje brezzmrzalno rastno sezono, a povečuje poletni sušni stres na povodju reke Krke.",
    bad:          "Osnovni pretok reke Krke poleti občutno upade. Pridelava hmelja se sooča z vročinskim in sušnim stresom, ki zahteva drago namakanje.",
    extreme:      "Večletne suše izčrpavajo reko Krko in podzemno vodo. Sadjarstvo in hmeljarstvo zahtevata temeljito prestrukturiranje.",
    catastrophic: "Ponavljajoča se sušna leta izčrpavajo osnovni pretok reke Krke. Hmeljarsko in sadjarsko gospodarstvo Dolenjske se sooča s temeljitim prestrukturiranjem.",
  },
  Murska_Sobota: {
    baseline:     "Severovzhodna panonska ravnina, 189 m. Najbolj celinsko postaja — najtoplejša poletja, najhladnejše zime, najmanj padavin. Intenzivno kmetijstvo: koruza, sončnice, pšenica.",
    moderate:     "Že najbolj sušno izpostavljena regija v Sloveniji. Dni z vročinskim stresom nad 35 °C naraščajo najhitreje. Primanjkljaj kmetijske vode je že občuten.",
    bad:          "Pridelki koruze in sončnic v sušnih letih padejo za 20–30 %. Poletni ekstremi nad 38 °C postanejo redni.",
    extreme:      "Večletna sušna zaporedja sesedejo tradicionalno kmetijstvo brez namakanja. Povpraševanje po namakanju preseže trajnostni donos reke Mure.",
    catastrophic: "Panonsko kmetijsko gospodarstvo se sooča s propadom pod trajnimi večletnimi sušami. Izčrpavanje podzemne vode se pospeši.",
  },
  Nova_Gorica: {
    baseline:     "Zahodna Slovenija, spodnja dolina Soče, 94 m. Sredozemsko-alpski prehod. Toplo in sončno z burjnimi vetrovi. Pomembna vinorodna regija.",
    moderate:     "Segrevanje pospešuje sredozemski trend sušenja. Burjni dogodki se morda okrepijo. Kakovost vin se preoblikuje z naraščanjem rastnih stopenj.",
    bad:          "Poletna suša naredi tradicionalno kraško vinogradništvo vse bolj odvisno od namakanja. Nizki poletni pretoki Soče ogrožajo ekologijo.",
    extreme:      "Hladnovodni ribolov Soče se sooča s toplotnim izumrtjem v spodnjih dosegih, ko poletne temperature presegajo toleranče.",
    catastrophic: "Ekstremna poletna suša naredi tradiconalno kraško in brdiško vinogradništvo neobstojno brez namakanja.",
  },
  Postojna: {
    baseline:     "Kraška planota, 549 m. Znana po temperaturnih inverzijah — hladen zrak se kopiči v kraški depresiji. Temperature v jamskem ekosistemu so stabilne pri 10 °C.",
    moderate:     "Segrevanje slabi temperaturne inverzije in zmanjšuje ekstremno hlajenje. Temperature v jamskem ekosistemu se začnejo premikati.",
    bad:          "Notranje jame začnejo izmerljivo naraščati. Pretok kraških izvirov poleti v sušah upada.",
    extreme:      "Endemska favna Postojnske jame — človeška ribica in jamski hrošči — se sooča s toplotnim in hidrološkim stresom.",
    catastrophic: "Napajanje kraškega vodonosnika popusti pod podaljšano sušo. Endemska favna Postojnske jame se sooča s toplotnim stresom brez poti pobega.",
  },
  Ptuj: {
    baseline:     "Najstarejše stalno poseljeno mesto v Sloveniji, dolina reke Drave, 228 m. Severovzhodna celinska cona. Vino, hmelj in žitno kmetijstvo.",
    moderate:     "Dogodki nizkih vodostajev Drave se pogostijo, kar vpliva na hladilno vodo za hidroelektrarno Formin nizvodno.",
    bad:          "Datumi trgatve se bistveno premaknejo naprej. Kmetijsko povpraševanje po vodi vse bolj nasprotuje ekološkim zahtevam pretoka.",
    extreme:      "Ekstremno nizki vodostaji Drave postanejo redni. Hidroelektrarna Formin se v sušnih letih sooča z obveznim omejevanjem.",
    catastrophic: "Kombinirani sušni in vročinski ekstremi destabilizirajo kmetijsko gospodarstvo v dravski dolini.",
  },
  Velenje: {
    baseline:     "Šaleška dolina, 405 m, osrednja Slovenija. Zgrajena okoli premogovništva. Gorska celinska mikroklima pod vplivom Šaleških jezer.",
    moderate:     "Ko premogovništvo upada, podnebni vplivi vključujejo povečano tveganje poplav v posedninskih conah.",
    bad:          "Šaleška jezera se soočajo z naraščajočim izhlapevanjem in cvetenjem alg. Upravljanje z vodo postane kompleksno.",
    extreme:      "Prehod po premogu oteži podnebne ekstreme. Načrtovani prehod na obnovljivo energijo se sooča s konflikti rabe tal.",
    catastrophic: "Upravljanje z vodo v posedninskih jezerih postane kritično z naraščajočim izhlapevanjem.",
  },
  Trbovlje: {
    baseline:     "Zasavje, savska soteska, 230 m. Najožja poseljena dolina v Sloveniji. Kotlinska lega ustvarja značilne temperaturne inverzije.",
    moderate:     "Segrevanje zmanjšuje zimske inverzije, ki kopičijo onesnaženost zraka, a povečuje poletni toplotni stres v zaprti dolini.",
    bad:          "Poletni vročinski valovi v soteski so okrepljeni z njeno geometrijo in industrijskimi toplotnimi viri.",
    extreme:      "Ekstremni padavinski dogodki nad Trbovljami povečujejo katastrofalno tveganje poplav v soteski.",
    catastrophic: "Ekstremni vročinski valovi v soteski so okrepljeni z njeno geometrijo. Tveganje poplav Save narašča z naraščajočimi alpskimi padavinami.",
  },
  Tolmin: {
    baseline:     "Dolina Soče/Isonzo, 194 m. Najtoplejša dolina v Sloveniji kljub alpski legi. Ekstremni padavinski dogodki naredijo to območje najdežnejše v Evropi.",
    moderate:     "Segrevanje krepi že tako ekstremne padavinske dogodke. Izjemna biotska raznovrstnost doline se sooča z naraščajočim toplotnim pritiskom.",
    bad:          "Poletni pretoki Soče občutno upadejo. Hladnovodni habitat marmornega postrva se krči navzgor po toku.",
    extreme:      "Ekstremni poplavni dogodki na sistemu Soča–Idrijca se ponavljajo pogosteje. Smaragdna barva Soče zbledi z umikanjem ledenikov.",
    catastrophic: "Katastrofalni poplavni dogodki na Soči postanejo pogostejši. Hladnovodni ribolov in naravni turizem sta temeljno ogrožena.",
  },
  Kocevje: {
    baseline:     "Regija Kočevski Rog, 467 m, pokrita z največjim ostankom pragozdov v Srednji Evropi. Medvedi, risi in volkovi v največji gostoti v Evropi.",
    moderate:     "Segrevanje premakne sestavo gozda k termofilnim vrstam. Izbruhi lubadarja se pospešijo v toplejših, sušnejših poletjih.",
    bad:          "Pragozd se sooča s strukturno preobrazbo pod kombiniranim pritiskom suše in lubadarja.",
    extreme:      "Obsežno odmiranje gozda odpre pragozd tveganju požarov, ki je bilo prej zanemarljivo.",
    catastrophic: "Kočevski pragozd se sooča z nepopravljivo strukturno spremembo. Habitat velikih zveri se krči z upadanjem gozda.",
  },
  Ilirska_Bistrica: {
    baseline:     "Pivška kotlina, 440 m. Prehodno območje med sredozemskim in celinskim podnebjem. Reka Pivka izgine pod zemljo v največji jamski sistem na svetu.",
    moderate:     "Segrevanje zmanjšuje zimsko snežno odejo, ki napaja kraške izvire Pivke.",
    bad:          "Površinski pretok reke Pivke izgine zgodaj v sezoni, ko upadejo kraški izviri.",
    extreme:      "Jamski sistem Postojna–Planina se sooča z zmanjšanim pretokom in naraščajočimi temperaturami vode.",
    catastrophic: "Kraški izviri, ki napajajo reko Pivko, poleti presahnejo. Edinstveni hidrološki sistem je moten s kaskadnimi učinki.",
  },
  Domzale: {
    baseline:     "Ljubljanska kotlina, 301 m. Primestno in lahko industrijsko. Celinsko podnebje z nekoliko manjšim mestnim toplotnim otokom kot Ljubljana.",
    moderate:     "Z razširjanjem metropolitanske regije se mestni toplotni otoški učinki krepijo.",
    bad:          "Poletni toplotni otok po kotlini ustvarja trajen vročinski stres za 400.000 prebivalcev regije.",
    extreme:      "Kombinirani vročinski in sušni dogodki bistveno zmanjšajo kakovost življenja in povečajo smrtnost.",
    catastrophic: "Urbanizacija v kombinaciji s podnebnim segrevanjem ustvari trajen toplotni otok s kumulativnimi učinki na javno zdravje.",
  },
  Ratece: {
    baseline:     "Tarbizijska kotlina, Julijske Alpe, 864 m. Eno najsušnejših mest v Sloveniji kljub alpski legi. Ekstremno hladne zime, obilna snežna odeja.",
    moderate:     "Globina in trajanje snežne odeje se opazno zmanjšujeta. Čas spomladanskega odtajanja se premika naprej.",
    bad:          "Smučarsko letovišče Kranjska Gora se sooča z ekonomsko neobstojnimi snežnimi sezonami.",
    extreme:      "Taljenje permafrosta v Julijskih Alpah sproži naraščajoče kamenje in nestabilnost pobočij.",
    catastrophic: "Izguba zanesljive zimske snežne odeje konča smučarsko gospodarstvo v dolini Kranjske Gore.",
  },
  Kredarica: {
    baseline:     "Vrh masiva Triglava, 2514 m — najvišja meteorološka postaja v Sloveniji. Stalni sneg, ostanki ledenikov, ekstremni vetrovi.",
    moderate:     "Triglavski ledenik — zadnji ledenik v Sloveniji — se vidno umika. Segrevanje je tukaj dvojno od nižinskega.",
    bad:          "Triglavski ledenik izgubi več kot polovico preostalega volumna. Ikonična silhueta se sooča s trajno spremembo.",
    extreme:      "Triglavski ledenik popolnoma izgine. Visokogorski ekosistem nad gozdno mejo propade.",
    catastrophic: "Popolna izguba Triglavskega ledenika — narodni simbol in vir savinjskih rek. Propad alpskega ekosistema sproži kaskadne učinke.",
  },
};

// T-6.1 / T-6.2 (D-8) — the methodology document, editorial CONTENT rendered as an
// expandable block on the page (see components/MethodologyPanel.tsx).
//
// Stored VERBATIM as Slovenian markdown from the reviewed source METHODOLOGY.md
// (its `# Metodologija` H1 becomes the disclosure <summary>; the body below begins
// at the subtitle). The ONE authorised edit vs. the source is the contact address:
// the `[KONTAKT — dopolniti]` placeholder at METHODOLOGY.md:93 is filled with
// info@podnebnik.org (T-6.2 correction contact). The text is kept as a single
// markdown string — rather than hand-restructured into nested objects — so the
// reviewed wording is preserved byte-for-byte; a small block-markdown renderer in
// MethodologyPanel.tsx turns `##` headings, `-` bullets, `**bold**` and
// `[text](href)` links into accessible semantic markup.
//
// Markdown subset actually used below: `*italic*` (subtitle), `---` (section rule,
// rendered as spacing), `## heading`, `- bullet`, `**bold**`, `[text](href)`.
export const methodologyMarkdown = `*Kako nastanejo številke na strani »Ali je vroče?«*

---

## Na kratko

Ta stran prikazuje, kako topel je današnji dan v Sloveniji v primerjavi z zgodovino od leta 1950. Nekaj stvari, ki jih je dobro vedeti pri branju:

- **Podatki niso meritve slovenskih vremenskih postaj (ARSO).** Prihajajo iz **reanalize ERA5-Land** (evropski podatkovni model, dostopen prek arhiva Open-Meteo). Reanaliza združi meritve, satelite in fizikalni model v enotno mrežo vrednosti. Zato **številke niso neposredno primerljive** z uradnimi objavami ARSO, ki temeljijo na meritvah postaj.
- **Stran privzeto prikazuje najvišjo dnevno temperaturo (Tmax)** — »kako vroč je bil dan«. Povprečno in najnižjo temperaturo lahko izberete ročno, a nista privzeti (razlog je spodaj).
- **Vsaka postaja je višinsko popravljena.** Ker mreža modela ne leži točno na višini postaje, vrednosti prilagodimo za razliko v nadmorski višini. **Za Kredarico je ta popravek −7,85 °C** — daleč največji na strani. Podrobnosti so spodaj; navajamo jih odkrito, ker gre za velik poseg v prikazano vrednost.
- **»Slovenija« pomeni povprečje 18 postaj**, ne ene same nacionalne meritve. Postaje segajo od morske gladine (10 m) do Kredarice (2514 m).
- **Referenčno obdobje za odklone je 1991–2020** (veljavna klimatološka norma WMO). Ker je to razmeroma toplo obdobje, se velik del zapisov 1950–2026 prikaže kot negativni odklon.

Podroben tehnični opis sledi spodaj.

---

## Vir podatkov

Stran uporablja **reanalizo ERA5-Land**, dostopano prek **arhivskega API-ja Open-Meteo** (ne neposredno prek ECMWF/CDS). ERA5-Land je globalni reanalizni niz Evropskega centra za srednjeročne vremenske napovedi (ECMWF) z mrežno ločljivostjo približno 9 km.

Reanaliza ni isto kot meritev postaje. Je rekonstrukcija preteklega vremena, ki jo model ustvari z asimilacijo številnih virov opazovanj. Prednost je enotna, prostorsko in časovno polna pokritost brez vrzeli; slabost je, da posamezna mrežna celica ne ujame lokalnih posebnosti (npr. mestnega toplotnega otoka ali natančne mikrolokacije postaje).

Zadnjih ~6 dni prihaja iz predhodne različice reanalize (ERA5T), zato se te vrednosti lahko še spremenijo.

Za današnje in najnovejše vrednosti, kjer reanaliza še ni na voljo, stran uporabi napoved Open-Meteo. Takšna vrednost je na strani označena z **»napoved«**; reanalizne vrednosti oznake nimajo.

## Postaje

Stran zajema **18 lokacij** po Sloveniji. Za vsako je vrednost vzeta iz mrežne celice ERA5-Land nad njo. Nabor postaj sega od nižin do visokogorja — med drugim Koper (blizu morske gladine, ~10 m), Postojna (549 m), Rateče (864 m) in Kredarica (2514 m). Celoten razpon nadmorskih višin je **10–2514 m**.

## Višinski popravek (lapse-rate)

Mrežna celica ERA5-Land redko leži točno na nadmorski višini postaje. Da bi vrednosti ustrezale višini postaje in ne višini mrežne celice, vsako popravimo s **fiksno stopnjo 6,5 °C na kilometer** razlike med višino postaje in višino mrežne celice. To je standardna vrednost povprečne stopnje ohlajanja ozračja z višino.

Za 17 od 18 postaj je ta popravek majhen. **Za Kredarico je velik: −7,85 °C.** Postaja leži na 2514 m, pripadajoča mrežna celica ERA5-Land pa na 1307 m — razlika 1207 m, kar pri 6,5 °C/km da popravek −7,85 °C. To je **daleč največji posamezni popravek na strani.**

Odkrito navajamo njegove omejitve:

- Popravljene vrednosti ERA5-Land za Kredarico smo **primerjali z meritvami ARSO in so bile blizu.** A šlo je za primerjavo, **ne za sistematično validacijo** — ni bila opravljena analiza pristranskosti po mesecih.
- Fiksna stopnja 6,5 °C/km je **povprečje za prosto ozračje.** Dejanska prizemna stopnja nad gorskim pobočjem se spreminja s sezono in se lahko **splošči ali celo obrne pri zimskih temperaturnih inverzijah.** Popravek je torej lahko dober v letnem povprečju, a sistematično odstopa v posameznih mesecih (predvsem pozimi).
- Empirični popravek po postaji in mesecu bi bil boljša dolgoročna rešitev; zaenkrat ni izveden.

## Katera temperatura je privzeta

Stran privzeto vodi z **najvišjo dnevno temperaturo (Tmax)** — na prvih karticah, ob nalaganju in v trendu, ki ga stran postavi v ospredje. Povprečna (Tmean) in najnižja (Tmin) dnevna temperatura sta na voljo za ročno izbiro, a nista privzeti.

Razlog je kakovost podatkov. Reanaliza ERA5-Land sistematično slabše oceni **najnižjo** temperaturo v pozidanih območjih, ker mreža ne razreši mestnega toplotnega otoka. Ker se **povprečna** temperatura izračuna tudi iz najnižje, to pristranskost podeduje — ravno v naseljenih krajih, ki bralce najbolj zanimajo. Najvišja dnevna temperatura te pristranskosti ne nosi in se ujema z vprašanjem strani (»ali je vroče« — občutena dnevna vročina). Zato stran vodi s Tmax, izbira Tmean/Tmin pa ostaja bralcu, ki omejitev razume.

## Kaj pomeni »Slovenija«

Nacionalna vrednost je **neuteženo povprečje vseh 18 postaj**, vključno z višinsko popravljeno Kredarico — na strani poimenovano »povprečje 18 postaj«, s prikazanim naborom postaj in razponom višin.

Uteževanje po površini ali višinskih pasovih smo pretehtali in **zavrnili**: ker je nad 1000 m le ena postaja (Kredarica), bi ta sama nosila cel višinski pas. To bi bilo videti natančno, a bi slonelo na eni sami točki. Neuteženo povprečje nad vidnim, poimenovanim naborom postaj je poštenejša konstrukcija.

## Časovni pas in dnevna meja

Dnevne vrednosti in meja »danes« sta določeni po času **Europe/Ljubljana**. Dnevni podatki so agregirani iz arhiva Open-Meteo v tem časovnem pasu. (Dan po UTC bi napačno razvrstil skrajne vrednosti blizu lokalne polnoči, kar je najbolj občutljivo pri štetju tropskih noči.)

## Referenčno obdobje in odkloni

Odkloni (koliko je dan topel »glede na normalo«) se merijo proti **referenčnemu obdobju 1991–2020** — veljavni klimatološki normali WMO — enotno po vsej strani.

Ena posledica je pomembna za branje: ker je 1991–2020 razmeroma toplo obdobje, se **velik del zapisov 1950–2026 prikaže kot negativni odklon.** To ni napaka, temveč posledica primerjave s toplo sodobno normalo.

**Izjema — SPEI (suša):** indeks suše SPEI je ločen in umerjen na obdobje **1950–1980**, ne 1991–2020. Absolutni pragovi (npr. za vroče dneve in tropske noči) na referenčno obdobje niso vezani.

## Porazdelitev in percentil

Za vsak dan v letu stran prikaže **porazdelitev** preteklih vrednosti (kako pogosti so bili posamezni odkloni) in **percentil** današnje vrednosti (topleje od kolikšnega deleža primerjalnih dni).

- Porazdelitev je **empirična ocena gostote (KDE)** — sledi dejanski obliki podatkov — ne simetrična zvonasta (Gaussova) krivulja. Temperaturne porazdelitve so pogosto nesimetrične, zato bi Gaussova krivulja napačno prikazala repe, ravno tam, kjer se presoja »kako izjemen je današnji dan«.
- Nacionalna krivulja je **povprečje 18 krivulj posameznih postaj**, ne skupni bazen vzorcev — s čimer ohrani pomen »povprečja 18 postaj«.
- Percentil je **pravi empirični percentil**, izračunan iz te krivulje (integral gostote do današnje vrednosti), ne približek iz barvnega pasu.

Primerjalni vzorec za vsak koledarski dan je **združeno okno ±7 dni** čez vsa leta — tako ima vsak dan dovolj gost in stabilen vzorec. **Isto okno ±7 dni** uporablja tudi letni trend: vsaka letna točka na grafu trenda je **povprečje** vrednosti v tem oknu za posamezno leto — pri padavinah in ET₀ pa **vsota**, saj sta to globini v mm in ima smisel le seštevek. **29. februar** se pri tem pridruži oknu 28. februarja (redki prestopni dnevi se ne obravnavajo kot ločen, statistično šumeč dan). Objavljena vrednost povsod uporablja okno ±7 dni; v panelu z analizo trendov lahko bralec izbere tudi ožje ali širše okno, kar velja le za tisti prikaz.

## Pragovi za »vroče«

Štetje vročih dni in tropskih noči uporablja **stroge pragove (\`>\`, ne \`≥\`).** To je usklajeno s standardom ETCCDI/ECA&D (medtem ko npr. nemški DWD uporablja \`≥\`). Standard je dejansko sporen; izbrali smo \`>\`. Sprememba na \`≥\` bi premaknila štetje vsakega mejnega dne, zato je izbira zapisana zavestno.

## Trend vročih dni in tropskih noči

Letni trend na grafih vročih dni in tropskih noči je **model negativne binomske regresije (NB GLM)** čez letno število — primeren za štetne podatke z večjo razpršenostjo od Poissonove. Gre za **približek**, ne za dokončno napoved: prikazana stopnja rasti in projekcija do leta 2050 sta odvisni od izbranega praga in dolžine zaporedja.

**Trenda ne prikažemo, kadar mu ne moremo zaupati.** Za nekatere kombinacije (redki dogodki, skoraj ravna letna vrsta) statistični model ne da zanesljivega rezultata — ne skonvergira ali pa ocena njegove negotovosti ni veljavna. V takih primerih trenda **ne objavimo** (letno štetje ostane prikazano), namesto da bi navedli navidezno natančno, a nezanesljivo številko. Enako velja, kadar je premalo let s podatki (potrebnih je vsaj 10). To je isto načelo kot pri indeksu suše SPEI: raje odklonimo objavo kot da objavimo negotovo vrednost.

## Znane omejitve

- **Ni ARSO.** Vrednosti so reanaliza ERA5-Land, ne meritve postaj, in **niso neposredno primerljive** z objavami ARSO.
- **Višinski popravek Kredarice** (−7,85 °C) je velik, preverjen a ne validiran po mesecih, in lahko odstopa pozimi (glej zgoraj).
- **ERA5-Land Tmin** je v mestih nezanesljiv (toplotni otok); zato stran privzeto ne vodi s Tmean/Tmin.
- **Mrežna ločljivost** (~9 km) ne ujame lokalnih posebnosti pod to velikostjo.
- **Najnovejše vrednosti** so lahko napoved (označene z »napoved«), dokler reanaliza ni na voljo.
- **Trend vročih dni/tropskih noči je približek** in ni na voljo za vse kombinacije praga in zaporedja: kjer se model ne ustali, trenda ne prikažemo (glej zgoraj).

---

*Za morebitne popravke ali vprašanja o metodologiji nas kontaktirajte na [info@podnebnik.org](mailto:info@podnebnik.org).*`;
