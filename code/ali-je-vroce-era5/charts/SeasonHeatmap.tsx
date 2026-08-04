import { createSignal, createMemo, For, Show, onCleanup } from "solid-js";
import type { SeasonHeatmapRow } from "../types.ts";
import { t, fmtNum } from "../i18n/format.ts";
import { SR_ONLY } from "./sr-only.ts";

const SEASON_ORDER = ["Autumn", "Summer", "Spring", "Winter"] as const;
type Season = typeof SEASON_ORDER[number];

const SEASON_LABEL: Record<Season, string> = {
  Autumn: t("season.label_Autumn"), Summer: t("season.label_Summer"),
  Spring: t("season.label_Spring"), Winter: t("season.label_Winter"),
};

const CAT_LABELS: Record<string, string> = {
  cold:    t("season.cat_cold"),
  cool:    t("season.cat_cool"),
  normal:  t("season.cat_normal"),
  hot:     t("season.cat_hot"),
  extreme: t("season.cat_extreme"),
};

const CAT_COLORS: Record<string, string> = {
  cold: "#3a5a8a", cool: "#6c8fb6", normal: "#e7d9b8", hot: "#c25a2c", extreme: "#962c1a",
};

const MODES = [
  { key: "all",      label: t("season.mode_all") },
  { key: "extremes", label: t("season.mode_extremes") },
  { key: "Autumn",   label: t("season.label_Autumn") },
  { key: "Summer",   label: t("season.label_Summer") },
  { key: "Spring",   label: t("season.label_Spring") },
  { key: "Winter",   label: t("season.label_Winter") },
];

interface Props { data: SeasonHeatmapRow[]; }
interface TipData { row: SeasonHeatmapRow; px: number; py: number; }

