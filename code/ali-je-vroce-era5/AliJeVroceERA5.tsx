import { createSignal, createResource, Show, Suspense, lazy } from "solid-js";
import { fetchMeta } from "./api.ts";
import { RegressionPanel, RegToolbar, RegScatterCard, RegYearRoundCard, useReg,
         panelHStyle, panelTitleStyle, panelSubStyle } from "./components/RegressionPanel.tsx";
import type { SiteMeta } from "./types.ts";

const Era5SeasonHeatmapChart = lazy(() => import("./charts/Era5SeasonHeatmap.tsx").then(m => ({ default: m.Era5SeasonHeatmap })));
const StationMap             = lazy(() => import("./components/StationMap.tsx").then(m => ({ default: m.StationMap })));

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
  const defaultDoy = dateToDoy(today);

  const era5Stations = props.meta.stations.filter(s => s.source === "era5");

  const era5Meta = (): SiteMeta => ({
    ...props.meta,
    stations: era5Stations,
    default_location: props.meta.default_location ?? "Ljubljana",
  });

  const [mapLoc, setMapLoc] = createSignal<string | null>(null);

  const mapLabel = () => {
    const loc = mapLoc();
    if (!loc) return "Slovenija — vse postaje";
    const st = era5Stations.find(s => s.name === loc);
    return st?.label ?? loc.replace(/_/g, " ");
  };

  return (
    <div>
      <RegressionPanel
        meta={era5Meta()}
        defaultDoy={defaultDoy}
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
                <div style={panelTitleStyle}>{mapLabel()}</div>
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

function Era5Charts() {
  const s = useReg();

  const loc = () => s.selLocs()[0] ?? null;
  const st  = () => s.meta.stations.find(station => station.name === loc()) ?? null;

  return (
    <Show when={loc()} fallback={
      <section class="sec-p" style={{ "padding-bottom": "60px" }}>
        <p style={{ "padding-top": "32px", color: "var(--color-ink-soft)", "font-size": "14px", "text-align": "center" }}>
          Za izbrano postajo ni podatkov.
        </p>
      </section>
    }>

      <section class="sec-p" style={{ "padding-bottom": "60px" }}>
        <div class="sec-h" style={{ "padding-inline": "0", "padding-top": "40px" }}>
          Sezonski pregled
        </div>
        <div class="sec-hs2">
          Povprečna najvišja temperatura po sezonah · ERA5-Land · barve glede na referenčno obdobje
        </div>
        <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
          <Era5SeasonHeatmapChart loc={loc()} label={st()?.label} />
        </Suspense>
      </section>

    </Show>
  );
}
