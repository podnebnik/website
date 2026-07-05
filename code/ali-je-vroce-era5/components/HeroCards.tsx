import { createResource, Show } from "solid-js";
import { fetchRegression } from "../api.ts";
import type { RegressionResponse, RegressionResult } from "../types.ts";

// ── Inlined locale (from sl_default.json hero / hero_category / hero_context / climate_risks) ──

const VERDICT_WARMING = "Sto let segrevanja za <em>{sign}{t100} {unit}</em> – pri trenutnem tempu vsaka <em>{yrs} let</em> doda eno stopinjo.";
const VERDICT_COOLING = "Sto let ohlajanja za <em>{sign}{t100} {unit}</em> – pri trenutnem tempu vsaka <em>{yrs} let</em> odšteje eno stopinjo.";
const VERDICT_NONE    = "Na ta dan v letu ni zaznati trenda.";
const METHOD_THEILSEN = "Theil-Sen + TFPW Mann-Kendall";

const CATEGORIES: Record<string, string> = {
  catastrophic: "Katastrofalno",
  extreme:      "Ekstremno",
  bad:          "Slabo",
  moderate:     "Zmerno",
  baseline:     "Izhodiščno",
};

const CAT_STYLE: Record<string, { background: string; color: string }> = {
  catastrophic: { background: "#962c1a", color: "#fff" },
  extreme:      { background: "#C25A2C", color: "#fff" },
  bad:          { background: "#c2843a", color: "#fff" },
  moderate:     { background: "#b5a06a", color: "#fff" },
  baseline:     { background: "#6c8fb6", color: "#fff" },
};

