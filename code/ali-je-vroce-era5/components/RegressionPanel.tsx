import { createSignal, createResource, createEffect, createMemo, createContext, useContext,
         onMount, onCleanup, Show, Suspense, ErrorBoundary, For, lazy } from "solid-js";
import type { JSXElement } from "solid-js";
import type { SiteMeta } from "../types.ts";
import type { RegressionParams } from "../api.ts";
import { fetchRegression, fetchCalendar, varLabel as varLabelOf,
         monthDayToDoy, doyToMonthDay, MONTH_LEN } from "../api.ts";
import { sectionErrorFallback } from "./SectionError.tsx";
import { t, fmtSigned, fmtInt, fmtDoy, fmtMonthLong } from "../i18n/format.ts";
import { bandColor, bandKey } from "../i18n/station-bands.ts";
import { readUiPrefs, writeUiPref } from "../prefs.ts";
// T-5.51 (E1) — legend swatch colours, from the SAME palette module the chart bars use
// (trend-colors.ts). Plain function, no Highcharts, so a static import is bundle-safe.
import { swatchColors } from "../charts/trend-colors.ts";

const RegressionChart = lazy(() => import("../charts/RegressionChart.tsx").then(m => ({ default: m.RegressionChart })));
const YearRoundChart  = lazy(() => import("../charts/YearRoundChart.tsx").then(m => ({ default: m.YearRoundChart })));

// T-5.5 — variable labels come from the catalogue (reg.var_*, via api.varLabel).
const VAR_KEYS = [
  "temperature_max", "temperature_min", "temperature_mean",
  "precipitation_sum", "et0_evapotranspiration",
];
const VARIABLES: [string, string][] = VAR_KEYS.map(k => [k, varLabelOf(k)]);

// T-5.51 (E1–E3) — the comparison language is per-variable: the trend axis for precip/ET₀
// is "more/less", not "warmer/cooler". These select among catalogue keys (D-8: no
// sentences built in code) by the selected variable. Called reactively with s.selVar().
function calLegend(variable: string): { pos: string; neg: string } {
  if (variable === "precipitation_sum")     return { pos: t("reg.more_precip"), neg: t("reg.less_precip") };
  if (variable === "et0_evapotranspiration") return { pos: t("reg.more_et0"),   neg: t("reg.less_et0") };
  return { pos: t("reg.warming"), neg: t("reg.cooling") };
}
function explainCal(variable: string): string {
  if (variable === "precipitation_sum")     return t("reg.explain_cal_precip");
  if (variable === "et0_evapotranspiration") return t("reg.explain_cal_et0");
  return t("reg.explain_cal");
}
function explainReg(variable: string): string {
  // Precip/ET₀ read raw columns — no elevation correction — so drop that clause (E3).
  return variable === "precipitation_sum" || variable === "et0_evapotranspiration"
    ? t("reg.explain_reg_nocorr")
    : t("reg.explain_reg");
}

