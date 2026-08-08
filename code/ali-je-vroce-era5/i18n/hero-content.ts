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
