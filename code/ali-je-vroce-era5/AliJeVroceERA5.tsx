import { createSignal, createResource, createMemo, Show, Suspense, lazy } from "solid-js";
import { fetchMeta, fetchPageData, fetchSpeiHeatmap, fetchSpeiStationSeasonal, ERA5_NATIONAL } from "./api.ts";
import { TodayCard } from "./components/TodayCard.tsx";
import { DistributionChart } from "./charts/DistributionChart.tsx";
import { TodayTrendChart } from "./components/TodayTrendChart.tsx";
import { RegressionPanel, RegToolbar, RegScatterCard, RegYearRoundCard, useReg,
         panelHStyle, panelTitleStyle, panelSubStyle } from "./components/RegressionPanel.tsx";
import type { SiteMeta } from "./types.ts";

const Era5SeasonHeatmapChart = lazy(() => import("./charts/Era5SeasonHeatmap.tsx").then(m => ({ default: m.Era5SeasonHeatmap })));
const StationMap             = lazy(() => import("./components/StationMap.tsx").then(m => ({ default: m.StationMap })));
const HeroCardsPanel         = lazy(() => import("./components/HeroCards.tsx").then(m => ({ default: m.HeroCards })));
const Era5TropicalChart      = lazy(() => import("./charts/Era5TropicalChart.tsx").then(m => ({ default: m.Era5TropicalChart })));
const SpeiHeatmapChart       = lazy(() => import("./charts/SpeiHeatmap.tsx").then(m => ({ default: m.SpeiHeatmap })));
const SpeiTrendChartLazy     = lazy(() => import("./charts/SpeiTrendChart.tsx").then(m => ({ default: m.SpeiTrendChart })));
const SeaLevelChart          = lazy(() => import("./charts/SeaLevelWidget.tsx").then(m => ({ default: m.SeaLevelWidget })));

const EN_MONTHS: Record<string, string> = {
  Jan:"01", Feb:"02", Mar:"03", Apr:"04", May:"05", Jun:"06",
  Jul:"07", Aug:"08", Sep:"09", Oct:"10", Nov:"11", Dec:"12",
};
function fmtDayLabel(dl: string): string {
  const [mon, day] = dl.split(" ");
  return `${(day ?? "").padStart(2, "0")}.${EN_MONTHS[mon ?? ""] ?? "??"}`;
}