// T-4.26b (D-34) — the selectable trend half-windows, ascending. ±7 is the published
// default and the ONLY one served by the `annual_trend` table (api.annualTrendSource);
// ±3/±15/±45 come from `annual_trend_windows` (T-4.26a). The control drives the panel
// and the year-round calendar; the hero above is fixed at ±7.
const WINDOWS = [3, 7, 15, 45] as const;

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

  // T-5.27 / D-26 — the location below the hero is now a SINGLE station. `selLocs`
  // is kept as an always-length-1 array only so the fetch layer (RegressionParams.locs
  // → fetchRegression maps over it, RegressionChart plots one series per result) is
  // untouched; the multi-station selector and its ≥1 toggle are gone. National is not
  // offered below the hero — annual_trend / season_heatmap / tropical / calendar have
  // no national row and fetchEra5Tropical returns null for it (api.ts), so the floating
  // chooser lists the 18 stations only.
  const [selLocs,  setSelLocs]  = createSignal<string[]>([defaultLoc()]);
  const [selVar,   setSelVar]   = createSignal("temperature_max");
  const [doy,      setDoy]      = createSignal(props.defaultDoy);
  // T-4.26b (D-34) — the trend half-window, ±7 default (the published value). Only the
  // surfaces BELOW the control read it (params + calParams below); the hero does not.
  const [selWindow, setSelWindow] = createSignal<number>(7);

  const selLoc = () => selLocs()[0] ?? defaultLoc();
  // The single writer for the below-hero location. It also notifies the page via
  // onLocChange (→ setMapLoc), so the station map's header and marker highlight follow
  // the floating chooser's selection. T-5.39 retired the reverse path: the map is an
  // orientation aid only now, no longer a chooser, so it no longer writes back.
  const setLoc = (name: string) => {
    setSelLocs([name]);
    props.onLocChange?.(name);
  };

  // syncLoc is a controlled-location input: an external signal that pins the station.
  // Production no longer wires it (the station map used to, via mapLoc, until T-5.39);
  // it remains the seam the snapshot harness uses to set a station per case.
  createEffect(() => {
    const ext = props.syncLoc?.();
    if (ext) setSelLocs([ext]);
  });

  const params = createMemo((): RegressionParams => ({
    locs:   selLocs(),
    var:    selVar(),
    doy:    doy(),
    window: selWindow(),
  }));
  const [regData, { refetch: refetchReg }] = createResource(params, fetchRegression);

  const calParams = createMemo(() => ({
    loc:     selLocs()[0] ?? defaultLoc(),
    var:     selVar(),
    window:  selWindow(),
  }));
  const [calData, { refetch: refetchCal }] = createResource(
    calParams,
    p => fetchCalendar(p.loc, p.var, p.window),
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
  // T-5.31 family (recorded in 1a): station.name is the ASCII era5_name key,
  // station.label is the diacritic display name. Always show the label.
  const stationLabel = (name: string) => {
    const st = props.meta.stations.find(s => s.name === name);
    return (st?.label ?? name).replace(/_/g, " ");
  };
  const locLabel   = () => stationLabel(selLoc());
  const varLabel   = () => VARIABLES.find(([k]) => k === selVar())?.[1] ?? selVar();
  // T-5.27 part (3): the scatter card names its station in the TITLE (it was only in
  // the subtitle), so a reader whose station is set by the off-screen floating chooser
  // can read the chart on its own. The day is in the subtitle. T-5.47: the title is now
  // rendered as JSX (StationTag dot + metres + " · variable") directly in RegScatterCard,
  // so the former `chartTitle` string memo is gone — a string cannot carry the dot node.
  const chartSub   = () => doyToLabel(doy());

  return {
    meta: props.meta,
    selLocs, setSelLocs, selLoc, setLoc, selVar, setSelVar,
    doy, setDoy,
    selWindow, setSelWindow,
    regData, calData, refetchReg, refetchCal,
    isPrecip, stats0, trend10, trendColor, totalChange,
    stationLabel, locLabel, varLabel, chartSub,
    doyToLabel, VARIABLES, WINDOWS,
  };
}

type Store = ReturnType<typeof createStore>;
const RegressionCtx = createContext<Store>();
export const useReg = () => useContext(RegressionCtx)!;

