import { createSignal, createResource, createEffect, createMemo, createContext, useContext,
         Show, Suspense, ErrorBoundary, For, lazy } from "solid-js";
import type { JSXElement } from "solid-js";
import type { SiteMeta } from "../types.ts";
import type { RegressionParams } from "../api.ts";
import { fetchRegression, fetchCalendar, varLabel as varLabelOf,
         monthDayToDoy, doyToMonthDay, MONTH_LEN } from "../api.ts";
import { sectionErrorFallback } from "./SectionError.tsx";
import { t, fmtSigned, fmtDoy, fmtMonthLong } from "../i18n/format.ts";

const RegressionChart = lazy(() => import("../charts/RegressionChart.tsx").then(m => ({ default: m.RegressionChart })));
const YearRoundChart  = lazy(() => import("../charts/YearRoundChart.tsx").then(m => ({ default: m.YearRoundChart })));

// T-5.5 — variable labels come from the catalogue (reg.var_*, via api.varLabel).
const VAR_KEYS = [
  "temperature_max", "temperature_min", "temperature_mean",
  "precipitation_sum", "et0_evapotranspiration",
];
const VARIABLES: [string, string][] = VAR_KEYS.map(k => [k, varLabelOf(k)]);

interface ProviderProps {
  meta:         SiteMeta;
  defaultDoy:   number;
  syncLoc?:     () => string | null;
  onLocChange?: (loc: string) => void;
  children?:    JSXElement;
}

function doyToLabel(doy: number): string {
  return fmtDoy(doy);
}

// T-5.28 — the calendar picker sizes each month's day grid from MONTH_LEN (api.ts).
// No weekday columns: the control has no year, so weekday alignment would be arbitrary
// and would misrepresent a day-of-year selection as a dated day.

// ── Store factory ─────────────────────────────────────────────────────────────

function createStore(props: ProviderProps) {
  const defaultLoc = () => props.meta.default_location ?? "Ljubljana";

  const [selLocs,  setSelLocs]  = createSignal<string[]>([defaultLoc()]);
  const [selVar,   setSelVar]   = createSignal("temperature_max");
  const [doy,      setDoy]      = createSignal(props.defaultDoy);
  const [locOpen,  setLocOpen]  = createSignal(false);

  createEffect(() => {
    const ext = props.syncLoc?.();
    if (ext) setSelLocs([ext]);
  });

  const params = createMemo((): RegressionParams => ({
    locs:   selLocs(),
    var:    selVar(),
    doy:    doy(),
  }));
  const [regData, { refetch: refetchReg }] = createResource(params, fetchRegression);

  const calParams = createMemo(() => ({
    loc:     selLocs()[0] ?? defaultLoc(),
    var:     selVar(),
  }));
  const [calData, { refetch: refetchCal }] = createResource(
    calParams,
    p => fetchCalendar(p.loc, p.var),
  );

  const isPrecip   = () => selVar() === "precipitation_sum" || selVar() === "et0_evapotranspiration";
  const stats0     = () => (regData()?.results ?? [])[0]?.stats;
  const trend10    = () => stats0()?.trend10 ?? 0;
  const trendColor = () => {
    const t = trend10();
    if (isPrecip()) return t >= 0 ? "#1a5fc8" : "#a05c20";
    return t >= 0 ? "#cc2222" : "#1a5fc8";
  };
  const totalChange = (): number | null => {
    const s = stats0();
    if (!s) return null;
    return trend10() * s.n_years / 10;
  };
  const stationLabel = (name: string) => {
    const st = props.meta.stations.find(s => s.name === name);
    return (st?.label ?? name).replace(/_/g, " ");
  };
  const locLabel   = () => {
    const locs = selLocs();
    return locs.length === 1 ? stationLabel(locs[0]!) : t("reg.locations_multi", { count: locs.length });
  };
  const varLabel   = () => VARIABLES.find(([k]) => k === selVar())?.[1] ?? selVar();
  const chartTitle = () => `${varLabel().split("(")[0]!.trim()} · ${doyToLabel(doy())}`;
  const chartSub   = () => selLocs().map(stationLabel).join(", ");

  function toggleLoc(name: string) {
    setSelLocs(prev => {
      if (prev.includes(name)) return prev.length > 1 ? prev.filter(l => l !== name) : prev;
      return [...prev, name].slice(0, 6);
    });
  }

  return {
    meta: props.meta,
    selLocs, setSelLocs, selVar, setSelVar,
    doy, setDoy,
    locOpen, setLocOpen,
    regData, calData, refetchReg, refetchCal,
    isPrecip, stats0, trend10, trendColor, totalChange,
    locLabel, varLabel, chartTitle, chartSub,
    toggleLoc, doyToLabel, VARIABLES,
  };
}

