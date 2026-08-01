import { createSignal, createResource, createEffect, createMemo, createContext, useContext,
         onMount, onCleanup, Show, Suspense, ErrorBoundary, For, lazy } from "solid-js";
import type { JSXElement } from "solid-js";
import type { SiteMeta } from "../types.ts";
import type { RegressionParams } from "../api.ts";
import { fetchRegression, fetchCalendar, varLabel as varLabelOf,
         monthDayToDoy, doyToMonthDay, MONTH_LEN } from "../api.ts";
import { sectionErrorFallback } from "./SectionError.tsx";
import { t, fmtSigned, fmtDoy, fmtMonthLong } from "../i18n/format.ts";
import { readUiPrefs, writeUiPref } from "../prefs.ts";

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

  const selLoc = () => selLocs()[0] ?? defaultLoc();
  // The single writer for the below-hero location. It also notifies the page via
  // onLocChange (→ setMapLoc), so the station map's highlight and panel title follow
  // the floating chooser, and vice-versa (a map click flows back through syncLoc).
  const setLoc = (name: string) => {
    setSelLocs([name]);
    props.onLocChange?.(name);
  };

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
  // T-5.31 family (recorded in 1a): station.name is the ASCII era5_name key,
  // station.label is the diacritic display name. Always show the label.
  const stationLabel = (name: string) => {
    const st = props.meta.stations.find(s => s.name === name);
    return (st?.label ?? name).replace(/_/g, " ");
  };
  const locLabel   = () => stationLabel(selLoc());
  const varLabel   = () => VARIABLES.find(([k]) => k === selVar())?.[1] ?? selVar();
  // T-5.27 part (3): the scatter card now names its station in the TITLE (it was only
  // in the subtitle), so a reader whose station is set by the off-screen floating
  // chooser can read the chart on its own. The day moves to the subtitle.
  const chartTitle = () => `${stationLabel(selLoc())} · ${varLabel().split("(")[0]!.trim()}`;
  const chartSub   = () => doyToLabel(doy());

  return {
    meta: props.meta,
    selLocs, setSelLocs, selLoc, setLoc, selVar, setSelVar,
    doy, setDoy,
    regData, calData, refetchReg, refetchCal,
    isPrecip, stats0, trend10, trendColor, totalChange,
    stationLabel, locLabel, varLabel, chartTitle, chartSub,
    doyToLabel, VARIABLES,
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
          <div style={panelTitleStyle}>{t("reg.year_round_title", { station: s.stationLabel(s.selLoc()) })}</div>
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
interface ChooserOpt { name: string; label: string; national: boolean; }
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
      .map(st => ({ name: st.name, label: st.label ?? st.name, national: false })),
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
        <ul ref={listRef} class="fsc-list" role="listbox" aria-label={t("floc.listbox")} onKeyDown={onListKey}>
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
          <span class="fsc-label">{currentLabel()}</span>
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