// ── T-5.47 station tag: coloured elevation dot + name (+ optional metres) ────────
// Layer 2 of the elevation disclosure: wherever a single station is named as the
// subject of an analysis header (scatter title, year-round title), show the band dot
// PLUS the elevation in metres. The tooltip ("<station>, <n> m — <band>") lives on the
// dot as BOTH `title` (hover) and `aria-label` (mirrored, so it is not hover-only).
// The band NAME appears only in that tooltip — never inline next to the dot.
//
// The dot and the metres are <i>, deliberately NOT <span>: the year-round card's
// snapshot capture reads `.all("span")`, so a <span> here would add a phantom entry
// and change that array's length (T-5.47 step-7 / Change 3). Attribute text (title,
// aria-label) is invisible to `.txt()`, so only the visible metres move a captured leaf.
function StationTag(props: { name: string; withMetres?: boolean }) {
  const s = useReg();
  const st    = () => s.meta.stations.find(x => x.name === props.name);
  const elev  = () => st()?.elevation;
  const label = () => s.stationLabel(props.name);
  const tip   = () => {
    const e = elev();
    return e == null ? label() : `${label()}, ${fmtInt(e)} m — ${t(`bands.name_${bandKey(e)}`)}`;
  };
  return (
    <>
      <Show when={elev() != null}>
        <i class="station-dot" role="img" aria-label={tip()} title={tip()}
           style={{ background: bandColor(elev()!) }} />
      </Show>
      {label()}
      <Show when={props.withMetres && elev() != null}>
        <i class="station-tag-m">{" "}{fmtInt(elev()!)} m</i>
      </Show>
    </>
  );
}

