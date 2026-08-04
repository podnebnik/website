import { Show, For, createSignal, createEffect, lazy, Suspense } from "solid-js";
import type { TodayStatus, Last7, SiteMeta, RankInfo } from "../types.ts";
import { isArsoLoc, daysInMonth } from "../api.ts";
import { todayYear } from "../clock.ts";
import { TodayFlag } from "./TodayFlag.tsx";
import { TodayGauge } from "../charts/TodayGauge.tsx";
import { t, fmtNum, fmtInt, fmtMonthDay, fmtMonthDayYear, fmtMonthLong } from "../i18n/format.ts";

const TodayLast7Chart = lazy(() => import("./TodayLast7Chart.tsx").then(m => ({ default: m.TodayLast7Chart })));

const CATEGORIES: Record<string, string> = {
  freezing: t("today.cat_freezing"),
  cold:     t("today.cat_cold"),
  nope:     t("today.cat_nope"),
  hot:      t("today.cat_hot"),
  hell:     t("today.cat_hell"),
};

// T-5.5 — category descriptions live in the catalogue (today.desc_{arso,era5}_*),
// parameterised on {d} / {record_years} / {year_min}.
// T-5.19 — the former {country} placeholder was always fed the nominative
// "Slovenija", producing the ungrammatical "v Slovenija"; the locative "v Sloveniji"
// is now baked into the two desc_*_nope strings, so no country param is passed.
function catDesc(catKey: string, r: TodayStatus): string {
  const isArso = r.loc ? isArsoLoc(r.loc) : false;
  const d = fmtDayLabel(r.day_label ?? "");
  const yearMin = r.year_min ?? 1950;
  // Fallback path only (r.year_max is present in every recorded response), but it
  // feeds {record_years} in visible copy, so it goes through the same clock.
  const yearMax = r.year_max ?? todayYear();
  return t(`today.desc_${isArso ? "arso" : "era5"}_${catKey}`, {
    d,
    year_min: yearMin,
    record_years: yearMax - yearMin + 1,
  });
}

// National/default view = unweighted mean of the ERA5 stations (D-7,
// "povprečje 18 postaj"). Count + elevation range are derived from meta rather
// than hardcoded so the sentence cannot go stale if the station set changes —
// the failure mode T-4.6 fixed (the old copy claimed ARSO data this page has
// never carried). ERA5-Land climatology, same ±7-day window as the per-station
// explain below.
function nationalExplain(stations: SiteMeta["stations"], yearMin: number): string {
  const era5 = stations.filter(s => s.source === "era5");
  const elevs = era5.map(s => s.elevation);
  const elMin = Math.min(...elevs);
  const elMax = Math.max(...elevs);
  return t("today.national_explain", {
    count: era5.length, elMin: fmtInt(elMin), elMax: fmtInt(elMax), yearMin,
  });
}

