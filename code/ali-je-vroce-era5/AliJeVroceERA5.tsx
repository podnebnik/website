import { createSignal, createResource, createMemo, Show, Suspense, ErrorBoundary, lazy } from "solid-js";
import { fetchMeta, fetchPageData, fetchSpeiHeatmap, fetchSpeiStationSeasonal, dateToDoy, ERA5_NATIONAL, BASELINE_LABEL } from "./api.ts";
import { today as todayIso } from "./clock.ts";
import { sectionErrorFallback } from "./components/SectionError.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { TodayCard } from "./components/TodayCard.tsx";
import { DistributionChart } from "./charts/DistributionChart.tsx";
import { TodayTrendChart } from "./components/TodayTrendChart.tsx";
// T-5.46: station map hidden for v1 (D-31). Code retained deliberately — revive by
// uncommenting; StationMap.tsx is untouched.
// (panelHStyle/panelTitleStyle/panelSubStyle are read only by the hidden map card's
// panel header; the reduced import below drops them to hold typecheck at zero. Revive
// by deleting the reduced line and uncommenting the original.)
// import { RegressionPanel, RegToolbar, RegScatterCard, RegYearRoundCard, FloatingStationChooser, useReg,
//          panelHStyle, panelTitleStyle, panelSubStyle } from "./components/RegressionPanel.tsx";
import { RegressionPanel, RegToolbar, RegScatterCard, RegYearRoundCard, FloatingStationChooser, useReg } from "./components/RegressionPanel.tsx";
import { MethodologyPanel } from "./components/MethodologyPanel.tsx";
import type { SiteMeta } from "./types.ts";
import { t, fmtNum, fmtInt, fmtMonthDay } from "./i18n/format.ts";

const Era5SeasonHeatmapChart = lazy(() => import("./charts/Era5SeasonHeatmap.tsx").then(m => ({ default: m.Era5SeasonHeatmap })));
// T-5.46: station map hidden for v1 (D-31). Code retained deliberately — revive by
// uncommenting; StationMap.tsx is untouched.
// const StationMap             = lazy(() => import("./components/StationMap.tsx").then(m => ({ default: m.StationMap })));
const HeroCardsPanel         = lazy(() => import("./components/HeroCards.tsx").then(m => ({ default: m.HeroCards })));
const Era5TropicalChart      = lazy(() => import("./charts/Era5TropicalChart.tsx").then(m => ({ default: m.Era5TropicalChart })));
const SpeiHeatmapChart       = lazy(() => import("./charts/SpeiHeatmap.tsx").then(m => ({ default: m.SpeiHeatmap })));
const SpeiTrendChartLazy     = lazy(() => import("./charts/SpeiTrendChart.tsx").then(m => ({ default: m.SpeiTrendChart })));
// T-4.21 / D-10 — the sea-level widget is GATED OUT of v1 (unsound per-cm factors,
// D-10b; SRTM DEM can't support the increments, D-10c). Import + mount removed so it
// renders nothing and makes no /data/flood asset requests. Deferred, not deleted:
// charts/SeaLevelWidget.tsx and scripts/floodmap/ are kept for re-entry. To unpark
// when D-10b/c clear, restore the lazy import here and the section below (see PROGRESS).

// T-5.5 — the datasette `day_label` is an internal "Mon D" key; render its month
// as a Slovenian short date via the formatter rather than a hand-built string.
const EN_MONTHS: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
};
function fmtDayLabel(dl: string): string {
  const [mon, day] = dl.split(" ");
  const m = EN_MONTHS[mon ?? ""] ?? 0;
  return m ? fmtMonthDay(m, Number(day)) : "??";
}

export function AliJeVroceERA5() {
  const [meta, { refetch: refetchMeta }] = createResource<SiteMeta>(fetchMeta);
  // A failed site-meta fetch used to leave the page spinning "Nalaganje…" forever:
  // Show read meta(), which throws when the resource errored, and with no boundary
  // the throw unmounted the whole island (blank). The boundary turns that into a
  // visible page-level error (T-5.1).
  return (
    <ErrorBoundary fallback={sectionErrorFallback(refetchMeta, "480px")}>
      <Show when={meta()} fallback={<div class="px-10 py-8 text-[var(--color-ink-soft)]">{t("loading")}</div>}>
        {(m) => <Dashboard meta={m()} />}
      </Show>
    </ErrorBoundary>
  );
}