// The year-round title "Celoletni trend · {station}" (reg.year_round_title) is split on
// its {station} slot — via a NUL sentinel, so no reliance on the literal separator — so
// RegYearRoundCard can drop a StationTag node where {station} sits while keeping sl.ts
// the single source for the surrounding words.
const SENTINEL = String.fromCharCode(0);
const [TITLE_BEFORE_STATION, TITLE_AFTER_STATION] =
  t("reg.year_round_title", { station: SENTINEL }).split(SENTINEL) as [string, string];

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
    } else if (!calOpen() && e.key === "ArrowLeft") {
      // T-5.37: ±1-day stepping for keyboard users, moved here when the slider
      // (a native range input, itself an arrow-stepper) and the ◀ ▶ buttons were
      // removed. Same clamping the arrows used. Undiscoverable for mouse users by
      // design — this compensates keyboard users, it does not replace the arrows.
      e.preventDefault();
      s.setDoy(d => Math.max(1, d - 1));
    } else if (!calOpen() && e.key === "ArrowRight") {
      e.preventDefault();
      s.setDoy(d => Math.min(365, d + 1));
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

      {/* T-5.27 / D-26 — the inline LOKACIJA multi-select was RETIRED here. The single
          location for every section below "Analiza trendov" is now the floating
          FloatingStationChooser (bottom-right corner); multi-station comparison was
          dropped deliberately. The store keeps `selLocs` as a length-1 array so the
          fetch layer is unchanged. */}

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

      {/* Window (T-4.26b / D-34) — placed AFTER the variable <select> on purpose: the
          snapshot's variable_select capture reads querySelector("select") (the FIRST
          select), so a second select ahead of it would hijack that capture. Drives ONLY
          the panel + calendar below; the hero omits window and stays on annual_trend. */}
      <div style={pillGroupStyle}>
        <span style={pgkStyle}>{t("reg.window")}</span>
        <div style={{ ...pillStyle, "padding-right": "4px" }}>
          <select
            value={String(s.selWindow())}
            style={selectStyle}
            onChange={(e) => s.setSelWindow(Number(e.currentTarget.value))}
          >
            <For each={s.WINDOWS}>
              {(w) => <option value={String(w)}>{t("reg.window_opt", { n: w })}</option>}
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
            aria-keyshortcuts="ArrowLeft ArrowRight"
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
      </div>

      {/* Per-window explanation (T-4.26b / D-34) — a full-width row beneath the controls:
          flex-basis:100% makes the wrapping toolbar drop it onto its own line. It is a
          direct .reg-toolbar > div so the snapshot captures it (it would be a blind spot
          otherwise). Copy changes with the selected window and explains WHY the numbers
          move for that window (instability at ±3, seasonal contamination at ±15/±45). */}
      <div style={windowExplStyle}>{t(`reg.window_expl_${s.selWindow()}`)}</div>

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
          {/* T-5.47 site 2 — station dot + metres, then " · variable". Captured leaf
              `analysis.rendered.title` gains " <n> m" (text-only, no numeric value). */}
          <div style={panelTitleStyle}><StationTag name={s.selLoc()} withMetres /> · {s.varLabel().split("(")[0]!.trim()}</div>
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
                  <RegressionChart data={d} chartId={`reg-${s.selVar()}-${s.doy()}-w${s.selWindow()}-${s.selLocs().join("_")}`} />
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

      {/* T-5.51 (E3/§3) — rendered reactively via t() keyed on the selected variable
          (moved out of the non-reactive meta.strings); precip/ET₀ drop the elevation clause. */}
      <p style={panelExplainStyle}>{explainReg(s.selVar())}</p>

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
          {/* T-5.47 site 3 — station dot + metres. The title template "Celoletni trend ·
              {station}" is split on its {station} slot so the tag renders as a node, not
              a string. Captured leaf `year_round_calendar.rendered.title` gains " <n> m"
              (text-only). The dot is an <i>, so `.all("span")` legend length is unchanged. */}
          <div style={panelTitleStyle}>{TITLE_BEFORE_STATION}<StationTag name={s.selLoc()} withMetres />{TITLE_AFTER_STATION}</div>
          <div style={{ ...panelSubStyle, "margin-top": "3px" }}>
            {(s.VARIABLES.find(([k]) => k === s.selVar())?.[1] ?? s.selVar()).split("(")[0]!.trim()}
            {" · Theil-Sen + MK"}
            {/* T-4.26b (D-34) — name the window the calendar's colours are computed at. */}
            {" · "}{t("reg.window_cal_label", { n: s.selWindow() })}
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
        {/* T-5.51 (E1) — swatch colour AND word both track the selected variable: they
            read the same palette (swatchColors) the bars use, so legend ⇄ bars can't diverge. */}
        <span style={swatchStyle}><i style={{ background: swatchColors(s.selVar()).pos, "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />{calLegend(s.selVar()).pos}</span>
        <span style={swatchStyle}><i style={{ background: swatchColors(s.selVar()).neg, "border-radius": "2px", display: "inline-block", width: "10px", height: "10px" }} />{calLegend(s.selVar()).neg}</span>
        <span style={{ ...panelSubStyle, "margin-left": "auto" }}>{t("reg.year_round_footer")}</span>
      </div>

      {/* T-5.51 (E2/§3) — reactive per-variable colour legend (moved out of meta.strings). */}
      <p style={panelExplainStyle}>{explainCal(s.selVar())}</p>

    </div>
  );
}

// ── Floating station chooser (T-5.27 / D-26 / D-27) ───────────────────────────
//
// The single location control for the WHOLE page — over the hero and every section
// below it (T-5.35 retired the hero's inline <select>). Fixed to the bottom-right
// corner. It is PRESENT AT PAGE LOAD, not gated on scrolling into a region: with the
// select gone it is the only way to change location, so it cannot hide until the
// reader scrolls. Once scrolling begins it fades out on scroll-start and back in on
// scroll-stop (so it never flickers on a gesture), and stays visible while open or
// while it holds focus, so a keyboard user never chases a moving target.
//
// Its option list is POSITION-DEPENDENT (D-27): 19 entries (Slovenija + 18 stations)
// while the hero is in view, 18 once it is not. The propagation is ASYMMETRIC and
// that is the point — picking a STATION sets it everywhere (hero + body + map), so
// the common case behaves as one control; picking SLOVENIJA sets the HERO ONLY and
// leaves the body on its previous station. Forced by the data: annual_trend /
// season_heatmap / calendar / tropical have no national row (api.ts:696), so
// propagating national downward would blank five sections at once. Slovenija is
// therefore offered ONLY where the hero can show it, and is never reachable below.
//
// The list EXPANDS UPWARD (over content already read, not down into charts not yet
// reached), which is exactly why it cannot be a native <select> — the browser owns
// that dropdown's direction. Everything a native control gives for free is built
// here: roving-tabindex keyboard, focus return, outside-click dismissal,
// listbox/option semantics.
//
// FIRST-USE CUE (T-5.35): because the icon is now the only location control, a
// first-time reader must notice it. The cue has a non-motion base that works under
// prefers-reduced-motion — an accent ring on the trigger plus the location label
// shown beside the icon (only while the hero is in view, where there is room; below
// the hero it would recreate the overlap the icon-only resting state was made to fix,
// T-5.27) — with a FINITE 3-iteration ripple added on top under no-preference only
// (no unconditional blinking; T-5.15 guard). It is dismissed permanently on the first
// OPEN (a selection is not required), persisted in localStorage (prefs.ts); if
// storage is unavailable the cue simply shows again.
interface ChooserOpt { name: string; label: string; national: boolean; elevation?: number; }
export function FloatingStationChooser(props: {
  heroAnchor:      () => HTMLElement | undefined;  // the today-status section
  heroLoc:         () => string | null;            // the hero's current location
  onHeroLocChange: (loc: string) => void;          // write the hero's location
  nationalLoc:     string;                          // ERA5_NATIONAL sentinel
  nationalCount:   number;                          // station count for the label
}) {
  const s = useReg();

  const [open,        setOpen]        = createSignal(false);
  const [heroInView,  setHeroInView]  = createSignal(false);
  const [scrolling,   setScrolling]   = createSignal(false);
  const [focusWithin, setFocusWithin] = createSignal(false);
  const [focusIdx,    setFocusIdx]    = createSignal(0);
  const [seen,        setSeen]        = createSignal(true);  // default hidden → no
  // flash for returning readers; onMount reads storage and reveals the cue if fresh.

  const shown      = () => open() || focusWithin() || !scrolling();
  const cueActive  = () => !seen();
  const showLabel  = () => heroInView();   // label persists over the hero (self-
  // describing sole control; there is room there and no overlap to recreate)

  const nationalLabel = () => t("today.loc_national", { count: props.nationalCount });

  // Stations sorted by the DIACRITIC display name, Slovene collation (Č/Š/Ž sort
  // right after C/S/Z, not by code point).
  const stationOpts = createMemo<ChooserOpt[]>(() =>
    [...s.meta.stations]
      .sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name, "sl"))
      .map(st => ({ name: st.name, label: st.label ?? st.name, national: false, elevation: st.elevation })),
  );
  const options = createMemo<ChooserOpt[]>(() =>
    heroInView()
      ? [{ name: props.nationalLoc, label: nationalLabel(), national: true }, ...stationOpts()]
      : stationOpts(),
  );

  // What the control REPRESENTS: the hero's location while the hero is in view (so the
  // sole control names what the reader is looking at, national included), the body
  // station once scrolled past it. Drives the trigger label, aria name, and highlight.
  const currentLoc   = () => (heroInView() ? props.heroLoc() : s.selLoc());
  const currentLabel = () => {
    const l = currentLoc();
    return l === props.nationalLoc ? nationalLabel() : s.stationLabel(l ?? "");
  };
  // Elevation of the currently-represented station (undefined for national / unknown),
  // for the trigger's Layer-1 dot.
  const currentElev = () => {
    const l = currentLoc();
    if (l == null || l === props.nationalLoc) return undefined;
    return s.meta.stations.find(x => x.name === l)?.elevation;
  };

  let triggerRef: HTMLButtonElement | undefined;
  let listRef:    HTMLUListElement  | undefined;
  const optRefs: (HTMLLIElement | undefined)[] = [];
  let alignFoot = false;

  const HERO_MARGIN    = 72;   // hero counts as "in view" until its bottom passes this
  const SCROLL_STOP_MS = 160;
  let stopTimer: number | undefined;

  const recompute = () => {
    const el = props.heroAnchor();
    setHeroInView(!!el && el.getBoundingClientRect().bottom > HERO_MARGIN);
  };
  const onScroll = () => {
    recompute();
    setScrolling(true);
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => setScrolling(false), SCROLL_STOP_MS);
  };

  onMount(() => {
    recompute();  // the page may load already scrolled past the hero
    if (readUiPrefs().locChooserSeen !== true) setSeen(false);  // fresh reader → cue
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recompute, { passive: true });
  });
  onCleanup(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", recompute);
    if (stopTimer) clearTimeout(stopTimer);
  });

  // First OPEN dismisses the cue permanently — opening is enough, a selection is not
  // required. Fails toward showing again if the write is unavailable (prefs.ts).
  const markSeen = () => {
    if (seen()) return;
    setSeen(true);
    writeUiPref("locChooserSeen", true);
  };

  const openMenu = () => {
    markSeen();
    const idx = options().findIndex(o => o.name === currentLoc());
    setFocusIdx(idx < 0 ? 0 : idx);
    alignFoot = true;   // pin the current selection to the foot of the list on open
    setOpen(true);
  };
  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef?.focus();
  };
  // Asymmetric propagation (D-27): a station sets hero + body + map; Slovenija sets
  // the hero only and leaves the body (and the map) on their previous station, since
  // national has no per-station analysis to show.
  const choose = (name: string) => {
    if (name === props.nationalLoc) {
      props.onHeroLocChange(name);
    } else {
      props.onHeroLocChange(name);
      s.setLoc(name);
    }
    closeMenu(true);
  };

  // Move DOM focus to the roving option on open / navigation. On open, scroll the
  // selected option to the FOOT of the list (nearest the trigger); during arrow
  // navigation, only nudge it into view.
  createEffect(() => {
    if (!open()) return;
    const el = optRefs[focusIdx()];
    if (!el) return;
    el.focus({ preventScroll: true });
    if (alignFoot && listRef) {
      listRef.scrollTop = Math.max(0, el.offsetTop + el.offsetHeight - listRef.clientHeight);
      alignFoot = false;
    } else {
      el.scrollIntoView({ block: "nearest" });
    }
  });

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      openMenu();
    }
  };
  const onListKey = (e: KeyboardEvent) => {
    const n = options().length;
    const i = focusIdx();
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setFocusIdx(Math.min(n - 1, i + 1)); break;
      case "ArrowUp":   e.preventDefault(); setFocusIdx(Math.max(0, i - 1));     break;
      case "Home":      e.preventDefault(); setFocusIdx(0);     break;
      case "End":       e.preventDefault(); setFocusIdx(n - 1); break;
      case "Enter":
      case " ":         e.preventDefault(); choose(options()[i]!.name); break;
      case "Escape":    e.preventDefault(); closeMenu(true);   break;
      case "Tab":       closeMenu(false);  break;   // let focus leave naturally
    }
  };

  return (
    <div
      class="fsc"
      classList={{ "fsc--shown": shown() }}
      onFocusIn={() => setFocusWithin(true)}
      onFocusOut={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <Show when={open()}>
        <div class="fsc-overlay" onClick={() => closeMenu(false)} />
        <ul ref={listRef} class="fsc-list" role="listbox" aria-label={t("floc.listbox")}
            aria-describedby="fsc-range-hdr" onKeyDown={onListKey}>
          {/* T-5.47 Layer 4 (T-5.47 revision) — the elevation-range line, now a HEADER
              ROW at the top of the EXPANDED list, directly above the dots it explains.
              role="presentation" keeps it OUT of the listbox's option semantics: it is
              not an option, not focusable, not in `options()` (so not counted and not in
              the roving-tabindex over optRefs/focusIdx), and carries no setsize/posinset.
              It is announced as the list's group-level context via the listbox's
              aria-describedby, not as a 19th station. Nothing shows when the chooser is
              collapsed. Snapshot-invisible: the harness never mounts this component. */}
          <li id="fsc-range-hdr" class="fsc-range" role="presentation">{t("today.elev_range")}</li>
          <For each={options()}>
            {(o, i) => {
              const selected = () => o.name === currentLoc();
              return (
                <li
                  ref={(el) => (optRefs[i()] = el)}
                  class="fsc-opt"
                  classList={{ "fsc-opt--sel": selected() }}
                  role="option"
                  aria-selected={selected()}
                  tabindex={focusIdx() === i() ? 0 : -1}
                  onClick={() => choose(o.name)}
                >
                  {/* T-5.47 Layer 1 — dot ONLY (no metres, no tooltip): 18 rows, no room,
                      and the band-collapse fix (Change 1) makes the four dots the sole
                      encoding here. Decorative → aria-hidden; the option's text label is
                      already its accessible name. National has no elevation → no dot. */}
                  <Show when={!o.national && o.elevation != null}>
                    <i class="fsc-dot" aria-hidden="true" style={{ background: bandColor(o.elevation!) }} />
                  </Show>
                  {o.label}
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
      {/* Resting state: a compact location-pin icon; over the hero it widens to show
          the current location label (self-describing sole control). Its accessible
          name + hover title always carry the current location, so a screen-reader
          user gets what a sighted reader sees regardless of the label's visibility. */}
      <button
        ref={triggerRef}
        type="button"
        class="fsc-trigger"
        classList={{ "fsc-trigger--wide": showLabel(), "fsc-trigger--cue": cueActive() }}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={t("floc.pick", { station: currentLabel() })}
        title={currentLabel()}
        onClick={() => (open() ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <svg class="fsc-pin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <Show when={showLabel()}>
          <span class="fsc-label">
            {/* T-5.47 Layer 1 — dot only (matches the list); no metres in the trigger. */}
            <Show when={currentElev() != null}>
              <i class="fsc-dot" aria-hidden="true" style={{ background: bandColor(currentElev()!) }} />
            </Show>
            {currentLabel()}
          </span>
        </Show>
      </button>
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

// T-4.26b — the transparent chevron <select> used inside a pill (matches the variable
// selector at RegToolbar; kept a separate const rather than reflowing the variable
// select's inline style, so that call site stays byte-identical).
const selectStyle: Record<string, string> = {
  background: "transparent", border: "none", "font-size": "12px", color: "var(--color-ink)",
  "font-family": "var(--font-sans)", cursor: "pointer", "padding-right": "16px", appearance: "none",
  "background-image": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='%236B655B'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
  "background-repeat": "no-repeat", "background-position": "right 2px center",
};

// T-4.26b — the per-window explanatory line. flex-basis:100% drops it to its own
// full-width row inside the wrapping toolbar; capped width keeps it readable.
const windowExplStyle: Record<string, string> = {
  "flex-basis":  "100%",
  width:         "100%",
  "max-width":   "660px",
  margin:        "0",
  "padding-top": "2px",
  "font-family": "var(--font-sans)",
  "font-size":   "12px",
  color:         "var(--color-ink-soft)",
  "line-height": "1.5",
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
  // T-5.60 — WRAP, don't ellipsize. These subtitles carry meaning (variable ·
  // method · window; "rdeča črta = izbrani dan"; n_years · significance), and the
  // hidden tail was exactly the non-duplicated part. `nowrap`+`overflow:hidden`+
  // `text-overflow:ellipsis` clipped the year-round header at every width and the
  // scatter stats badge / footer at 390px. Wrapping costs a line of height and
  // makes these two cards behave like every other card on the page, which already
  // wraps. Do NOT re-add nowrap: it silently conceals text (see PROGRESS T-5.60).
  "white-space":    "normal",
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