type Store = ReturnType<typeof createStore>;
const RegressionCtx = createContext<Store>();
export const useReg = () => useContext(RegressionCtx)!;

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

  // ── Calendar picker state (T-5.28) ─────────────────────────────────────────
  const [calOpen,    setCalOpen]    = createSignal(false);
  const [calMonth,   setCalMonth]   = createSignal(1);   // 1..12 shown in the grid
  const [focusedDay, setFocusedDay] = createSignal(1);   // roving-tabindex day
  let triggerRef: HTMLDivElement | undefined;
  const dayRefs: (HTMLButtonElement | undefined)[] = [];

  const openCal = () => {
    const { month, day } = doyToMonthDay(s.doy());
    setCalMonth(month);
    setFocusedDay(day);
    setCalOpen(true);
  };
  const closeCal = (returnFocus: boolean) => {
    setCalOpen(false);
    if (returnFocus) triggerRef?.focus();
  };
  const selectDay = (day: number) => {
    s.setDoy(monthDayToDoy(calMonth(), day));
    closeCal(true);
  };
  const stepMonth = (delta: number) => {
    const m = ((calMonth() - 1 + delta + 12) % 12) + 1;  // wrap 1..12 (yearless)
    setCalMonth(m);
    setFocusedDay(d => Math.min(d, MONTH_LEN[m - 1]!));
  };

  // Move DOM focus to the roving day button whenever the target day, the month, or
  // open-state changes (the grid re-renders on month change, so refs are rebuilt).
  createEffect(() => {
    if (calOpen()) dayRefs[focusedDay()]?.focus();
  });

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openCal();
    }
  };
  const onGridKey = (e: KeyboardEvent) => {
    const len = MONTH_LEN[calMonth() - 1]!;
    const d = focusedDay();
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); setFocusedDay(Math.min(len, d + 1)); break;
      case "ArrowLeft":  e.preventDefault(); setFocusedDay(Math.max(1, d - 1));   break;
      case "ArrowDown":  e.preventDefault(); setFocusedDay(Math.min(len, d + 7)); break;
      case "ArrowUp":    e.preventDefault(); setFocusedDay(Math.max(1, d - 7));   break;
      case "Home":       e.preventDefault(); setFocusedDay(1);   break;
      case "End":        e.preventDefault(); setFocusedDay(len); break;
      case "PageUp":     e.preventDefault(); stepMonth(-1); break;
      case "PageDown":   e.preventDefault(); stepMonth(1);  break;
      case "Enter":
      case " ":          e.preventDefault(); selectDay(focusedDay()); break;
      case "Escape":     e.preventDefault(); closeCal(true); break;
    }
  };

  return (
    <div class="reg-toolbar">

      {/* Location */}
      <div style={{ position: "relative" }}>
        <div style={pillGroupStyle}>
          <span style={pgkStyle}>{t("reg.location")}</span>
          <button style={locBtnStyle} onClick={() => s.setLocOpen(v => !v)}>
            <span>{s.locLabel()}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <Show when={s.locOpen()}>
          <div style={locMenuStyle} onClick={(e) => e.stopPropagation()}>
            <div style={locMenuHeaderStyle}>
              <span style={{ "font-size": "11px", "font-weight": "600", "font-family": "var(--font-sans)" }}>{t("reg.select_locations")}</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-soft)", "font-size": "14px" }} onClick={() => s.setLocOpen(false)}>✕</button>
            </div>
            <For each={s.meta.stations}>
              {(st) => {
                const active = () => s.selLocs().includes(st.name);
                return (
                  <label style={{ display: "flex", "align-items": "center", gap: "8px", padding: "5px 12px", cursor: "pointer", "font-size": "12px", "font-family": "var(--font-sans)", color: "var(--color-ink)", background: active() ? "var(--color-paper-2)" : "transparent" }}>
                    <input type="checkbox" checked={active()} onChange={() => s.toggleLoc(st.name)} />
                    {st.label ?? st.name}
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
        <span style={pgkStyle}>{t("reg.variable")}</span>
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

      {/* NB: former "Method" (Theil-Sen/OLS) and "Elevation corr." toolbar controls
          were removed in T-4.15 — they were dead. Their signals fed
          RegressionParams.corr/method, but fetchRegression reads the precomputed
          annual_trend table and ignores both; the values never reached a request or
          computation. The controls also carried false labels: the data is always
          Theil-Sen + TFPW MK with elevation correction baked in (D-5), so "OLS" and
          the toggle promised a switch that never happened. The genuine method/colour
          readouts (stats.method footer, precip-vs-temp trend colour) are sourced
          elsewhere and are untouched. */}

      <div class="reg-doy-spacer" />

      {/* DOY control */}
      <div class="reg-doy-ctrl">
        <span style={{ "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.12em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "white-space": "nowrap" }}>{t("reg.day")}</span>
        {/* T-5.28: the "1. avg." display doubles as the calendar trigger. Kept a
            <div role="button"> (not a native <button>) so it stays the first
            `.reg-doy-ctrl > div` the snapshot reads as `day_label`; the popover is a
            SIBLING of the trigger, never a descendant (no button-in-button). */}
        <div class="reg-doy-label">
          <div
            ref={triggerRef}
            class="reg-doy-value"
            role="button"
            tabindex="0"
            aria-haspopup="dialog"
            aria-expanded={calOpen()}
            aria-label={t("reg.pick_day")}
            onClick={() => (calOpen() ? closeCal(false) : openCal())}
            onKeyDown={onTriggerKey}
          >
            {s.doyToLabel(s.doy())}
          </div>
          <Show when={calOpen()}>
            <div
              class="reg-cal-pop"
              role="dialog"
              aria-label={t("reg.calendar")}
              onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeCal(true); } }}
            >
              <div class="reg-cal-head">
                <button type="button" class="reg-cal-nav" aria-label={t("reg.prev_month")} onClick={() => stepMonth(-1)}>◀</button>
                <span class="reg-cal-title">{fmtMonthLong(calMonth())}</span>
                <button type="button" class="reg-cal-nav" aria-label={t("reg.next_month")} onClick={() => stepMonth(1)}>▶</button>
              </div>
              <div class="reg-cal-grid" onKeyDown={onGridKey}>
                <For each={Array.from({ length: MONTH_LEN[calMonth() - 1]! }, (_, i) => i + 1)}>
                  {(day) => {
                    const selected = () => {
                      const md = doyToMonthDay(s.doy());
                      return md.month === calMonth() && md.day === day;
                    };
                    return (
                      <button
                        type="button"
                        ref={(el) => (dayRefs[day] = el)}
                        class="reg-cal-day"
                        aria-label={`${day}. ${fmtMonthLong(calMonth())}`}
                        aria-pressed={selected()}
                        tabindex={focusedDay() === day ? 0 : -1}
                        onClick={() => selectDay(day)}
                      >
                        {day}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <div style={{ position: "fixed", inset: "0", "z-index": "9" }} onClick={() => closeCal(false)} />
          </Show>
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
      <ErrorBoundary fallback={sectionErrorFallback(s.refetchReg, "280px")}>

      <div style={panelHStyle}>
        <div style={{ "min-width": "0" }}>
          <div style={panelTitleStyle}>{s.chartTitle()}</div>
          <div style={{ ...panelSubStyle, "margin-top": "3px" }}>{s.chartSub()}</div>
        </div>
        <Show when={s.stats0()}>
          {(st) => <div style={panelSubStyle}>{t("reg.years_sig", { count: st().n_years, sig: st().sig_label })}</div>}
        </Show>
      </div>

      <div style={{ position: "relative", flex: "1", padding: "16px 20px 12px", display: "flex", "flex-direction": "column", background: "var(--color-paper)" }}>
        <Show when={s.totalChange() !== null}>
          <div style={statsBoxStyle}>
            <div style={{ "font-family": "var(--font-sans)", "font-size": "20px", "font-weight": "600", color: s.trendColor(), "letter-spacing": "-0.02em", "line-height": "1", "margin-bottom": "3px" }}>
              {fmtSigned(s.totalChange()!, 2)}
              <span style={{ "font-size": "11px", "font-weight": "400", "margin-left": "3px" }}>{s.isPrecip() ? "mm" : "°C"}</span>
            </div>
            <div style={{ "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.08em", "text-transform": "uppercase", color: "var(--color-ink-soft)" }}>
              {t("reg.change_over_record")}
            </div>
          </div>
        </Show>

        <div style={{ "min-height": "280px", flex: "1", display: "flex", "flex-direction": "column" }}>
          <Suspense fallback={<div class="animate-pulse h-full bg-[var(--color-paper-2)] rounded-lg" style={{ "min-height": "280px" }} />}>
            <Show when={s.regData()} keyed>
              {(d) => (
                <Show when={d.results.length > 0} fallback={
                  <div role="status" style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--color-ink-soft)", "font-size": "13px", "min-height": "280px" }}>
                    {t("reg.no_data")}
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
          <span style={swatchStyle}><i style={{ background: "var(--color-accent-cool)", "border-radius": "50%", display: "inline-block", width: "8px", height: "8px" }} />{t("reg.under_mean")}</span>
          <span style={swatchStyle}><i style={{ background: "var(--color-accent)", "border-radius": "50%", display: "inline-block", width: "8px", height: "8px" }} />{t("reg.over_mean")}</span>
          <span style={swatchStyle}><i style={{ background: "var(--color-ink)", "border-radius": "1px", display: "inline-block", width: "14px", height: "3px" }} />{t("reg.trend_line")}</span>
          <span style={swatchStyle}><i style={{ background: "rgba(194,90,44,0.25)", "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />{t("common.ci95")}</span>
        </div>
        <Show when={s.stats0()}>
          {(st) => <span style={panelSubStyle}>{st().method ?? "Theil-Sen"} · {st().fit_desc}</span>}
        </Show>
      </div>

      <Show when={s.meta.strings?.explain_reg}>
        <p style={panelExplainStyle}>{s.meta.strings.explain_reg}</p>
      </Show>

      </ErrorBoundary>
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
          <div style={panelTitleStyle}>{t("reg.year_round_title", { station: s.selLocs()[0]?.replace(/_/g, " ") ?? "" })}</div>
          <div style={{ ...panelSubStyle, "margin-top": "3px" }}>
            {(s.VARIABLES.find(([k]) => k === s.selVar())?.[1] ?? s.selVar()).split("(")[0]!.trim()}
            {" · Theil-Sen + MK"}
          </div>
        </div>
        <div style={panelSubStyle}>{t("reg.year_round_sub")}</div>
      </div>

      <div style={{ padding: "8px 16px 12px", background: "var(--color-paper)" }}>
        <ErrorBoundary fallback={sectionErrorFallback(s.refetchCal, "180px")}>
          <Suspense fallback={<div class="animate-pulse rounded-lg bg-[var(--color-paper-2)]" style={{ height: "180px" }} />}>
            <Show when={s.calData()} keyed>
              {(d) => <YearRoundChart data={d} doy={s.doy()} var={s.selVar()} />}
            </Show>
          </Suspense>
        </ErrorBoundary>
      </div>

      <div style={{ ...chartFooterStyle, "justify-content": "flex-start", gap: "16px" }}>
        <span style={swatchStyle}><i style={{ background: "rgba(210,55,35,0.9)", "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />{t("reg.warming")}</span>
        <span style={swatchStyle}><i style={{ background: "rgba(35,90,210,0.9)", "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />{t("reg.cooling")}</span>
        <span style={{ ...panelSubStyle, "margin-left": "auto" }}>{t("reg.year_round_footer")}</span>
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
