import { createSignal, createResource, Show, Suspense, lazy } from "solid-js";
import { fetchMeta, isArsoLoc } from "./api.ts";
import { RegressionPanel, RegToolbar, RegScatterCard, RegYearRoundCard, useReg,
         panelHStyle, panelTitleStyle, panelSubStyle } from "./components/RegressionPanel.tsx";
import type { SiteMeta } from "./types.ts";

const ArsoSeasonHeatmapChart  = lazy(() => import("./charts/ArsoSeasonHeatmap.tsx").then(m => ({ default: m.ArsoSeasonHeatmap })));
const ArsoTropicalDaysChart   = lazy(() => import("./charts/ArsoTropicalChart.tsx").then(m => ({ default: m.ArsoTropicalChart })));
const ArsoTropicalNightsChart = lazy(() => import("./charts/ArsoTropicalChart.tsx").then(m => ({ default: m.ArsoTropicalChart })));
const StationMap               = lazy(() => import("./components/StationMap.tsx").then(m => ({ default: m.StationMap })));

function dateToDoy(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

const normalize = (s: string) => s.replace(/_/g, " ").toLowerCase().trim();

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
  const defaultDoy = dateToDoy(today);

  const arsoStations = props.meta.stations.filter(s => s.source === "arso");

  // Build an ARSO-only SiteMeta for the RegressionPanel and map
  const arsoDefaultLoc = () => {
    const era5Default = props.meta.default_location ?? "Ljubljana";
    const match = arsoStations.find(
      s => normalize(s.label ?? s.name) === normalize(era5Default)
    );
    return match?.name ?? arsoStations[0]?.name ?? era5Default;
  };
  const arsoMeta = (): SiteMeta => ({
    ...props.meta,
    stations: arsoStations,
    default_location: arsoDefaultLoc(),
  });

  const [mapLoc, setMapLoc] = createSignal<string | null>(null);

  const mapLabel = () => {
    const loc = mapLoc();
    if (!loc) return "Slovenija — vse postaje";
    const st = arsoStations.find(s => s.name === loc);
    return st?.label ?? loc.replace(/_/g, " ");
  };

  return (
    <div>
      <RegressionPanel
        meta={arsoMeta()}
        defaultDoy={defaultDoy}
        syncLoc={mapLoc}
        onLocChange={setMapLoc}
      >
        <div class="sec-hs">Analiza trendov · ARSO meritve</div>

        <RegToolbar />

        <div class="main-row">

          {/* Map panel */}
          <div class="reg-card" style={{ background: "var(--color-paper)" }}>
            <div style={{ ...panelHStyle, background: "var(--color-card)" }}>
              <div>
                <div style={panelTitleStyle}>{mapLabel()}</div>
                <div style={{ ...panelSubStyle, "margin-top": "3px" }}>
                  {arsoStations.length} postaj · ARSO
                </div>
              </div>
            </div>
            <Suspense fallback={<div style={{ height: "280px" }} class="animate-pulse bg-[var(--color-paper-2)]" />}>
              <StationMap meta={arsoMeta()} loc={mapLoc()} onSelect={setMapLoc} />
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

        <ArsoCharts />

      </RegressionPanel>
    </div>
  );
}

function ArsoCharts() {
  const s = useReg();

  // selLocs()[0] is now directly the ARSO station name (e.g. "arso:1495")
  const arsoLoc = () => {
    const loc = s.selLocs()[0] ?? "";
    return isArsoLoc(loc) ? loc : null;
  };
  const arsoSt = () => s.meta.stations.find(st => st.name === arsoLoc()) ?? null;

  return (
    <Show when={arsoLoc()} fallback={
      <section class="sec-p" style={{ "padding-bottom": "60px" }}>
        <p style={{ "padding-top": "32px", color: "var(--color-ink-soft)", "font-size": "14px", "text-align": "center" }}>
          Za izbrano postajo ni ARSO meritev.
        </p>
      </section>
    }>

      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "40px" }}>
          Sezonski pregled
        </div>
        <div class="sec-hs2">
          Povprečna najvišja temperatura po sezonah · ARSO meritve · barve glede na referenčno obdobje
        </div>
        <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <ArsoSeasonHeatmapChart loc={arsoLoc()} label={arsoSt()?.label} />
        </Suspense>
      </section>

      <section class="sec-p" style={{ "padding-bottom": "40px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          Tropski dnevi
        </div>
        <div class="sec-hs2">
          Število dni z najvišjo temperaturo nad 30 °C · ARSO meritve · NB GLM
        </div>
        <Suspense fallback={<div class="h-56 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <ArsoTropicalDaysChart
            loc={arsoLoc()} kind="days" threshold={30}
            label={arsoSt()?.label}
          />
        </Suspense>
      </section>

      <section class="sec-p" style={{ "padding-bottom": "60px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "8px" }}>
          Tropske noči
        </div>
        <div class="sec-hs2">
          Število noči z najnižjo temperaturo nad 20 °C · ARSO meritve · NB GLM
        </div>
        <Suspense fallback={<div class="h-56 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <ArsoTropicalNightsChart
            loc={arsoLoc()} kind="nights" threshold={20}
            label={arsoSt()?.label}
          />
        </Suspense>
      </section>

    </Show>
  );
}
