import { createSignal, createResource, createMemo, Show, Suspense, lazy } from "solid-js";

const EN_MONTHS: Record<string, string> = {
  Jan:"01", Feb:"02", Mar:"03", Apr:"04", May:"05", Jun:"06",
  Jul:"07", Aug:"08", Sep:"09", Oct:"10", Nov:"11", Dec:"12",
};
function fmtDayLabel(dl: string): string {
  const [mon, day] = dl.split(" ");
  return `${(day ?? "").padStart(2, "0")}.${EN_MONTHS[mon ?? ""] ?? "??"}`;
}
import { fetchMeta, fetchPageData, fetchSeasonHeatmap, fetchSpeiHeatmap, fetchSpeiStationSeasonal } from "./api.ts";
import { TodayCard } from "./components/TodayCard.tsx";
import { DistributionChart } from "./charts/DistributionChart.tsx";
import { TodayTrendChart }   from "./components/TodayTrendChart.tsx";
import { RegressionPanel, RegToolbar, RegScatterCard, RegYearRoundCard,
         panelHStyle, panelTitleStyle, panelSubStyle } from "./components/RegressionPanel.tsx";
import type { SiteMeta } from "./types.ts";

// Only below-the-fold sections stay lazy
const SeasonHeatmapChart = lazy(() => import("./charts/SeasonHeatmap.tsx").then(m => ({ default: m.SeasonHeatmap })));
const StationMap          = lazy(() => import("./components/StationMap.tsx").then(m => ({ default: m.StationMap })));
const SpeiHeatmapChart    = lazy(() => import("./charts/SpeiHeatmap.tsx").then(m => ({ default: m.SpeiHeatmap })));
const TropicalDaysChart   = lazy(() => import("./charts/TropicalChart.tsx").then(m => ({ default: m.TropicalChart })));
const TropicalNightsChart = lazy(() => import("./charts/TropicalChart.tsx").then(m => ({ default: m.TropicalChart })));
const HeroCardsPanel      = lazy(() => import("./components/HeroCards.tsx").then(m => ({ default: m.HeroCards })));
const SeaLevelChart       = lazy(() => import("./charts/SeaLevelWidget.tsx").then(m => ({ default: m.SeaLevelWidget })));
const SpeiTrendChartLazy  = lazy(() => import("./charts/SpeiTrendChart.tsx").then(m => ({ default: m.SpeiTrendChart })));

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
  const [loc,  setLoc]  = createSignal<string | null>(null);

  const defaultDoy = createMemo(() => dateToDoy(date()));

  const [pageData] = createResource(
    () => ({ date: date(), loc: loc() }),
    ({ date, loc }) => fetchPageData(date, loc),
  );
  const pageDataResolved = () => pageData() ?? pageData.latest;
  const todayData = () => pageDataResolved()?.status;
  const last7Data = () => pageDataResolved()?.last7;

  const [heatmapData]       = createResource(fetchSeasonHeatmap);
  const [speiData]          = createResource(fetchSpeiHeatmap);
  const [speiStationData]   = createResource(fetchSpeiStationSeasonal);
  const [mapLoc, setMapLoc] = createSignal<string | null>(null);

  return (
    <div>

      {/* ── Today status section ──────────────────────────────────── */}
      <section class="today-status">
        <div class="sec-heading">
          <div class="today-heading-text">
            <span class="today-heading-title">Ali je vroče v Sloveniji?</span>
            <span class="today-heading-subtitle">v primerjavi s tem datumom zgodovinsko</span>
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
                meta={props.meta}
                date={date()}
                today={today}
                loading={pageData.loading}
                onDateChange={setDate}
                onLocChange={(v) => setLoc(v || null)}
              />
            )}
          </Show>

          <Show when={todayData()?.available}>
            <div class="today-chart">
              <div class="today-chart-title">
                Dnevne najvišje temperature {todayData()?.loc ? `na postaji ${todayData()!.loc!.replace(/_/g, " ")}` : "v Sloveniji"} za dve tedni okoli {fmtDayLabel(todayData()!.day_label ?? "")} od {todayData()!.year_min}
              </div>
              <DistributionChart data={todayData()!} chartId="dist-chart" />
              <p class="today-explain" style={{ "font-size": "12px", "padding-top": "6px" }}>
                Krivulja prikazuje, kako pogosto se je pojavila vsaka vrhunska temperatura na dneve, kot je danes, v vseh letih. Barve označujejo klimatološke cone — od hladne modre prek tipičnega bežastega pasu do ekstremne rdeče — tako da na prvi pogled vidite, kje se uvršča današnja temperatura.
              </p>
              <div class="today-foot">
                Danes: {todayData()!.today_temp!.toFixed(1)} °C · {todayData()!.percentile!.toFixed(0)}. percentil · mediana {todayData()!.cutoffs!.p50.toFixed(1)} °C · {(todayData()!.n_samples ?? 0).toLocaleString()} opazovanj · {todayData()!.year_min}–{todayData()!.year_max}
              </div>
            </div>
          </Show>

          <Show when={todayData()?.available}>
            <TodayTrendChart date={date()} loc={loc()} />
          </Show>
        </div>
      </section>

      {/* ── Regression section ────────────────────────────────────────
           Layout (mirrors original):
           1. sec-hs heading
           2. toolbar  — full width, margin 40px
           3. main-row — grid: min(460px,44%) | 1fr, padding 20px 40px
              left:  map panel
              right: scatter chart panel
           4. cal-section — full width, year-round chart, margin 40px
      ──────────────────────────────────────────────────────────────── */}
      <RegressionPanel
        meta={props.meta}
        defaultDoy={defaultDoy()}
        syncLoc={mapLoc}
        onLocChange={setMapLoc}
      >
        <div class="sec-hs">Analiza trendov</div>

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
                  {props.meta.stations.length} postaj
                </div>
              </div>
            </div>
            <Suspense fallback={<div style={{ height: "280px" }} class="animate-pulse bg-[var(--color-paper-2)]" />}>
              <StationMap meta={props.meta} loc={mapLoc()} onSelect={setMapLoc} />
            </Suspense>
            {/* Elevation legend */}
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

          {/* Regression scatter panel */}
          <RegScatterCard />

        </div>

        {/* Year-round trend — full width below the grid */}
        <div class="cal-section">
          <RegYearRoundCard />
        </div>

      </RegressionPanel>

      {/* ── Hero card (location details) ──────────────────────────── */}
      <section class="sec-p" style={{ "padding-top": "16px", "padding-bottom": "24px" }}>
        <div class="sec-hs" style={{ "padding-inline": "0", "padding-top": "0", "padding-bottom": "10px" }}>
          Podrobnosti lokacije
        </div>
        <Suspense fallback={<div style={{ height: "180px" }} class="animate-pulse rounded-xl bg-[var(--color-paper-2)]" />}>
          <HeroCardsPanel loc={mapLoc()} doy={defaultDoy()} />
        </Suspense>
      </section>

      {/* ── Season heatmap ────────────────────────────────────────── */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "24px" }}>
          Sezonski pregled
        </div>
        <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Show when={(heatmapData()?.length ?? 0) > 0}>
            <SeasonHeatmapChart data={heatmapData()!} />
          </Show>
        </Suspense>
      </section>

      {/* ── SPEI heatmap ──────────────────────────────────────────── */}
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

      {/* ── Drought trend per station ─────────────────────────────── */}
      <Show when={props.meta.features["drought_trend_chart"]}>
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
      </Show>

      {/* ── Tropical days ─────────────────────────────────────────── */}
      <Show when={props.meta.features["tropical_days_chart"]}>
        <section style={{ "padding-bottom": "40px" }}>
          <div class="sec-h" style={{ "padding-top": "8px" }}>
            Tropski dnevi
          </div>
          <div class="sec-hs2">
            Število dni z najvišjo temperaturo nad pragom po postaji · ERA5-Land · lapsna korekcija nadmorske višine
          </div>
          <Suspense fallback={<div class="sec-p animate-pulse rounded-xl bg-[var(--color-paper-2)]" style={{ height: "360px" }} />}>
            <TropicalDaysChart kind="days" />
          </Suspense>
        </section>
      </Show>

      {/* ── Tropical nights ───────────────────────────────────────── */}
      <Show when={props.meta.features["tropical_nights_chart"]}>
        <section style={{ "padding-bottom": "40px" }}>
          <div class="sec-h" style={{ "padding-top": "8px" }}>
            Tropske noči
          </div>
          <div class="sec-hs2">
            Število noči z najnižjo temperaturo nad pragom po postaji · ERA5-Land · lapsna korekcija nadmorske višine
          </div>
          <Suspense fallback={<div class="sec-p animate-pulse rounded-xl bg-[var(--color-paper-2)]" style={{ height: "360px" }} />}>
            <TropicalNightsChart kind="nights" />
          </Suspense>
        </section>
      </Show>

      {/* ── Sea level rise (Koper) ─────────────────────────────────── */}
      <Show when={props.meta.features["sea_level_section"]}>
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

    </div>
  );
}
