import { createSignal, createResource, createEffect, createMemo, createContext, useContext,
         Show, Suspense, For, lazy } from "solid-js";
import type { JSXElement } from "solid-js";
import type { SiteMeta, RegressionResponse } from "../types.ts";
import { fetchRegression, fetchCalendar } from "../api.ts";

const RegressionChart = lazy(() => import("../charts/RegressionChart.tsx").then(m => ({ default: m.RegressionChart })));
const YearRoundChart  = lazy(() => import("../charts/YearRoundChart.tsx").then(m => ({ default: m.YearRoundChart })));

const VARIABLES: [string, string][] = [
  ["temperature_max",        "Max temperature (°C)"],
  ["temperature_min",        "Min temperature (°C)"],
  ["temperature_mean",       "Mean temperature (°C)"],
  ["precipitation_sum",      "Precipitation (mm)"],
  ["et0_evapotranspiration", "ET₀ (mm)"],
];

interface ProviderProps {
  meta:         SiteMeta;
  defaultDoy:   number;
  syncLoc?:     () => string | null;
  onLocChange?: (loc: string) => void;
  children?:    JSXElement;
}

function doyToLabel(doy: number): string {
  const d = new Date(Date.UTC(2001, 0, 1));
  d.setUTCDate(d.getUTCDate() + doy - 1);
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

// ── Store factory ─────────────────────────────────────────────────────────────

function createStore(props: ProviderProps) {
  const defaultLoc = () => props.meta.default_location ?? "Ljubljana";

  const [selLocs,  setSelLocs]  = createSignal<string[]>([defaultLoc()]);
  const [selVar,   setSelVar]   = createSignal("temperature_max");
  const [doy,      setDoy]      = createSignal(props.defaultDoy);
  const [window_,  setWindow]   = createSignal(30);
  const [corr,     setCorr]     = createSignal(false);
  const [useOls,   setUseOls]   = createSignal(false);
  const [locOpen,  setLocOpen]  = createSignal(false);

  createEffect(() => {
    const ext = props.syncLoc?.();
    if (ext) setSelLocs([ext]);
  });

  const params = createMemo(() => ({
    locs:   selLocs(),
    var:    selVar(),
    doy:    doy(),
    window: window_(),
    corr:   corr() ? "corr" : "raw" as const,
    method: useOls() ? "ols" : "theilsen" as const,
  }));
  const [regData] = createResource(params, fetchRegression);

  const calParams = createMemo(() => ({
    loc:     selLocs()[0] ?? defaultLoc(),
    var:     selVar(),
    window_: window_(),
    corr:    corr() ? "corr" : "raw" as const,
    method:  useOls() ? "ols" : "theilsen" as const,
  }));
  const [calData] = createResource(
    calParams,
    p => fetchCalendar(p.loc, p.var, p.window_, p.corr, p.method),
  );

  const isPrecip   = () => selVar() === "precipitation_sum" || selVar() === "et0_evapotranspiration";
  const stats0     = () => (regData()?.results ?? [])[0]?.stats;
  const trend10    = () => stats0()?.trend10 ?? 0;
  const trendColor = () => {
    const t = trend10();
    if (isPrecip()) return t >= 0 ? "#1a5fc8" : "#a05c20";
    return t >= 0 ? "#cc2222" : "#1a5fc8";
  };
  const totalChange = () => {
    const s = stats0();
    if (!s) return null;
    return (trend10() * s.n_years / 10).toFixed(2);
  };
  const locLabel   = () => {
    const locs = selLocs();
    return locs.length === 1 ? locs[0].replace(/_/g, " ") : `${locs.length} locations`;
  };
  const varLabel   = () => VARIABLES.find(([k]) => k === selVar())?.[1] ?? selVar();
  const chartTitle = () => `${varLabel().split("(")[0].trim()} · ${doyToLabel(doy())} ±${window_()}d`;
  const chartSub   = () => selLocs().map(l => l.replace(/_/g, " ")).join(", ");

  function toggleLoc(name: string) {
    setSelLocs(prev => {
      if (prev.includes(name)) return prev.length > 1 ? prev.filter(l => l !== name) : prev;
      return [...prev, name].slice(0, 6);
    });
  }

  return {
    meta: props.meta,
    selLocs, setSelLocs, selVar, setSelVar,
    doy, setDoy, window_, setWindow,
    corr, setCorr, useOls, setUseOls,
    locOpen, setLocOpen,
    regData, calData,
    isPrecip, stats0, trend10, trendColor, totalChange,
    locLabel, varLabel, chartTitle, chartSub,
    toggleLoc, doyToLabel, VARIABLES,
  };
}

type Store = ReturnType<typeof createStore>;
const RegressionCtx = createContext<Store>();
const useReg = () => useContext(RegressionCtx)!;

// ── Provider ──────────────────────────────────────────────────────────────────

export function RegressionPanel(props: ProviderProps) {
  const store = createStore(props);
  return (
    <RegressionCtx.Provider value={store}>
      {props.children}
    </RegressionCtx.Provider>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export function RegToolbar() {
  const s = useReg();
  return (
    <div class="reg-toolbar">

      {/* Location */}
      <div style={{ position: "relative" }}>
        <div style={pillGroupStyle}>
          <span style={pgkStyle}>Location</span>
          <button style={locBtnStyle} onClick={() => s.setLocOpen(v => !v)}>
            <span>{s.locLabel()}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <Show when={s.locOpen()}>
          <div style={locMenuStyle} onClick={(e) => e.stopPropagation()}>
            <div style={locMenuHeaderStyle}>
              <span style={{ "font-size": "11px", "font-weight": "600", "font-family": "var(--font-sans)" }}>Select locations (max 6)</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-soft)", "font-size": "14px" }} onClick={() => s.setLocOpen(false)}>✕</button>
            </div>
            <For each={s.meta.stations}>
              {(st) => {
                const active = () => s.selLocs().includes(st.name);
                return (
                  <label style={{ display: "flex", "align-items": "center", gap: "8px", padding: "5px 12px", cursor: "pointer", "font-size": "12px", "font-family": "var(--font-sans)", color: "var(--color-ink)", background: active() ? "var(--color-paper-2)" : "transparent" }}>
                    <input type="checkbox" checked={active()} onChange={() => s.toggleLoc(st.name)} />
                    {st.name.replace(/_/g, " ")}
                  </label>
                );
              }}
            </For>
          </div>
          <div style={{ position: "fixed", inset: "0", "z-index": "9" }} onClick={() => s.setLocOpen(false)} />
        </Show>
      </div>

      {/* Variable */}
      <div style={pillGroupStyle}>
        <span style={pgkStyle}>Variable</span>
        <div style={{ ...pillStyle, "padding-right": "4px" }}>
          <select
            value={s.selVar()}
            style={{ background: "transparent", border: "none", "font-size": "12px", color: "var(--color-ink)", "font-family": "var(--font-sans)", cursor: "pointer", "padding-right": "16px", appearance: "none", "background-image": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='%236B655B'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")", "background-repeat": "no-repeat", "background-position": "right 2px center" }}
            onChange={(e) => s.setSelVar(e.currentTarget.value)}
          >
            <For each={s.VARIABLES}>
              {([key, lbl]) => <option value={key}>{lbl}</option>}
            </For>
          </select>
        </div>
      </div>

      {/* Method */}
      <div style={pillGroupStyle}>
        <span style={pgkStyle}>Method</span>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            style={{ ...pillStyle, background: !s.useOls() ? "var(--color-card)" : "transparent", "border-color": !s.useOls() ? "var(--color-rule-2)" : "transparent", color: !s.useOls() ? "var(--color-ink)" : "var(--color-ink-soft)" }}
            onClick={() => s.setUseOls(false)}
          >Theil-Sen + MK</button>
          <button
            style={{ ...pillStyle, background: s.useOls() ? "var(--color-card)" : "transparent", "border-color": s.useOls() ? "var(--color-rule-2)" : "transparent", color: s.useOls() ? "var(--color-ink)" : "var(--color-ink-soft)" }}
            onClick={() => s.setUseOls(true)}
          >OLS</button>
        </div>
      </div>

      {/* Elevation correction */}
      <Show when={!s.isPrecip()}>
        <div style={pillGroupStyle}>
          <span style={pgkStyle}>Elevation corr.</span>
          <label style={{ position: "relative", width: "28px", height: "16px", "flex-shrink": "0", display: "inline-block" }}>
            <input type="checkbox" checked={s.corr()} onChange={(e) => s.setCorr(e.currentTarget.checked)} style={{ position: "absolute", opacity: "0", width: "0", height: "0" }} />
            <div style={{ position: "absolute", inset: "0", background: s.corr() ? "var(--color-accent)" : "var(--color-ink-faint)", "border-radius": "999px", cursor: "pointer", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", width: "12px", height: "12px", "border-radius": "50%", background: "#fff", top: "2px", left: s.corr() ? "14px" : "2px", transition: "left 0.2s" }} />
            </div>
          </label>
        </div>
      </Show>

      {/* Window */}
      <div style={pillGroupStyle}>
        <span style={pgkStyle}>Window</span>
        <div style={{ ...pillStyle, gap: "4px" }}>
          ±<input
            type="number" value={s.window_()} min="1" max="90"
            style={{ width: "36px", border: "none", background: "transparent", "font-size": "12px", color: "var(--color-ink)", "text-align": "center", "font-family": "var(--font-sans)" }}
            onInput={(e) => s.setWindow(Number(e.currentTarget.value) || 7)}
          /> days
        </div>
      </div>

      <div class="reg-doy-spacer" />

      {/* DOY control */}
      <div class="reg-doy-ctrl">
        <span style={{ "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.12em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "white-space": "nowrap" }}>Day</span>
        <div style={{ "font-family": "var(--font-mono)", "font-weight": "600", "font-size": "13px", background: "var(--color-card)", border: "1px solid var(--color-rule-2)", "border-radius": "7px", padding: "4px 10px", "min-width": "60px", "text-align": "center", "white-space": "nowrap" }}>
          {s.doyToLabel(s.doy())}
        </div>
        <div class="reg-doy-slider">
          <input
            type="range" min="1" max="365" value={s.doy()}
            style={{ flex: "1", appearance: "none", "-webkit-appearance": "none", background: "linear-gradient(to right,#3a5a8a,#6ca0c0,#e0d8c8,#c25a2c,#962c1a)", height: "3px", "border-radius": "2px", cursor: "pointer" }}
            onInput={(e) => s.setDoy(Number(e.currentTarget.value))}
          />
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          <button style={playBtnStyle} onClick={() => s.setDoy(d => Math.max(1, d - 1))}>◀</button>
          <button style={{ ...playBtnStyle, width: "36px", background: "var(--color-ink)", color: "#fff", "border-color": "var(--color-ink)" }} onClick={() => s.setDoy(d => Math.min(365, d + 1))}>▶</button>
        </div>
      </div>

    </div>
  );
}

// ── Scatter card ──────────────────────────────────────────────────────────────

export function RegScatterCard() {
  const s = useReg();
  return (
    <div class="reg-card">

      <div style={panelHStyle}>
        <div style={{ "min-width": "0" }}>
          <div style={panelTitleStyle}>{s.chartTitle()}</div>
          <div style={{ ...panelSubStyle, "margin-top": "3px" }}>{s.chartSub()}</div>
        </div>
        <Show when={s.stats0()}>
          {(st) => <div style={panelSubStyle}>{st().n_years} YR · {st().sig_label}</div>}
        </Show>
      </div>

      <div style={{ position: "relative", flex: "1", padding: "16px 20px 12px", display: "flex", "flex-direction": "column", background: "var(--color-paper)" }}>
        <Show when={s.totalChange() !== null}>
          <div style={statsBoxStyle}>
            <div style={{ "font-family": "var(--font-sans)", "font-size": "20px", "font-weight": "600", color: s.trendColor(), "letter-spacing": "-0.02em", "line-height": "1", "margin-bottom": "3px" }}>
              {Number(s.totalChange()) >= 0 ? "+" : ""}{s.totalChange()}
              <span style={{ "font-size": "11px", "font-weight": "400", "margin-left": "3px" }}>{s.isPrecip() ? "mm" : "°C"}</span>
            </div>
            <div style={{ "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.08em", "text-transform": "uppercase", color: "var(--color-ink-soft)" }}>
              change over record
            </div>
          </div>
        </Show>

        <div style={{ "min-height": "280px", flex: "1", display: "flex", "flex-direction": "column" }}>
          <Suspense fallback={<div class="animate-pulse h-full bg-[var(--color-paper-2)] rounded-lg" style={{ "min-height": "280px" }} />}>
            <Show when={s.regData()} keyed>
              {(d) => (
                <Show when={d.results.length > 0} fallback={
                  <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--color-ink-soft)", "font-size": "13px", "min-height": "280px" }}>
                    No data for the selected day and location.
                  </div>
                }>
                  <RegressionChart data={d} chartId={`reg-${s.selVar()}-${s.doy()}-${s.selLocs().join("_")}`} />
                </Show>
              )}
            </Show>
          </Suspense>
        </div>
      </div>

      <div style={chartFooterStyle}>
        <div style={{ display: "flex", gap: "12px", "align-items": "center", "flex-wrap": "wrap" }}>
          <span style={swatchStyle}><i style={{ background: "var(--color-accent-cool)", "border-radius": "50%", display: "inline-block", width: "8px", height: "8px" }} />Under mean</span>
          <span style={swatchStyle}><i style={{ background: "var(--color-accent)", "border-radius": "50%", display: "inline-block", width: "8px", height: "8px" }} />Over mean</span>
          <span style={swatchStyle}><i style={{ background: "var(--color-ink)", "border-radius": "1px", display: "inline-block", width: "14px", height: "3px" }} />Trend line</span>
          <span style={swatchStyle}><i style={{ background: "rgba(194,90,44,0.25)", "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />95% CI</span>
        </div>
        <Show when={s.stats0()}>
          {(st) => <span style={panelSubStyle}>{st().method ?? "Theil-Sen"} · {st().fit_desc}</span>}
        </Show>
      </div>

      <Show when={s.meta.strings?.explain_reg}>
        <p style={panelExplainStyle}>{s.meta.strings.explain_reg}</p>
      </Show>

    </div>
  );
}

// ── Year-round card ───────────────────────────────────────────────────────────

export function RegYearRoundCard() {
  const s = useReg();
  return (
    <div class="reg-card reg-card--cal">

      <div style={panelHStyle}>
        <div style={{ "min-width": "0" }}>
          <div style={panelTitleStyle}>Year-round trend · {s.selLocs()[0]?.replace(/_/g, " ")}</div>
          <div style={{ ...panelSubStyle, "margin-top": "3px" }}>
            {(s.VARIABLES.find(([k]) => k === s.selVar())?.[1] ?? s.selVar()).split("(")[0].trim()}
            {" · "}{s.useOls() ? "OLS" : "Theil-Sen + TFPW MK"}{" · "}±{s.window_()}d window
          </div>
        </div>
        <div style={panelSubStyle}>trend/decade per day of year · red line = selected day</div>
      </div>

      <div style={{ padding: "8px 16px 12px", background: "var(--color-paper)" }}>
        <Suspense fallback={<div class="animate-pulse rounded-lg bg-[var(--color-paper-2)]" style={{ height: "180px" }} />}>
          <Show when={s.calData()} keyed>
            {(d) => <YearRoundChart data={d} doy={s.doy()} var={s.selVar()} />}
          </Show>
        </Suspense>
      </div>

      <div style={{ ...chartFooterStyle, "justify-content": "flex-start", gap: "16px" }}>
        <span style={swatchStyle}><i style={{ background: "rgba(210,55,35,0.9)", "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />Warming</span>
        <span style={swatchStyle}><i style={{ background: "rgba(35,90,210,0.9)", "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />Cooling</span>
        <span style={{ ...panelSubStyle, "margin-left": "auto" }}>opacity = significance · p &lt; 0.001 fully opaque</span>
      </div>

      <Show when={s.meta.strings?.explain_cal}>
        <p style={panelExplainStyle}>{s.meta.strings.explain_cal}</p>
      </Show>

    </div>
  );
}

// ── Style objects ─────────────────────────────────────────────────────────────

const pillGroupStyle: Record<string, string> = {
  display:        "flex",
  "align-items":  "center",
  gap:            "6px",
  padding:        "4px 8px 4px 10px",
  "border-radius":"10px",
  background:     "var(--color-paper)",
  "flex-shrink":  "0",
  height:         "36px",
};

const pgkStyle: Record<string, string> = {
  "font-family":   "var(--font-mono)",
  "font-size":     "9px",
  "letter-spacing":"0.12em",
  "text-transform":"uppercase",
  color:           "var(--color-ink-soft)",
  "border-right":  "1px solid var(--color-rule-2)",
  "padding-right": "8px",
  "margin-right":  "2px",
  "white-space":   "nowrap",
};

const pillStyle: Record<string, string> = {
  display:        "inline-flex",
  "align-items":  "center",
  gap:            "5px",
  padding:        "4px 9px",
  "border-radius":"7px",
  background:     "var(--color-card)",
  border:         "1px solid var(--color-rule)",
  "font-size":    "12px",
  color:          "var(--color-ink)",
  cursor:         "pointer",
  "font-family":  "var(--font-sans)",
};

const locBtnStyle: Record<string, string> = {
  ...pillStyle,
  display:       "flex",
  "align-items": "center",
  gap:           "5px",
  background:    "var(--color-card)",
};

const locMenuStyle: Record<string, string> = {
  position:        "absolute",
  top:             "calc(100% + 6px)",
  left:            "0",
  "z-index":       "10",
  background:      "var(--color-card)",
  border:          "1px solid var(--color-rule-2)",
  "border-radius": "var(--radius, 10px)",
  "box-shadow":    "0 8px 24px rgba(14,14,12,0.12)",
  "min-width":     "180px",
  "max-height":    "280px",
  overflow:        "auto",
};

const locMenuHeaderStyle: Record<string, string> = {
  display:           "flex",
  "align-items":     "center",
  "justify-content": "space-between",
  padding:           "8px 12px",
  "border-bottom":   "1px solid var(--color-rule)",
  "font-size":       "11px",
  color:             "var(--color-ink-soft)",
};

const playBtnStyle: Record<string, string> = {
  display:        "inline-grid",
  "place-items":  "center",
  width:          "28px",
  height:         "28px",
  "border-radius":"7px",
  border:         "1px solid var(--color-rule)",
  background:     "var(--color-card)",
  cursor:         "pointer",
  "font-size":    "9px",
  color:          "var(--color-ink)",
};

export const panelHStyle: Record<string, string> = {
  padding:           "14px 20px 12px",
  display:           "flex",
  "align-items":     "baseline",
  "justify-content": "space-between",
  "border-bottom":   "1px solid var(--color-rule)",
  "flex-shrink":     "0",
  gap:               "8px",
};

export const panelTitleStyle: Record<string, string> = {
  "font-family":    "var(--font-sans)",
  "font-weight":    "500",
  "font-size":      "15px",
  "letter-spacing": "-0.02em",
  color:            "var(--color-ink)",
};

export const panelSubStyle: Record<string, string> = {
  "font-family":    "var(--font-mono)",
  "font-size":      "10px",
  "letter-spacing": "0.08em",
  "text-transform": "uppercase",
  color:            "var(--color-ink-soft)",
  "white-space":    "nowrap",
  overflow:         "hidden",
  "text-overflow":  "ellipsis",
};

const statsBoxStyle: Record<string, string> = {
  position:         "absolute",
  top:              "16px",
  right:            "20px",
  "text-align":     "right",
  "font-family":    "var(--font-mono)",
  "font-size":      "10px",
  color:            "var(--color-ink-soft)",
  "z-index":        "5",
  "pointer-events": "none",
};

const chartFooterStyle: Record<string, string> = {
  padding:           "10px 20px 14px",
  display:           "flex",
  "justify-content": "space-between",
  "align-items":     "center",
  "font-family":     "var(--font-mono)",
  "font-size":       "10px",
  "letter-spacing":  "0.06em",
  "text-transform":  "uppercase",
  color:             "var(--color-ink-soft)",
  "border-top":      "1px solid var(--color-rule)",
  "flex-shrink":     "0",
  "flex-wrap":       "wrap",
  gap:               "8px",
};

const swatchStyle: Record<string, string> = {
  display:       "flex",
  "align-items": "center",
  gap:           "5px",
};

const panelExplainStyle: Record<string, string> = {
  "font-family": "var(--font-sans)",
  "font-size":   "13px",
  color:         "var(--color-ink-soft)",
  "line-height": "1.55",
  margin:        "0",
  padding:       "10px 20px 16px",
};