// T-5.5 — the datasette `day_label` is an internal "Mon D" key (api.ts:dayLabel);
// map its month to a number and render the Slovenian short date via the formatter,
// so no month name or date is built by hand.
const EN_MONTHS: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
};
function fmtDayLabel(dl: string): string {
  const [mon, day] = dl.split(" ");
  const m = EN_MONTHS[mon ?? ""] ?? 0;
  return m ? fmtMonthDay(m, Number(day)) : "??";
}
// The hero badge (T-5.33). Show the year ONLY when the selected date is not in the
// device-current year — then "1. avg." would silently read as today's year while the
// reader is looking at, say, 1994 data. `currentYear` is the device year (clock.ts,
// Europe/Ljubljana), threaded in as props.today's year — NOT the record end or the
// served-data end, which lag it. The year comes from Intl (fmtMonthDayYear), same
// boundary as every other date on the page (format.ts:68).
function fmtDate(dateStr: string, currentYear: number): string {
  const [yy, mm, dd] = dateStr.split("-");
  const y = Number(yy);
  return y === currentYear
    ? fmtMonthDay(Number(mm), Number(dd))
    : fmtMonthDayYear(Number(mm), Number(dd), y);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface Props {
  data:         TodayStatus;
  last7:        Last7 | undefined;
  meta:         SiteMeta;
  date:         string;
  today:        string;
  loading:      boolean;
  onDateChange: (d: string) => void;
  // T-5.35 — the hero's inline location <select> was retired; the floating chooser
  // (RegressionPanel.tsx) is now the single location control page-wide. `nationalLoc`
  // is still needed to pick the national explain copy below.
  nationalLoc?: string;  // loc key for the national series (e.g. "era5:national")
}

export function TodayCard(props: Props) {
  const r = () => props.data;
  const catKey = () => r().category_key ?? "nope";

  return (
    <div class="today-card">

      {/* ── Date + location controls — always fully visible ── */}
      <div class="today-date-control">
        <button
          class="today-nav-btn"
          aria-label={t("today.prev_day")}
          disabled={props.date <= "1950-01-01"}
          onClick={() => props.onDateChange(addDays(props.date, -1))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <HeroDatePicker date={props.date} today={props.today} onDateChange={props.onDateChange} />
        <button
          class="today-nav-btn"
          aria-label={t("today.next_day")}
          disabled={props.date >= props.today}
          onClick={() => props.onDateChange(addDays(props.date, 1))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* ── Data content — dims while loading to cover stale→fresh transition ── */}
      <Show when={r().available} fallback={<UnavailableCard />}>
        <div class="today-card-data" classList={{ "today-card-data--loading": props.loading }}>

          {/* Main row: gauge | divider | body | divider | percentile */}
          <div class="today-main-row">

            <TodayGauge data={r()} />

            <div class="today-divider" />

            <div class="today-body">
              <div class="today-text">
                <div class="today-cat-row">
                  <TodayFlag catKey={catKey()} />
                  <span class="today-cat" style={{ color: r().color }}>
                    {CATEGORIES[catKey()] ?? catKey()}
                  </span>
                  <Show when={r().rank_info}>
                    {(ri) => <RankBadge info={ri()} dayLabel={fmtDayLabel(r().day_label ?? "")} />}
                  </Show>
                </div>
                <span class="today-desc">{catDesc(catKey(), r())}</span>
              </div>
            </div>

            <div class="today-divider" />

            <div class="today-pct-wrap">
              <span class="today-pct-num">{fmtInt(r().percentile ?? 0)}</span>
              <span class="today-pct-label">{t("today.pct_label")}</span>
              <Show when={r().loc && isArsoLoc(r().loc!)}>
                <span class="today-pct-samples">{t("today.pct_samples_arso")}</span>
              </Show>
              <Show when={!r().loc || !isArsoLoc(r().loc ?? "")}>
                <Show when={(r().n_samples ?? 0) > 0}>
                  <span class="today-pct-samples">{t("today.pct_samples", { count: r().n_samples ?? 0 })}</span>
                </Show>
              </Show>
              {/* is_preliminary is true iff the value came from the live
                  Open-Meteo /v1/forecast fallback (api.ts:271,302) — an NWP
                  forecast, never ERA5T reanalysis. The old badge read
                  "ERA5T · preliminarno", mislabelling the forecast as the very
                  thing it is not (D-11 / T-4.13). Reanalysis rows carry no badge;
                  their ERA5-Land provenance is stated in the explain line below. */}
              <Show when={r().is_preliminary}>
                <span style={{
                  "font-family": "var(--font-mono)", "font-size": "10px",
                  "letter-spacing": "0.06em", "text-transform": "uppercase",
                  color: "var(--color-ink-soft)",
                  background: "var(--color-paper-2)",
                  border: "1px solid var(--color-rule)",
                  "border-radius": "4px", padding: "2px 6px",
                  "margin-top": "4px", display: "inline-block",
                }}>
                  {t("today.badge_forecast")}
                </span>
              </Show>
            </div>

          </div>

          {/* Explain */}
          <p class="today-explain">
            {r().loc
              ? r().loc === props.nationalLoc
                ? nationalExplain(props.meta.stations, r().year_min ?? 1950)
                : isArsoLoc(r().loc!)
                  ? t("today.explain_arso", { label: props.meta.stations.find(s => s.name === r().loc)?.label ?? r().loc!.replace("arso:", "") })
                  : t("today.explain_station", { station: r().loc!.replace(/_/g, " "), year_min: r().year_min ?? 1950 })
              : t("today.explain_national", { year_min: r().year_min ?? 1950 })
            }
          </p>

          {/* Climate context — collapsed by default behind a native <details>
              disclosure, reusing the methodology panel's summary treatment
              (T-5.20). Native <details>/<summary> is keyboard-operable and
              announced as expandable with no ARIA of our own; the body stays in
              the DOM (only visually collapsed), so the snapshot still sees it. */}
          <details class="today-context-details">
            <summary class="today-context-summary">{t("today.context_summary")}</summary>
            <p class="today-context">
              {t("today.context")}
            </p>
          </details>

          {/* Last 7 days */}
          <Show when={props.last7?.available && (props.last7?.days.length ?? 0) > 0}>
            <div class="today-last7-row">
              <div class="today-last7-card">
                <div class="today-chart-title">{t("today.last7_title")}</div>
                <Suspense fallback={<div style={{ height: "190px" }} class="animate-pulse bg-[var(--color-paper-2)] rounded" />}>
                  <TodayLast7Chart days={props.last7!.days} />
                </Suspense>
              </div>
            </div>
          </Show>

          {/* Footer */}
          <div class="today-foot">
            {t("today.foot", {
              temp: fmtNum(r().today_temp ?? 0, 1),
              pct: fmtInt(r().percentile ?? 0),
              suffix:
                r().loc && isArsoLoc(r().loc!)
                  ? t("today.foot_suffix_arso", { count: r().n_samples ?? 0, year_min: r().year_min ?? 0, year_max: r().year_max ?? 0 })
                  : (r().n_samples ?? 0) > 0
                    ? t("today.foot_suffix", { count: r().n_samples ?? 0, year_min: r().year_min ?? 0, year_max: r().year_max ?? 0 })
                    : "",
            })}
          </div>

        </div>
      </Show>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RankBadge(props: { info: RankInfo; dayLabel: string }) {
  const [open, setOpen] = createSignal(false);
  const isHot = () => props.info.direction === "hot";

  const label = () =>
    isHot()
      ? t("today.rank_hot", { rank: props.info.rank, d: props.dayLabel })
      : t("today.rank_cold", { rank: props.info.rank, d: props.dayLabel });

  return (
    <div class="relative">
      <button
        class={`today-rank-badge today-rank-badge--${isHot() ? "hot" : "cold"}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label()}
      </button>

      <Show when={open()}>
        <div class="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div class="absolute top-full mt-2 left-0 z-20 bg-[var(--color-card)] border border-[var(--color-rule)] rounded-xl shadow-lg p-4 min-w-[220px]">
          <div class="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-soft)] mb-3">
            {isHot() ? t("today.rank_top5_hot", { d: props.dayLabel }) : t("today.rank_top5_cold", { d: props.dayLabel })}
          </div>
          <div class="space-y-2">
            <For each={props.info.top5}>
              {(entry) => (
                <div
                  class="flex justify-between items-center text-sm gap-4"
                  classList={{ "font-semibold": !!entry.is_today }}
                >
                  <span class={entry.is_today ? "text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"}>
                    {entry.date.slice(0, 4)}
                    <Show when={entry.is_today}>
                      {" "}
                      <span class="text-[10px] font-normal text-[var(--color-accent)]">{t("common.today")}</span>
                    </Show>
                  </span>
                  <span class="font-mono text-[var(--color-ink)]">{t("common.temp_c", { temp: fmtNum(entry.temp, 1) })}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ── Hero date picker (T-5.32) ───────────────────────────────────────────────────
// A calendar popover on the hero date badge. UNLIKE the yearless DOY picker (RegToolbar,
// T-5.28) this selects a real dated day, so it carries a YEAR row and year-aware month
// lengths — 29 February appears only in leap years, via daysInMonth (api.ts). Bounds are
// the record: 1950-01-01 to device-"today" (props.today). The ~6 reanalysis-gap days at
// the tail are WITHIN bounds and deliberately NOT disabled — selecting one is the default
// view's normal state (the Open-Meteo forecast path with the "napoved" badge, D-24), not
// an error to hide. Split from the DOY picker on purpose (state type, bounds, month-wrap
// and leap handling all differ); it reuses the .reg-cal-* CSS and the fmtMonthLong month
// names, so no content has a second source of truth (D-18 / T-5.26). Popover is closed by
// default → adds no rendered text. The badge text (fmtDate) now appends the year for a
// non-current-year date (T-5.33), so the snapshot leaf (r.txt(".today-date-badge")) moves
// for any case pinned outside the device-current year — text only, no number.
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function isoOf(y: number, m: number, d: number): string { return `${y}-${pad2(m)}-${pad2(d)}`; }

function HeroDatePicker(props: { date: string; today: string; onDateChange: (d: string) => void }) {
  const [calOpen,    setCalOpen]    = createSignal(false);
  const [calYear,    setCalYear]    = createSignal(1950);
  const [calMonth,   setCalMonth]   = createSignal(1);   // 1..12 shown in the grid
  const [focusedDay, setFocusedDay] = createSignal(1);   // roving-tabindex day
  let triggerRef: HTMLDivElement | undefined;
  const dayRefs: (HTMLButtonElement | undefined)[] = [];

  const maxYear  = () => Number(props.today.slice(0, 4));
  const maxMonth = () => Number(props.today.slice(5, 7));
  const maxDay   = () => Number(props.today.slice(8, 10));

  const monthLen = () => daysInMonth(calYear(), calMonth());
  // Last selectable day of the viewed month: its length, except the record-end month,
  // which stops at device-today. (No lower cut: the min is 1950-01-01, and month nav is
  // bounded to >= 1950-01 below, so no day in a viewable month falls before the min.)
  const lastDay = () =>
    calYear() === maxYear() && calMonth() === maxMonth()
      ? Math.min(maxDay(), monthLen())
      : monthLen();
  const dayDisabled = (day: number) => isoOf(calYear(), calMonth(), day) > props.today;

  const clampFocus = () => setFocusedDay(d => Math.min(Math.max(1, d), lastDay()));

  const atFirstMonth = () => calYear() <= 1950 && calMonth() <= 1;
  const atLastMonth  = () => calYear() >= maxYear() && calMonth() >= maxMonth();
  const atFirstYear  = () => calYear() <= 1950;
  const atLastYear   = () => calYear() >= maxYear();

  const openCal = () => {
    setCalYear(Number(props.date.slice(0, 4)));
    setCalMonth(Number(props.date.slice(5, 7)));
    setFocusedDay(Number(props.date.slice(8, 10)));
    setCalOpen(true);
  };
  const closeCal = (returnFocus: boolean) => {
    setCalOpen(false);
    if (returnFocus) triggerRef?.focus();
  };
  const selectDay = (day: number) => {
    props.onDateChange(isoOf(calYear(), calMonth(), day));
    closeCal(true);
  };
  const stepMonth = (delta: number) => {
    let y = calYear();
    let m = calMonth() + delta;
    if (m < 1)  { m = 12; y -= 1; }
    if (m > 12) { m = 1;  y += 1; }
    if (y < 1950) { y = 1950; m = 1; }                                   // clamp to record start
    if (y > maxYear() || (y === maxYear() && m > maxMonth())) { y = maxYear(); m = maxMonth(); }  // to record end
    setCalYear(y); setCalMonth(m); clampFocus();
  };
  const stepYear = (delta: number) => {
    let y = Math.min(maxYear(), Math.max(1950, calYear() + delta));
    let m = calMonth();
    if (y === maxYear() && m > maxMonth()) m = maxMonth();
    setCalYear(y); setCalMonth(m); clampFocus();
  };

  // Move DOM focus to the roving day button when the target day or open-state changes.
  // Month/year nav that leaves focusedDay unchanged keeps focus naturally — Solid's <For>
  // reuses the day button (same primitive key), so the focused element survives the
  // re-render; only a clamp (shorter month) changes focusedDay and re-runs this. Mirrors
  // the verified T-5.28 approach.
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
    const last = lastDay();
    const d = focusedDay();
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); setFocusedDay(Math.min(last, d + 1)); break;
      case "ArrowLeft":  e.preventDefault(); setFocusedDay(Math.max(1, d - 1));    break;
      case "ArrowDown":  e.preventDefault(); setFocusedDay(Math.min(last, d + 7)); break;
      case "ArrowUp":    e.preventDefault(); setFocusedDay(Math.max(1, d - 7));    break;
      case "Home":       e.preventDefault(); setFocusedDay(1);    break;
      case "End":        e.preventDefault(); setFocusedDay(last); break;
      // PageUp/Down step the month; with Shift they step the year (big jumps without a
      // 76-option dropdown).
      case "PageUp":     e.preventDefault(); e.shiftKey ? stepYear(-1) : stepMonth(-1); break;
      case "PageDown":   e.preventDefault(); e.shiftKey ? stepYear(1)  : stepMonth(1);  break;
      case "Enter":
      case " ":          e.preventDefault(); selectDay(focusedDay()); break;
      case "Escape":     e.preventDefault(); closeCal(true); break;
    }
  };

  return (
    <div class="today-date-badge-wrap">
      <div
        ref={triggerRef}
        class="today-date-badge"
        role="button"
        tabindex="0"
        aria-haspopup="dialog"
        aria-expanded={calOpen()}
        aria-label={t("today.pick_date")}
        onClick={() => (calOpen() ? closeCal(false) : openCal())}
        onKeyDown={onTriggerKey}
      >
        {fmtDate(props.date, maxYear())}
      </div>
      <Show when={calOpen()}>
        <div
          class="reg-cal-pop"
          role="dialog"
          aria-label={t("today.cal_dialog")}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeCal(true); } }}
        >
          {/* Year row — the substance of this ticket: reaching a distant year without
              hundreds of ‹ clicks. */}
          <div class="reg-cal-head">
            <button type="button" class="reg-cal-nav" aria-label={t("today.cal_prev_year")} disabled={atFirstYear()} onClick={() => stepYear(-1)}>◀</button>
            <span class="reg-cal-title">{calYear()}</span>
            <button type="button" class="reg-cal-nav" aria-label={t("today.cal_next_year")} disabled={atLastYear()} onClick={() => stepYear(1)}>▶</button>
          </div>
          {/* Month row */}
          <div class="reg-cal-head">
            <button type="button" class="reg-cal-nav" aria-label={t("today.cal_prev_month")} disabled={atFirstMonth()} onClick={() => stepMonth(-1)}>◀</button>
            <span class="reg-cal-title">{fmtMonthLong(calMonth())}</span>
            <button type="button" class="reg-cal-nav" aria-label={t("today.cal_next_month")} disabled={atLastMonth()} onClick={() => stepMonth(1)}>▶</button>
          </div>
          <div class="reg-cal-grid" onKeyDown={onGridKey}>
            <For each={Array.from({ length: monthLen() }, (_, i) => i + 1)}>
              {(day) => {
                const selected = () =>
                  Number(props.date.slice(0, 4)) === calYear() &&
                  Number(props.date.slice(5, 7)) === calMonth() &&
                  Number(props.date.slice(8, 10)) === day;
                return (
                  <button
                    type="button"
                    ref={(el) => (dayRefs[day] = el)}
                    class="reg-cal-day"
                    // Full dated label (day, month name, year) — Intl month name, raw
                    // year (NO thousands grouping: "1994", never "1.994").
                    aria-label={`${day}. ${fmtMonthLong(calMonth())} ${calYear()}`}
                    aria-pressed={selected()}
                    disabled={dayDisabled(day)}
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
  );
}

function UnavailableCard() {
  return (
    <div class="today-card">
      <p role="status" class="today-explain">{t("today.unavailable")}</p>
    </div>
  );
}