export function SeasonHeatmap(props: Props) {
  const [mode, setMode]                     = createSignal("all");
  const [animating, setAnimating]           = createSignal(false);
  const [revealedYears, setRevealedYears]   = createSignal<Set<number>>(
    new Set(props.data.map(r => r.y))
  );
  const [tipData, setTipData] = createSignal<TipData | null>(null);

  let animRef   = false;
  let animYear  = 0;
  let animTimer: ReturnType<typeof setTimeout> | null = null;
  onCleanup(() => { animRef = false; if (animTimer) clearTimeout(animTimer); });

  const allYears = createMemo((): number[] => {
    const ys = props.data.map(r => r.y);
    const min = Math.min(...ys), max = Math.max(...ys);
    const out: number[] = [];
    for (let y = min; y <= max; y++) out.push(y);
    return out;
  });

  const yearMax = createMemo(() => Math.max(...props.data.map(r => r.y)));

  const lookup = createMemo((): Record<string, Record<number, SeasonHeatmapRow>> => {
    const m: Record<string, Record<number, SeasonHeatmapRow>> = {};
    for (const row of props.data) {
      // support both season-string and x-indexed layouts
      const key = row.season ?? (["Winter","Spring","Summer","Autumn"][row.x] as string);
      if (!m[key]) m[key] = {};
      m[key][row.y] = row;
    }
    return m;
  });

  const decadeTicks = createMemo(() => allYears().filter(y => y % 10 === 0));

  // T-5.4a — the same data the colour grid encodes, in a form assistive tech can
  // read: one row per (season, year). Sorted season-then-year for stable reading.
  const tableRows = createMemo(() =>
    [...props.data].sort((a, b) =>
      a.season === b.season ? a.y - b.y : a.season.localeCompare(b.season))
  );
  const gridLabel = createMemo(() => {
    const ys = allYears();
    return t("season.grid_a11y", { from: ys[0] ?? 0, to: ys[ys.length - 1] ?? 0 });
  });

  function cellClass(season: string, cat: string, year: number): string {
    if (!revealedYears().has(year)) return "shm-cell shm-cell--dim";
    const m = mode();
    if (m === "all")      return "shm-cell";
    if (m === "extremes") return "shm-cell " + (cat === "extreme" ? "shm-cell--pulse" : "shm-cell--dim");
    return "shm-cell " + (season === m ? "shm-cell--hl" : "shm-cell--dim");
  }

  const stats = createMemo(() => {
    let ext = 0, cold = 0, extSince2010 = 0, hotRecent = 0;
    const ym = yearMax();
    const recentFrom = ym - 9;
    const lup = lookup();
    for (const y of revealedYears()) {
      for (const s of SEASON_ORDER) {
        const p = lup[s]?.[y];
        if (!p) continue;
        if (p.cat === "extreme")                                   ext++;
        if (p.cat === "cold")                                      cold++;
        if (p.cat === "extreme" && y >= 2010)                      extSince2010++;
        if ((p.cat === "extreme" || p.cat === "hot") && y >= recentFrom) hotRecent++;
      }
    }
    return [
      { n: ext,          lbl: t("season.stat_extreme") },
      { n: cold,         lbl: t("season.stat_cold") },
      { n: extSince2010, lbl: t("season.stat_extreme_since") },
      { n: hotRecent,    lbl: t("season.stat_hot_recent", { from: recentFrom, to: ym }) },
    ];
  });

  function startAnimate() {
    animRef = true;
    animYear = allYears()[0] ?? 1950;
    setAnimating(true);
    setRevealedYears(new Set<number>());
    step();
  }
  function step() {
    if (!animRef) return;
    setRevealedYears(prev => { const s = new Set(prev); s.add(animYear); return s; });
    if (animYear >= yearMax()) { stopAnimate(); return; }
    animYear++;
    const delay = animYear > 2005 ? 55 : animYear > 1985 ? 80 : 110;
    animTimer = setTimeout(step, delay);
  }
  function stopAnimate() {
    animRef = false;
    if (animTimer) clearTimeout(animTimer);
    setAnimating(false);
    setRevealedYears(new Set(allYears()));
  }

  return (
    <div>
      {/* Controls */}
      <div class="shm-controls">
        <For each={MODES}>
          {(m) => (
            <button
              class={"shm-btn" + (mode() === m.key ? " shm-btn--active" : "")}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          )}
        </For>
        <button class="shm-btn shm-btn--anim" onClick={() => animating() ? stopAnimate() : startAnimate()}>
          {animating() ? t("season.anim_stop") : t("season.anim_play")}
        </button>
      </div>

      {/* Grid — decorative colour encoding; announced as one labelled image so a
          screen reader gets the summary and skips the unlabeled cells. The numbers
          live in the visually-hidden table below (T-5.4a). */}
      <div class="reg-card wide-item" style={{ "padding": "14px 20px 12px" }}>
      <div class="shm-grid" role="img" aria-label={gridLabel()}>
        <For each={SEASON_ORDER}>
          {(season) => (
            <>
              <div class="shm-season-lbl">{SEASON_LABEL[season]}</div>
              <div class="shm-row">
                <For each={allYears()}>
                  {(year) => {
                    const row = () => lookup()[season]?.[year];
                    return (
                      <Show when={row()} fallback={<div class="shm-cell shm-cell--empty" />}>
                        {(r) => (
                          <div
                            class={cellClass(season, r().cat, year)}
                            style={{ background: r().color }}
                            onMouseEnter={(e) => setTipData({ row: r(), px: e.clientX, py: e.clientY })}
                            onMouseMove={(e) => setTipData(prev => prev ? { ...prev, px: e.clientX, py: e.clientY } : null)}
                            onMouseLeave={() => setTipData(null)}
                          />
                        )}
                      </Show>
                    );
                  }}
                </For>
              </div>
            </>
          )}
        </For>
      </div>

      {/* Year axis */}
      <div class="shm-year-axis">
        <div class="shm-lbl-spacer" />
        <div class="shm-year-ticks">
          <For each={decadeTicks()}>
            {(yr) => {
              const ys = allYears();
              const pct = (ys.indexOf(yr) / ys.length) * 100;
              return <span class="shm-tick" style={{ left: `${pct}%` }}>{yr}</span>;
            }}
          </For>
        </div>
      </div>

      {/* Legend */}
      <div class="shm-legend">
        <For each={Object.entries(CAT_COLORS)}>
          {([cat, color]) => (
            <span class="shm-leg-item">
              <span
                class="shm-leg-sw"
                style={{ background: color, border: cat === "normal" ? "1px solid var(--color-rule-2)" : "none" }}
              />
              {CAT_LABELS[cat]}
            </span>
          )}
        </For>
      </div>
      </div>

      {/* Stats */}
      <div class="shm-stats">
        <For each={stats()}>
          {(s) => (
            <div class="shm-stat">
              <div class="shm-stat-num">{s.n}</div>
              <div class="shm-stat-lbl">{s.lbl}</div>
            </div>
          )}
        </For>
      </div>

      {/* Floating tooltip */}
      <Show when={tipData()}>
        {(td) => (
          <div
            class="shm-tip"
            style={{
              left: `${Math.min(td().px + 16, window.innerWidth - 220)}px`,
              top:  `${Math.max(8, td().py - 52)}px`,
            }}
          >
            <strong>{SEASON_LABEL[td().row.season as Season] ?? td().row.season} {td().row.y}</strong>
            <div class="shm-tip-row">
              <span class="shm-tip-sw" style={{ background: td().row.color }} />
              {CAT_LABELS[td().row.cat]}
            </div>
            {t("season.tooltip_avg_label")} <b>{t("common.temp_c", { temp: fmtNum(td().row.avg, 1) })}</b><br />
            {t("season.tooltip_rank", { rank: td().row.rank, season: SEASON_LABEL[td().row.season as Season] ?? td().row.season, count: td().row.total })}
          </div>
        )}
      </Show>

      {/* T-5.4a — screen-reader data-table fallback (visually hidden). Slovenian
          caption/headers awaiting operator review. SR_ONLY sits on the wrapping
          <div>, not the <table>: a table ignores the 1px clamp and would extend
          the page's scroll height past the footer (T-5.41). */}
      <div style={SR_ONLY}>
      <table>
        <caption>{t("season.table_caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("season.th_season")}</th>
            <th scope="col">{t("season.th_year")}</th>
            <th scope="col">{t("season.th_category")}</th>
            <th scope="col">{t("season.th_avg")}</th>
            <th scope="col">{t("season.th_rank")}</th>
          </tr>
        </thead>
        <tbody>
          <For each={tableRows()}>
            {(r) => (
              <tr>
                <td>{SEASON_LABEL[r.season as Season] ?? r.season}</td>
                <td>{r.y}</td>
                <td>{CAT_LABELS[r.cat] ?? r.cat}</td>
                <td>{fmtNum(r.avg, 1)}</td>
                <td>{t("season.rank_of", { rank: r.rank, total: r.total })}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      </div>
    </div>
  );
}