function dateToDoy(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

export function AliJeVroceERA5() {
  const [meta] = createResource<SiteMeta>(fetchMeta);
  return (
    <Show when={meta()} fallback={<div class="px-10 py-8 text-[var(--color-ink-soft)]">Nalaganje…</div>}>
      {(m) => <Dashboard meta={m()} />}
    </Show>
  );
}

function Dashboard(props: { meta: SiteMeta }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = createSignal(today);

  const era5Stations = props.meta.stations.filter(s => s.source === "era5");
  const defaultLoc = props.meta.default_location ?? "Ljubljana";
  // Page opens on the Slovenia national ERA5 average
  const [loc, setLoc] = createSignal<string | null>(ERA5_NATIONAL);
  const isNat = createMemo(() => loc() === ERA5_NATIONAL);

  const defaultDoy = createMemo(() => dateToDoy(date()));
  const era5Meta = (): SiteMeta => ({ ...props.meta, stations: era5Stations, default_location: defaultLoc });

  const [pageData] = createResource(
    () => ({ date: date(), loc: loc() }),
    ({ date, loc }) => fetchPageData(date, loc),
  );
  const pageDataResolved = () => pageData() ?? pageData.latest;
  const todayData = () => pageDataResolved()?.status;
  const last7Data = () => pageDataResolved()?.last7;

  const [mapLoc, setMapLoc] = createSignal<string | null>(null);

  return (
    <div>

      {/* ── Today status section ──────────────────────────────────── */}
      <section class="today-status">
        <div class="sec-heading">
          <div class="today-heading-text">
            <span class="today-heading-title">ERA5 — Ali je vroče?</span>
            <span class="today-heading-subtitle">reanaliza ERA5-Land v primerjavi z zgodovinskimi percentili</span>
          </div>
        </div>

        <div class="today-grid">
          <Show
            when={todayData()}
            fallback={<div style={{ "min-height": "480px", "grid-column": "1 / -1" }} class="animate-pulse rounded-xl bg-[var(--color-paper-2)]" />}
          >
            {(r) => (
              <TodayCard
                data={r()}
                last7={last7Data()}
                meta={era5Meta()}
                date={date()}
                today={today}
                loading={pageData.loading}
                onDateChange={setDate}
                onLocChange={(v) => setLoc(v === "" ? ERA5_NATIONAL : (v || ERA5_NATIONAL))}
                nationalLoc={ERA5_NATIONAL}
              />
            )}
          </Show>

          <Show when={todayData()?.available}>
            <div class="today-chart">
              <div class="today-chart-title">
                {isNat()
                  ? `Dnevne najvišje temperature v Sloveniji za dva tedna okoli ${fmtDayLabel(todayData()!.day_label ?? "")} od ${todayData()!.year_min}`
                  : `Dnevne najvišje temperature na postaji ${todayData()!.loc!.replace(/_/g, " ")} za dva tedna okoli ${fmtDayLabel(todayData()!.day_label ?? "")} od ${todayData()!.year_min}`}
              </div>
              <DistributionChart data={todayData()!} chartId="dist-chart" />
              <p class="today-explain" style={{ "font-size": "12px", "padding-top": "6px" }}>
                Krivulja prikazuje, kako pogosto se je pojavila vsaka vrhunska temperatura na dneve, kot je danes, v vseh letih. Barve označujejo klimatološke cone — od hladne modre prek tipičnega bežastega pasu do ekstremne rdeče.
              </p>
              <div class="today-foot">
                {`${isNat() ? "Slovenija" : "Danes"}: ${todayData()!.today_temp!.toFixed(1)} °C · ${todayData()!.percentile!.toFixed(0)}. percentil · mediana ${todayData()!.cutoffs!.p50.toFixed(1)} °C · ${(todayData()!.n_samples ?? 0).toLocaleString()} opazovanj · ${todayData()!.year_min}–${todayData()!.year_max}`}
              </div>
            </div>
          </Show>

          {/* National (pooled) or per-station annual trend with projection */}
          <Show when={todayData()?.available}>
            <TodayTrendChart date={date()} loc={loc()} />
          </Show>
        </div>
      </section>

      {/* ── Regression section (ERA5) — own station picker, always shown ── */}
      <RegressionPanel
        meta={era5Meta()}
        defaultDoy={defaultDoy()}
        syncLoc={mapLoc}
        onLocChange={setMapLoc}
      >
        <div class="sec-hs">Analiza trendov · ERA5-Land reanaliza</div>

        <RegToolbar />

        <div class="main-row">

          {/* Map panel */}
          <div class="reg-card" style={{ background: "var(--color-paper)" }}>
            <div style={{ ...panelHStyle, background: "var(--color-card)" }}>
              <div>
                <div style={panelTitleStyle}>
                  {mapLoc() ? mapLoc()!.replace(/_/g, " ") : "Slovenija — vse postaje"}
                </div>
                <div style={{ ...panelSubStyle, "margin-top": "3px" }}>
                  {era5Stations.length} postaj · ERA5
                </div>
              </div>
            </div>
            <Suspense fallback={<div style={{ height: "280px" }} class="animate-pulse bg-[var(--color-paper-2)]" />}>
              <StationMap meta={era5Meta()} loc={mapLoc()} onSelect={setMapLoc} />
            </Suspense>
            <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--color-rule)", display: "flex", gap: "10px", flexWrap: "wrap", background: "var(--color-card)" }}>
              {([
                ["#7bafd4", "Alpska (>1500m)"],
                ["#a3c4a0", "Gorska (800–1500m)"],
                ["#c8b97a", "Predgorska (400–800m)"],
                ["#c25a2c", "Nižinska (<400m)"],
              ] as [string, string][]).map(([color, label]) => (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-soft)" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, display: "inline-block", border: "1px solid rgba(0,0,0,0.15)", flexShrink: "0" }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <RegScatterCard />

        </div>

        <div class="cal-section">
          <RegYearRoundCard />
        </div>

        <Era5Charts />

      </RegressionPanel>

    </div>
  );
}

function TropControls(props: {
  threshold: number; setThreshold: (n: number) => void; min: number; max: number;
  streak: number; setStreak: (n: number) => void; unit: string;
}) {
  const ctlLabel = { "font-family": "var(--font-mono)", "font-size": "10px", "letter-spacing": "0.06em", "text-transform": "uppercase", color: "var(--color-ink-soft)" } as const;
  return (
    <div style={{ display: "flex", gap: "24px", "align-items": "center", "flex-wrap": "wrap", margin: "0 40px 12px" }}>
      <label style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span style={ctlLabel}>Prag:</span>
        <input type="range" min={props.min} max={props.max} step={1} value={props.threshold}
               onInput={(e) => props.setThreshold(Number(e.currentTarget.value))} />
        <span style={{ ...ctlLabel, color: "var(--color-ink)" }}>{props.threshold} °C</span>
      </label>
      <label style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span style={ctlLabel}>Min. zap. {props.unit}:</span>
        <select value={props.streak} onInput={(e) => props.setStreak(Number(e.currentTarget.value))}
                style={{ "font-family": "var(--font-mono)", "font-size": "11px", padding: "2px 6px" }}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>
    </div>
  );
}

function Era5Charts() {
  const s = useReg();
  const loc = () => s.selLocs()[0] ?? null;
  const st  = () => s.meta.stations.find(station => station.name === loc()) ?? null;

  const [daysThr,   setDaysThr]   = createSignal(30);
  const [nightsThr, setNightsThr] = createSignal(20);
  const [streak,    setStreak]    = createSignal(1);

  // SPEI is national (heatmap) / has its own station picker (trend) — load once
  const [speiData]        = createResource(fetchSpeiHeatmap);
  const [speiStationData] = createResource(fetchSpeiStationSeasonal);

  return (
    <Show when={loc()}>
      {/* Location impact details */}
      <section class="sec-p" style={{ "padding-top": "16px", "padding-bottom": "24px" }}>
        <div class="sec-hs" style={{ "padding-inline": "0", "padding-top": "0", "padding-bottom": "10px" }}>
          Podrobnosti lokacije
        </div>
        <Suspense fallback={<div style={{ height: "180px" }} class="animate-pulse rounded-xl bg-[var(--color-paper-2)]" />}>
          <HeroCardsPanel loc={loc()} doy={s.doy()} />
        </Suspense>
      </section>

      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "24px" }}>
          Sezonski pregled
        </div>
        <div class="sec-hs2">
          Povprečna najvišja temperatura po sezonah · ERA5-Land · barve glede na referenčno obdobje
        </div>
        <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5SeasonHeatmapChart loc={loc()} label={st()?.label} />
        </Suspense>
      </section>

      {/* SPEI drought heatmap (national) */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          Sezonski sušni indeks (SPEI)
        </div>
        <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Show when={speiData()?.available}>
            <SpeiHeatmapChart data={speiData()!} />
          </Show>
        </Suspense>
      </section>

      {/* SPEI drought trend per station */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          Sušni trend po postaji — SPEI
        </div>
        <div class="sec-hs2">
          Sezonski (SPEI-3) in mesečni (SPEI-30) indeks vodne bilance · Theil-Sen · ERA5-Land
        </div>
        <Suspense fallback={<div class="animate-pulse rounded-xl bg-[var(--color-paper-2)]" style={{ height: "400px" }} />}>
          <Show when={speiStationData()?.available}>
            <SpeiTrendChartLazy data={speiStationData()!} />
          </Show>
        </Suspense>
      </section>

      {/* Tropical days */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>Tropski dnevi</div>
        <div class="sec-hs2">
          Število dni z najvišjo temperaturo nad pragom · ERA5-Land · lapsna korekcija nadmorske višine
        </div>
        <TropControls threshold={daysThr()} setThreshold={setDaysThr} min={25} max={35} streak={streak()} setStreak={setStreak} unit="dni" />
        <Suspense fallback={<div class="h-56 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5TropicalChart loc={loc()} label={st()?.label} kind="days" threshold={daysThr()} streak={streak()} />
        </Suspense>
      </section>

      {/* Tropical nights */}
      <section class="sec-p" style={{ "padding-bottom": "60px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>Tropske noči</div>
        <div class="sec-hs2">
          Število noči z najnižjo temperaturo nad pragom · ERA5-Land · lapsna korekcija nadmorske višine
        </div>
        <TropControls threshold={nightsThr()} setThreshold={setNightsThr} min={15} max={25} streak={streak()} setStreak={setStreak} unit="noči" />
        <Suspense fallback={<div class="h-56 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5TropicalChart loc={loc()} label={st()?.label} kind="nights" threshold={nightsThr()} streak={streak()} />
        </Suspense>
      </section>

      {/* Sea level rise — Koper (IPCC AR6 projections, static) */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          Dvig morske gladine — Koper
        </div>
        <div class="sec-hs2" style={{ "margin-bottom": "16px" }}>
          Projekcije dviga morske gladine po scenarijih IPCC AR6 z viharnimi nalivi · severni Jadran
        </div>
        <Suspense fallback={<div class="animate-pulse rounded-xl bg-[#071e26]" style={{ height: "500px" }} />}>
          <SeaLevelChart />
        </Suspense>
      </section>
    </Show>
  );
}