function Dashboard(props: { meta: SiteMeta }) {
  const today = todayIso();
  const [date, setDate] = createSignal(today);

  const era5Stations = props.meta.stations.filter(s => s.source === "era5");
  const defaultLoc = props.meta.default_location ?? "Ljubljana";
  // Page opens on the Slovenia national ERA5 average
  const [loc, setLoc] = createSignal<string | null>(ERA5_NATIONAL);
  const isNat = createMemo(() => loc() === ERA5_NATIONAL);

  const defaultDoy = createMemo(() => dateToDoy(date()));
  const era5Meta = (): SiteMeta => ({ ...props.meta, stations: era5Stations, default_location: defaultLoc });

  // T-5.46: station map hidden for v1 (D-31). Code retained deliberately — revive by
  // uncommenting; StationMap.tsx is untouched.
  // T-5.40 (B1) — the map card header must show the DIACRITIC display name, not the
  // ASCII era5_name. The map's own point labels already resolve via station.label
  // (StationMap.tsx); this makes the header read the same authored field (T-5.27).
  // const stationLabelOf = (name: string | null): string | null =>
  //   name == null ? null : (era5Stations.find(s => s.name === name)?.label ?? name);

  const [pageData, { refetch: refetchPageData }] = createResource(
    () => ({ date: date(), loc: loc() }),
    ({ date, loc }) => fetchPageData(date, loc),
  );
  const pageDataResolved = () => pageData() ?? pageData.latest;
  const todayData = () => pageDataResolved()?.status;
  const last7Data = () => pageDataResolved()?.last7;

  // T-5.46: station map hidden for v1 (D-31). Code retained deliberately — revive by
  // uncommenting; StationMap.tsx is untouched.
  // T-5.39 — `mapLoc` now MIRRORS the below-hero selection; it no longer writes it.
  // It is set only by the store's `setLoc` (via onLocChange, i.e. the floating
  // chooser) and read by the map card's header + marker highlight, so the map
  // reflects the chosen station. It opens on the body's default station (Ljubljana),
  // matching what the analysis below is actually showing. The retired click-to-select
  // path (map → store via syncLoc) is gone.
  // const [mapLoc, setMapLoc] = createSignal<string | null>(defaultLoc);

  // T-5.35 — the floating chooser is present from page load (it is the only location
  // control now). It anchors on the hero (today-status) section to decide when to
  // offer the national "Slovenija" option: 19 entries while the hero is in view, 18
  // once it is not (D-27).
  let heroAnchor: HTMLElement | undefined;

  return (
    <div>

      {/* ── Today status section ──────────────────────────────────── */}
      <section class="today-status" ref={heroAnchor}>
        <div class="sec-heading">
          <div class="today-heading-text">
            <span class="today-heading-title">{t("sections.today_title")}</span>
            <span class="today-heading-subtitle">{t("sections.today_subtitle")}</span>
          </div>
        </div>

        <div class="today-grid">
          <ErrorBoundary fallback={sectionErrorFallback(refetchPageData, "480px")}>
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
                nationalLoc={ERA5_NATIONAL}
              />
            )}
          </Show>

          <Show when={todayData()?.available}>
            <div class="today-chart">
              <div class="today-chart-title">
                {isNat()
                  ? t("today.chart_title_nat", { day: fmtDayLabel(todayData()!.day_label ?? ""), year_min: todayData()!.year_min ?? 0 })
                  : t("today.chart_title_station", { station: todayData()!.loc!.replace(/_/g, " "), day: fmtDayLabel(todayData()!.day_label ?? ""), year_min: todayData()!.year_min ?? 0 })}
              </div>
              <DistributionChart data={todayData()!} chartId="dist-chart" />
              <p class="today-explain" style={{ "font-size": "12px", "padding-top": "6px" }}>
                {t("today.chart_explain")}
              </p>
              <div class="today-foot">
                {t("today.foot2", {
                  region: isNat() ? t("today.foot2_region_nat") : t("today.foot2_region_day"),
                  temp: fmtNum(todayData()!.today_temp!, 1),
                  pct: fmtInt(todayData()!.percentile!),
                  median: fmtNum(todayData()!.cutoffs!.p50, 1),
                  count: todayData()!.n_samples ?? 0,
                  year_min: todayData()!.year_min ?? 0,
                  year_max: todayData()!.year_max ?? 0,
                })}
              </div>
            </div>
          </Show>

          {/* National (pooled) or per-station annual trend with projection */}
          <Show when={todayData()?.available}>
            <TodayTrendChart date={date()} loc={loc()} stationCount={era5Stations.length} />
          </Show>
          </ErrorBoundary>
        </div>
      </section>

      {/* ── Regression section (ERA5) — own station picker, always shown ── */}
      <RegressionPanel
        meta={era5Meta()}
        defaultDoy={defaultDoy()}
        /* T-5.46: station map hidden for v1 (D-31). Code retained deliberately — revive
           by uncommenting; StationMap.tsx is untouched. onLocChange fed the hidden map's
           mapLoc mirror only; it is optional (RegressionPanel.tsx:26) and called as
           props.onLocChange?.(name) (:61), so its absence is a no-op for the store.
        onLocChange={setMapLoc}
        */
      >
        {/* T-5.35 / D-27 — the single location control, over the hero and every
            section below. Placed FIRST inside the panel (right after the hero's date
            controls in tab order) so a keyboard user reaches the only location
            control early, not at the end of the document. It is position:fixed, so
            DOM order sets tab order, not visual placement. It reads/writes the hero's
            `loc` and the regression store's station, asymmetrically (see the
            component). */}
        <FloatingStationChooser
          heroAnchor={() => heroAnchor}
          heroLoc={loc}
          onHeroLocChange={(v) => setLoc(v === "" ? ERA5_NATIONAL : (v || ERA5_NATIONAL))}
          nationalLoc={ERA5_NATIONAL}
          nationalCount={era5Stations.length}
        />

        <div class="sec-hs">{t("sections.trends_analysis")}</div>

        <RegToolbar />

        <div class="main-row">

          {/* Map panel */}
          {/* T-5.46: station map hidden for v1 (D-31). Code retained deliberately — revive by
              uncommenting; StationMap.tsx is untouched.
          <div class="reg-card" style={{ background: "var(--color-paper)" }}>
            <div style={{ ...panelHStyle, background: "var(--color-card)" }}>
              <div>
                <div style={panelTitleStyle}>
                  {stationLabelOf(mapLoc()) ?? t("map.panel_title_all", { count: era5Stations.length })}
                </div>
                <div style={{ ...panelSubStyle, "margin-top": "3px" }}>
                  {t("map.panel_sub_count", { count: era5Stations.length })}
                </div>
              </div>
            </div>
            <Suspense fallback={<div style={{ height: "280px" }} class="animate-pulse bg-[var(--color-paper-2)]" />}>
              <StationMap meta={era5Meta()} loc={mapLoc()} />
            </Suspense>
            <div style={{ padding: "8px 12px 10px", "border-top": "1px solid var(--color-rule)", display: "flex", gap: "10px", "flex-wrap": "wrap", background: "var(--color-card)" }}>
              {([
                ["#7bafd4", t("map.legend_alpine")],
                ["#a3c4a0", t("map.legend_mountain")],
                ["#c8b97a", t("map.legend_foothill")],
                ["#c25a2c", t("map.legend_lowland")],
              ] as [string, string][]).map(([color, label]) => (
                <span style={{ display: "flex", "align-items": "center", gap: "5px", "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.06em", "text-transform": "uppercase", color: "var(--color-ink-soft)" }}>
                  <span style={{ width: "10px", height: "10px", "border-radius": "50%", background: color, display: "inline-block", border: "1px solid rgba(0,0,0,0.15)", "flex-shrink": "0" }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          */}

          <RegScatterCard />

        </div>

        <div class="cal-section">
          <RegYearRoundCard />
        </div>

        <Era5Charts />

      </RegressionPanel>

      {/* ── Methodology + trust furniture (T-6.1 / T-6.2) — foot of content ── */}
      <MethodologyPanel stationCount={era5Stations.length} />

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
        <span style={ctlLabel}>{t("tropical.ctrl_threshold")}</span>
        <input type="range" min={props.min} max={props.max} step={1} value={props.threshold}
               onInput={(e) => props.setThreshold(Number(e.currentTarget.value))} />
        <span style={{ ...ctlLabel, color: "var(--color-ink)" }}>{t("common.temp_c", { temp: fmtInt(props.threshold) })}</span>
      </label>
      <label style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span style={ctlLabel}>{props.unit === "noči" ? t("tropical.ctrl_streak_nights") : t("tropical.ctrl_streak_days")}</span>
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
  const [speiData,        { refetch: refetchSpei }]        = createResource(fetchSpeiHeatmap);
  const [speiStationData, { refetch: refetchSpeiStation }] = createResource(fetchSpeiStationSeasonal);

  return (
    <Show when={loc()}>
      {/* Location impact details */}
      <section class="sec-p" style={{ "padding-top": "16px", "padding-bottom": "24px" }}>
        <div class="sec-hs" style={{ "padding-inline": "0", "padding-top": "0", "padding-bottom": "10px" }}>
          {t("sections.location_details")}
        </div>
        <Suspense fallback={<div style={{ height: "180px" }} class="animate-pulse rounded-xl bg-[var(--color-paper-2)]" />}>
          <HeroCardsPanel loc={loc()} label={st()?.label} doy={s.doy()} />
        </Suspense>
      </section>

      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "24px" }}>
          {t("sections.season_overview")}
        </div>
        <div class="sec-hs2">
          {t("sections.season_overview_sub", { baseline: BASELINE_LABEL })}
        </div>
        <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5SeasonHeatmapChart loc={loc()} label={st()?.label} />
        </Suspense>
      </section>

      {/* SPEI drought heatmap (national) */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          {t("sections.spei")}
        </div>
        <ErrorBoundary fallback={sectionErrorFallback(refetchSpei, "160px")}>
          <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
            <Show when={speiData()?.available} fallback={<EmptyState minHeight="160px" />}>
              {/* T-5.38 — this section reads the `spei` table and is GENUINELY national
                  (no per-station dimension exists in the data). With the chooser now
                  setting one station for every other section below the hero, a silent
                  national section reads as *that station's* drought index; name it, in
                  the graph zone, matching D-7's canonical name. The sibling "Sušni
                  trend po postaji — SPEI" (spei_station) IS per-station and says so. */}
              <SpeiHeatmapChart data={speiData()!} label={t("today.loc_national", { count: s.meta.stations.length })} />
            </Show>
          </Suspense>
        </ErrorBoundary>
      </section>

      {/* SPEI drought trend per station */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          {t("sections.spei_trend")}
        </div>
        <div class="sec-hs2">
          {t("sections.spei_trend_sub")}
        </div>
        <ErrorBoundary fallback={sectionErrorFallback(refetchSpeiStation, "400px")}>
          <Suspense fallback={<div class="animate-pulse rounded-xl bg-[var(--color-paper-2)]" style={{ height: "400px" }} />}>
            <Show when={speiStationData()?.available} fallback={<EmptyState minHeight="400px" />}>
              <SpeiTrendChartLazy data={speiStationData()!} loc={loc()} label={st()?.label} />
            </Show>
          </Suspense>
        </ErrorBoundary>
      </section>

      {/* Tropical days */}
      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>{t("sections.tropical_days")}</div>
        <div class="sec-hs2">
          {t("sections.tropical_days_sub")}
        </div>
        <TropControls threshold={daysThr()} setThreshold={setDaysThr} min={25} max={35} streak={streak()} setStreak={setStreak} unit="dni" />
        <Suspense fallback={<div class="h-56 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5TropicalChart loc={loc()} label={st()?.label} kind="days" threshold={daysThr()} streak={streak()} />
        </Suspense>
      </section>

      {/* Tropical nights */}
      <section class="sec-p" style={{ "padding-bottom": "60px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>{t("sections.tropical_nights")}</div>
        <div class="sec-hs2">
          {t("sections.tropical_nights_sub")}
        </div>
        <TropControls threshold={nightsThr()} setThreshold={setNightsThr} min={15} max={25} streak={streak()} setStreak={setStreak} unit="noči" />
        <Suspense fallback={<div class="h-56 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5TropicalChart loc={loc()} label={st()?.label} kind="nights" threshold={nightsThr()} streak={streak()} />
        </Suspense>
      </section>

      {/* T-4.21 / D-10 — Sea level rise — Koper section GATED OUT of v1. The whole
          <section> (header sections.sea_level / sub sections.sea_level_sub + the
          SeaLevelChart mount) was removed so the known-unsound widget is not public
          and fetches no /data/flood assets. i18n strings (i18n/sl.ts) and si.yaml
          sea_level_section are intentionally LEFT as-is for reversible re-entry. */}
    </Show>
  );
}