const CLIMATE_RISKS: Record<string, string> = {
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

const HERO_CONTEXT: Record<string, Record<string, string>> = {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendCategory(trend10: number): string {
  if (trend10 >= 0.30) return "catastrophic";
  if (trend10 >= 0.20) return "extreme";
  if (trend10 >= 0.10) return "bad";
  if (trend10 >= 0.05) return "moderate";
  return "baseline";
}

function stars(p: number): string {
  if (p < 0.001) return "★★★  p < 0.001";
  if (p < 0.01)  return "★★  p < 0.01";
  if (p < 0.05)  return `★  p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(3)} (ns)`;
}

function ar1Label(ar1: number | null): string {
  if (ar1 === null) return "—";
  const abs = Math.abs(ar1);
  const d   = abs < 0.1 ? "zanemarljiva" : abs < 0.3 ? "šibka" : "zmerna";
  return `AR(1) = ${ar1} · ${d}`;
}

function verdictHtml(st: RegressionResult["stats"], unit: string): string {
  if (st.trend10 === 0) return VERDICT_NONE;
  const isPos  = st.trend10 > 0;
  const sign   = isPos ? "+" : "−";
  const t100   = (Math.abs(st.trend10) * 10).toFixed(2);
  const yrs    = (Math.abs(10 / st.trend10)).toFixed(1);
  const tmpl   = isPos ? VERDICT_WARMING : VERDICT_COOLING;
  return tmpl
    .replace("{sign}", sign)
    .replace("{t100}", t100)
    .replace("{unit}", unit)
    .replace("{yrs}", yrs);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  loc:        string | null;
  doy:        number;
  dateLabel?: string;
}

const ACCENT   = "var(--color-ink)";
const INK_SOFT = "var(--color-ink-soft)";
const MONO     = { "font-family": "var(--font-mono)" };
const SANS     = { "font-family": "var(--font-sans)" };

export function HeroCards(props: Props) {
  const loc = () => props.loc ?? "Ljubljana";

  const [resp] = createResource(
    () => ({ loc: loc(), doy: props.doy }),
    ({ loc, doy }) =>
      fetchRegression({ locs: [loc], var: "temperature_max", doy, window: 7, corr: "corr", method: "theilsen" }),
  );

  return (
    <Show when={resp()?.results?.length}>
      <HeroCard res={resp()!.results[0]!} unit={resp()!.unit} dateLabel={resp()!.date_label} />
    </Show>
  );
}

function HeroCard(props: { res: RegressionResult; unit: string; dateLabel: string }) {
  const res = () => props.res;
  const st  = () => res().stats;
  const cat = () => trendCategory(st().trend10);
  const isPos = () => st().trend10 >= 0;
  const sign  = () => isPos() ? "+" : "−";
  const signColor = () => isPos() ? "#C25A2C" : "#3A5A8A";

  const nValues = () => (st() as any).n_values as number | undefined;

  const ctx = () => HERO_CONTEXT[res().loc]?.[cat()] ?? HERO_CONTEXT[res().loc]?.["baseline"];
  const risk = () => CLIMATE_RISKS[res().loc];

  return (
    <div style={{
      background:    "var(--color-card)",
      border:        "1px solid var(--color-rule)",
      "border-radius": "var(--radius, 10px)",
      overflow:      "hidden",
    }}>

      {/* Top row: eyebrow + trend stat + verdict */}
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "0", "border-bottom": "1px solid var(--color-rule)" }}>

        {/* Left column: eyebrow + stat */}
        <div style={{ flex: "0 0 240px", padding: "18px 20px 16px", "border-right": "1px solid var(--color-rule)" }}>
          {/* Eyebrow */}
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "12px", "flex-wrap": "wrap" }}>
            <span style={{ ...SANS, "font-size": "15px", "font-weight": "600", color: "var(--color-ink)" }}>
              {res().loc.replace(/_/g, " ")}
            </span>
            <span style={{ width: "4px", height: "4px", "border-radius": "50%", background: "var(--color-ink-soft)", display: "inline-block", "flex-shrink": "0" }} />
            <span style={{ ...MONO, "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase" }}>
              {props.dateLabel} · temperature max
            </span>
          </div>

          {/* Trend number */}
          <div style={{ display: "flex", "align-items": "baseline", gap: "4px", "margin-bottom": "6px" }}>
            <span style={{ "font-family": "var(--font-serif)", "font-size": "42px", "font-weight": "400", "line-height": "1", color: signColor() }}>
              {sign()}{Math.abs(st().trend10).toFixed(3)}
            </span>
            <span style={{ ...MONO, "font-size": "13px", color: "var(--color-ink-soft)" }}>
              °C / decade
            </span>
          </div>

          {/* Climate risk label */}
          <Show when={risk()}>
            <div style={{ "margin-top": "8px" }}>
              <div style={{ ...MONO, "font-size": "9px", "letter-spacing": "0.08em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "margin-bottom": "3px" }}>
                Tveganje vpliva:
              </div>
              <div style={{ ...SANS, "font-size": "11px", color: "var(--color-ink-soft)", "line-height": "1.45" }}>
                {risk()}
              </div>
            </div>
          </Show>
        </div>

        {/* Right column: verdict + category */}
        <div style={{ flex: "1 1 280px", padding: "18px 20px 16px", display: "flex", "flex-direction": "column", gap: "10px" }}>

          {/* Category badge */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={{
              ...MONO,
              "font-size":      "10px",
              "font-weight":    "500",
              "letter-spacing": "0.08em",
              "text-transform": "uppercase",
              padding:          "3px 10px",
              "border-radius":  "20px",
              ...CAT_STYLE[cat()],
            }}>
              {CATEGORIES[cat()]}
            </span>
          </div>

          {/* Context text */}
          <Show when={ctx()}>
            <p style={{ ...SANS, margin: "0", "font-size": "13px", color: "var(--color-ink-soft)", "line-height": "1.55" }}>
              {ctx()}
            </p>
          </Show>

          {/* Verdict */}
          <div>
            <p style={{ ...SANS, margin: "0 0 2px", "font-size": "13px", color: "var(--color-ink)", "line-height": "1.55" }}
               innerHTML={verdictHtml(st(), props.unit)} />
            <p style={{ ...MONO, margin: "0", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.05em" }}>
              {METHOD_THEILSEN}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", "flex-wrap": "wrap", "border-top": "0" }}>
        {([
          ["Significance", stars(st().p_val)],
          [st().metric_lbl, st().metric.toFixed(4)],
          ["Sample", nValues() ? `${nValues()!.toLocaleString()} opazovanj · ${st().n_years} let` : `${st().n_years} let`],
          ["Autocorrelation", ar1Label(st().ar1)],
        ] as [string, string][]).map(([k, v], i) => (
          <div style={{
            flex:            "1 1 160px",
            padding:         "10px 16px 10px",
            "border-right":  i < 3 ? "1px solid var(--color-rule)" : "none",
            "border-top":    "1px solid var(--color-rule)",
          }}>
            <div style={{ ...MONO, "font-size": "9px", "letter-spacing": "0.08em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "margin-bottom": "3px" }}>
              {k}
            </div>
            <div style={{ ...MONO, "font-size": "11px", color: "var(--color-ink)" }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
