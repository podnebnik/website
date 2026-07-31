import { Show, For, createSignal, lazy, Suspense } from "solid-js";
import type { TodayStatus, Last7, SiteMeta, RankInfo } from "../types.ts";
import { isArsoLoc } from "../api.ts";
import { todayYear } from "../clock.ts";
import { TodayFlag } from "./TodayFlag.tsx";
import { TodayGauge } from "../charts/TodayGauge.tsx";
import { t, fmtNum, fmtInt, fmtMonthDay } from "../i18n/format.ts";

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
function fmtDate(dateStr: string): string {
  const [, mm, dd] = dateStr.split("-");
  return fmtMonthDay(Number(mm), Number(dd));
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
  onLocChange:  (v: string) => void;
  nationalLoc?: string;  // loc key for the "Slovenija" option (e.g. "arso:national")
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
        <div class="today-date-badge">{fmtDate(props.date)}</div>
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
        <select
          class="today-loc-select"
          value={r().loc === props.nationalLoc ? (props.nationalLoc ?? "") : r().loc ?? ""}
          onChange={(e) => props.onLocChange(e.currentTarget.value)}
        >
          <option value={props.nationalLoc ?? ""}>{t("today.loc_national", { count: props.meta.stations.filter(s => s.source === "era5").length })}</option>
          <Show when={props.meta.stations.some(s => s.source === "arso")}>
            <optgroup label={t("today.arso_group")}>
              <For each={props.meta.stations.filter(s => s.source === "arso")}>
                {(s) => <option value={s.name}>{s.label}</option>}
              </For>
            </optgroup>
          </Show>
          <Show when={props.meta.stations.some(s => s.source === "era5")}>
            <optgroup label={t("today.era5_group")}>
              <For each={props.meta.stations.filter(s => s.source === "era5")}>
                {(s) => <option value={s.name}>{s.label ?? s.name}</option>}
              </For>
            </optgroup>
          </Show>
        </select>
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
                  "font-family": "var(--font-mono)", "font-size": "9px",
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

          {/* Climate context */}
          <p class="today-context">
            {t("today.context")}
          </p>

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

function UnavailableCard() {
  return (
    <div class="today-card">
      <p role="status" class="today-explain">{t("today.unavailable")}</p>
    </div>
  );
}
