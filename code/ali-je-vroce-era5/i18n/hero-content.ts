// T-6.32 (D-8) — per-location HeroCards content.
//
// Two single-locale editorial tables, keyed language-neutrally so a second
// locale swaps VALUES only:
//   • stationDescriptions — one physical-setting description per station, keyed
//     by era5_name (ASCII). Shown at EVERY trend band: it says what the place IS
//     and what the warming trend acts on there (terrain, water source, climate
//     driver), never an outcome.
//   • categoryTexts — one explanation per trend band, keyed by the same
//     baseline|moderate|bad|extreme|catastrophic keys as trendCategory(). It
//     states what the number means, not what it will cause.
//
// This REPLACES the former heroContext (18 stations x 5 bands = 90 narratives)
// and climateRisks (18 impact labels). The risk labels were removed: they named
// outcomes rather than exposures, two were factually wrong, and none was
// sourced. Wording is the operator's (D-8); typed, not pasted (T-5.12), and
// guarded by tests/unit/text-integrity.test.ts.

export const stationDescriptions: Record<string, string> = {
  Ljubljana:        "Leži v Ljubljanski kotlini, sklenjeni kotlini med Alpami in kraškim svetom, na jugu ob Ljubljanskem barju. Vbočena lega pozimi ujame hladen zrak, zato so pogosti temperaturni obrati in megla (v povprečju okoli 64 meglenih dni na leto). Ker je kotlina slabo prevetrena, se poletna vročina v njej kopiči in segrevanje se tu izrazi močneje. Podnebje je zmerno celinsko.",
  Maribor:          "Leži ob Dravi tam, kjer reka zapušča alpski svet ob vznožju Pohorja in prehaja proti Panonski nižini, zato ima izrazito celinsko podnebje s toplimi poletji. Drava je alpska reka, ki jo napaja gorski sneg; take reke so občutljive na segrevanje, saj toplejše zime pomikajo taljenje bolj zgodaj in znižujejo poletni pretok. Proti vzhodu se krepi tudi sušna izpostavljenost.",
  Celje:            "Leži v Celjski kotlini v spodnji Savinjski dolini, na nizki ravnini, kamor se v Savinjo stekajo Hudinja, Ložnica in Voglajna. Nizko ležeče sotočje v kotlini je izpostavljeno poplavam Savinje; za to porečje so izdelane karte poplavne nevarnosti, urejanje struge z nasipi pa je zmanjšalo naravne zadrževalne površine in pospešilo poplavni val. Podnebje je zmerno celinsko.",
  Kranj:            "Leži na terasi nad sotočjem Save in Kokre, v Gorenjski ravnini, ki jo obdajajo Julijske Alpe in Karavanke na severozahodu ter Kamniško-Savinjske Alpe na vzhodu. Kokra je v teraso vrezala globoko sotesko. Savo in Kokro napaja gorski sneg, zato sta občutljivi na segrevanje: toplejše zime taljenje pomaknejo bolj zgodaj in znižajo poletni pretok.",
  Koper:            "Leži na ozkem obalnem pasu ob Jadranskem morju, v istrskem gričevju na skrajnem jugozahodu. Morje blaži temperature, zato je podnebje submediteransko z milimi, vlažnimi zimami in vročimi, suhimi poleti. Poletja so že suha, s segrevanjem pa se sušni pritisk krepi. Obalo občasno zajame burja, hladen sunkovit severovzhodnik s kraškega zaledja.",
  Novo_Mesto:       "Leži na terasi v okljuku reke Krke na jugovzhodu, v dolenjskem gričevju iz apnenca in dolomita. Krka je kraška reka, ki izvira iz kraških izvirov; njen poletni pretok je odvisen od zalog v krasu in dežja, suše pa so vse pogostejše. Podnebje je zmerno celinsko.",
  Murska_Sobota:    "Leži na ravnem, odprtem delu Panonske nižine v Prekmurju, blizu reke Mure, v skrajnem severovzhodnem kotu države. Odprta lega brez morskega blaženja se hitro segreva in izsušuje; ta del države ima med najnižjimi količinami padavin in je najbolj sušno izpostavljen, pogostost kmetijskih suš pa narašča.",
  Nova_Gorica:      "Leži tam, kjer se dolina Soče odpira proti Furlanski nižini, ob italijanski meji, v submediteranskem podnebju s toplimi, sončnimi poletji. Poletja so že suha, s segrevanjem pa se sušni pritisk krepi. Skozi Vipavsko dolino in Goriško z zaledne planote (Trnovski gozd, Nanos) pogosto piha burja, hladen sunkovit severovzhodnik. Okoliško flišno gričevje Brd je nagnjeno k zemeljskim plazovom.",
  Postojna:         "Leži na kraški planoti Notranjske, v Postojnski kotlini, kjer reka Pivka pod hribom Sovič ponikne v podzemlje in nadaljuje pot skozi kras. Vsa voda tod je vezana na kras, na izvire in podzemne tokove, njen pretok pa je odvisen od dežja in kraških zalog; suše postajajo vse pogostejše. Dvignjena kraška lega prinaša hladnejše podnebje kot v nižinah.",
  Ptuj:             "Leži ob Dravi na odprti Ptujski (Dravski) ravnini na severovzhodu, v zmerno celinskem podnebju s panonskim pridihom in toplimi poletji. Odprta celinska lega se hitro segreva in izsušuje, sušna izpostavljenost severovzhoda pa je med največjimi v državi. Drava je alpska reka, katere prodna ravnina hrani obsežen vodonosnik.",
  Velenje:          "Leži v Šaleški dolini, kotlini med Kamniško-Savinjskimi Alpami in Pohorjem, ob reki Paki. V dnu kotline ležijo Šaleška jezera, ki vplivajo na lokalno podnebje doline. V slabo prevetreni kotlini se poletna vročina kopiči, zato se segrevanje tu izrazi močneje.",
  Trbovlje:         "Leži na dnu ozke doline levega pritoka Save v Zasavju, ki jo zapirajo hribi Posavskega hribovja. Ozka, zaprta lega in temperaturni obrati zadržujejo hladen zrak pri dnu doline, poletna vročina pa se v zaprti dolini kopiči.",
  Tolmin:           "Leži na terasi nad sotočjem Soče in Tolminke, na južnem robu Julijskih Alp. Gore silijo vlažen zrak v dvig, zato so padavine obilne; strma pobočja in obilne padavine povečujejo poplavno izpostavljenost Soče in njenih pritokov. Sočo napaja gorski sneg, zato je njen poletni pretok občutljiv na toplejše zime.",
  Kocevje:          "Leži v gozdnati dinarski kraški kotlini ob kraški reki Rinži, pod planoto Kočevski Rog na jugu države. Dinarski svet prestreza vlažen zrak, zato so padavine obilne, voda pa ponika v kras. V kraških kotanjah se ob jasnih nočeh nabira hladen zrak. Poletni pretok kraških voda je odvisen od zalog in dežja, suše pa so vse pogostejše.",
  Ilirska_Bistrica: "Leži v dolini reke Reke pod gozdnato planoto Snežnik, na prehodu med submediteranskim in celinskim podnebjem. Reka izvira iz kraških izvirov pod Snežnikom, teče mimo mesta in se niže ponori v podzemlje (v Škocjanske jame). Njen pretok je vezan na kraške izvire in dež, suše pa so vse pogostejše.",
  Domzale:          "Leži v severovzhodnem delu Ljubljanske kotline ob reki Kamniški Bistrici, ki priteka iz Kamniško-Savinjskih Alp. Kotlinska lega prinaša podobne zimske temperaturne obrate in meglo kot v širši ljubljanski okolici, v slabo prevetreni kotlini pa se poletna vročina kopiči. Podnebje je zmerno celinsko.",
  Ratece:           "Alpska vas leži na dnu široke, ravne zgornje Savske doline v Julijskih Alpah, blizu tromeje z Italijo in Avstrijo. Ravno dno pod jasnim nebom ujame hladen zrak, zato je Rateče eno najhladnejših naseljenih krajev v Sloveniji, z obilno in dolgotrajno snežno odejo (povprečno okoli 234 cm snega na leto). S toplejšimi zimami se količina in trajanje snežne odeje zmanjšujeta.",
  Kredarica:        "Najvišja meteorološka postaja v Sloveniji stoji na 2514 m na pobočju Triglava v Julijskih Alpah, visoko nad gozdno mejo. Zaradi višine in severne lege se sneg obdrži globoko v poletje. Snežna odeja se s segrevanjem krajša, bližnji Triglavski ledenik pa se krči. To visokogorje je izvirno območje voda, ki tečejo v porečje Save.",
};

export const categoryTexts: Record<string, string> = {
  baseline:     "Trend za ta dan v letu je pod 0,05 °C na desetletje, kar pomeni, da segrevanja tako rekoč ni zaznati oziroma je znotraj statističnega šuma.",
  moderate:     "Trend je med 0,05 in 0,10 °C na desetletje: blago, a zaznavno segrevanje, približno pol do ene stopinje na stoletje.",
  bad:          "Trend je med 0,10 in 0,20 °C na desetletje: jasno segrevanje, približno ena do dve stopinji na stoletje.",
  extreme:      "Trend je med 0,20 in 0,30 °C na desetletje: hitro segrevanje, približno dve do tri stopinje na stoletje.",
  catastrophic: "Trend je 0,30 °C na desetletje ali več: zelo hitro segrevanje, tri ali več stopinj na stoletje. To je najvišja, navzgor odprta kategorija.",
};
