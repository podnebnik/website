import { createSignal, createResource, Show, Suspense, For, createMemo, lazy } from "solid-js";
import type { SiteMeta, RegressionResponse } from "../types.ts";
import { fetchRegression } from "../api.ts";

const RegressionChart = lazy(() => import("../charts/RegressionChart.tsx").then(m => ({ default: m.RegressionChart })));

const VARIABLES: Record<string, string> = {
  temperature_max:        "Temperature Max (°C)",
  temperature_min:        "Temperature Min (°C)",
  temperature_mean:       "Temperature Mean (°C)",
  precipitation_sum:      "Precipitation (mm)",
  et0_evapotranspiration: "ET₀ Evapotranspiration (mm)",
};

interface Props { meta: SiteMeta; defaultDoy: number }

function doyToDateLabel(doy: number): string {
  const ref = new Date(Date.UTC(2001, 0, 1));
  ref.setUTCDate(ref.getUTCDate() + doy - 1);
  return ref.toLocaleDateString("sl-SI", { month: "short", day: "numeric" });
}

export function RegressionSection(props: Props) {
  const defaultLoc = () => props.meta.default_location ?? "Ljubljana";

  const [selectedLocs, setSelectedLocs] = createSignal<string[]>([defaultLoc()]);
  const [selVar,    setSelVar]    = createSignal("temperature_max");
  const [doy,       setDoy]       = createSignal(props.defaultDoy);
  const [window_,   setWindow]    = createSignal(30);
  const [corr,      setCorr]      = createSignal<"raw"|"corr">("raw");
  const [method,    setMethod]    = createSignal<"theilsen"|"ols">("theilsen");

  const params = createMemo(() => ({
    locs:   selectedLocs(),
    var:    selVar(),
    doy:    doy(),
    window: window_(),
    corr:   corr(),
    method: method(),
  }));

  const [regData] = createResource(params, fetchRegression);

  const isPrecip = () => selVar() === "precipitation_sum" || selVar() === "et0_evapotranspiration";

  function toggleLoc(name: string) {
    setSelectedLocs(prev => {
      if (prev.includes(name)) {
        return prev.length > 1 ? prev.filter(l => l !== name) : prev;
      }
      return [...prev, name].slice(0, 6);
    });
  }

  const stats0 = () => (regData()?.results ?? [])[0]?.stats;
  const trend10 = () => stats0()?.trend10 ?? 0;
  const trendColor = () => {
    const t = trend10();
    if (isPrecip()) return t >= 0 ? "#1a5fc8" : "#a05c20";
    return t >= 0 ? "#cc2222" : "#1a5fc8";
  };

  return (
    <div class="bg-[var(--color-card)] border border-[var(--color-rule)] rounded-2xl p-6 space-y-4">
      {/* ── Title row ── */}
      <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 justify-between">
        <h2 class="font-bold text-lg">
          Letni trend · {doyToDateLabel(doy())}
        </h2>
        <Show when={stats0()}>
          {(st) => (
            <div class="text-xs text-[var(--color-ink-soft)] font-mono">
              {st().n_years} let · {st().sig_label}
            </div>
          )}
        </Show>
      </div>

      {/* ── Variable selector ── */}
      <div class="flex flex-wrap gap-1.5">
        <For each={Object.entries(VARIABLES)}>
          {([key, label]) => (
            <button
              class="text-[11px] px-2.5 py-1 rounded-full border transition-colors"
              classList={{
                "bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]": selVar() === key,
                "border-[var(--color-rule)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)]": selVar() !== key,
              }}
              onClick={() => setSelVar(key)}
            >
              {label.split("(")[0].trim()}
            </button>
          )}
        </For>
      </div>

      {/* ── Controls row ── */}
      <div class="flex flex-wrap gap-3 items-center text-xs text-[var(--color-ink-soft)]">
        <label class="flex items-center gap-2">
          <span>Dan leta: <b class="text-[var(--color-ink)] font-mono">{doyToDateLabel(doy())}</b></span>
          <input
            type="range" min="1" max="365" value={doy()}
            class="w-32 accent-[var(--color-accent)]"
            onInput={(e) => setDoy(Number(e.currentTarget.value))}
          />
        </label>
        <label class="flex items-center gap-2">
          <span>Okno: <b class="text-[var(--color-ink)] font-mono">±{window_()}d</b></span>
          <input
            type="range" min="7" max="60" step="1" value={window_()}
            class="w-20 accent-[var(--color-accent)]"
            onInput={(e) => setWindow(Number(e.currentTarget.value))}
          />
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox" checked={corr() === "corr"}
            class="accent-[var(--color-accent)]"
            onChange={(e) => setCorr(e.currentTarget.checked ? "corr" : "raw")}
          />
          <span>Nadmorska korekcija</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox" checked={method() === "ols"}
            class="accent-[var(--color-accent)]"
            onChange={(e) => setMethod(e.currentTarget.checked ? "ols" : "theilsen")}
          />
          <span>OLS</span>
        </label>
      </div>

      {/* ── Location multi-select ── */}
      <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        <For each={props.meta.stations}>
          {(s) => {
            const isSelected = () => selectedLocs().includes(s.name);
            return (
              <button
                class="text-[11px] px-2 py-0.5 rounded border transition-colors"
                classList={{
                  "bg-[var(--color-accent)] text-white border-[var(--color-accent)]": isSelected(),
                  "border-[var(--color-rule)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)]": !isSelected(),
                }}
                onClick={() => toggleLoc(s.name)}
              >
                {s.label ?? s.name}
              </button>
            );
          }}
        </For>
      </div>

      {/* ── Stats banner ── */}
      <Show when={stats0()}>
        {(st) => (
          <div class="flex gap-6 items-baseline">
            <div>
              <span
                class="text-3xl font-bold font-mono"
                style={{ color: trendColor() }}
              >
                {trend10() >= 0 ? "+" : ""}{trend10().toFixed(3)}
              </span>
              <span class="text-sm text-[var(--color-ink-soft)] ml-1">
                {isPrecip() ? "mm" : "°C"}/desetletje
              </span>
            </div>
            <div class="text-xs text-[var(--color-ink-soft)] font-mono leading-snug">
              {st().sig_label}<br/>
              {st().method} · {st().fit_desc?.split("·")[0]?.trim()}
            </div>
          </div>
        )}
      </Show>

      {/* ── Chart ── */}
      <Suspense fallback={<div class="h-64 animate-pulse bg-[var(--color-paper-2)] rounded-lg" />}>
        <Show when={regData()} keyed>
          {(d) => (
            <Show when={d.results.length > 0} fallback={
              <div class="h-64 flex items-center justify-center text-[var(--color-ink-soft)] text-sm">
                Ni podatkov za izbrani dan in postajo.
              </div>
            }>
              <RegressionChart data={d} chartId={`reg-${selVar()}-${doy()}`} />
            </Show>
          )}
        </Show>
      </Suspense>

      <p class="text-xs text-[var(--color-ink-soft)]">
        Letni povpreki v ±{window_()}-dnevnem oknu ·
        {method() === "ols" ? " OLS" : " Theil-Sen + Yue-Wang TFPW MK"} · projekcija do 2050
      </p>
    </div>
  );
}
