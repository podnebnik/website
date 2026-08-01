import { createSignal, createMemo, For, Show, onCleanup } from "solid-js";
import { t, fmtNum, fmtSigned } from "../i18n/format.ts";

const SEASON_ORDER = ["Autumn", "Summer", "Spring", "Winter"] as const;
type Season = typeof SEASON_ORDER[number];

const SEASON_LABEL: Record<Season, string> = {
  Autumn: t("spei.label_Autumn"), Summer: t("spei.label_Summer"),
  Spring: t("spei.label_Spring"), Winter: t("spei.label_Winter"),
};

const CAT_LABELS: Record<string, string> = {
  extreme_dry: t("spei.cat_extreme_dry"),
  dry:         t("spei.cat_dry"),
  normal:      t("spei.cat_normal"),
  wet:         t("spei.cat_wet"),
  extreme_wet: t("spei.cat_extreme_wet"),
};

const CAT_COLORS: Record<string, string> = {
  extreme_dry: "#8b3a0f",
  dry:         "#c2713a",
  normal:      "#e7e0d0",
  wet:         "#4a80b0",
  extreme_wet: "#1e4d78",
};

const MODES = [
  { key: "all",      label: t("spei.mode_all") },
  { key: "extremes", label: t("spei.mode_extremes") },
  { key: "Autumn",   label: t("spei.label_Autumn") },
  { key: "Summer",   label: t("spei.label_Summer") },
  { key: "Spring",   label: t("spei.label_Spring") },
  { key: "Winter",   label: t("spei.label_Winter") },
];

// T-5.4a — visually-hidden (screen-reader-only) style. Kebab-case keys because
// Solid's style() calls setProperty() and silently drops camelCase.
const SR_ONLY = {
  position: "absolute", width: "1px", height: "1px", padding: "0",
  margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)",
  "white-space": "nowrap", border: "0",
} as const;

interface SpeiRow {
  season:  string;
  y:       number;
  spei:    number;
  cat:     string;
  color:   string;
  balance: number;
  n_days:  number;
  rank:    number;
  total:   number;
}

export interface SpeiData {
  available: boolean;
  data:      SpeiRow[];
  year_min:  number;
  year_max:  number;
  baseline:  string | null;
  era5_last: string;
}

// T-5.38 — `label` names the section's location. This heatmap is GENUINELY national
// (the `spei` table has no per-station dimension), so with the chooser now setting a
// station for the sibling sections it must say so in the graph zone, like the other
// sections do (Era5SeasonHeatmap.tsx). Rendered exactly as there (.era5-chart-loc).
export interface SpeiHeatmapProps { data: SpeiData; label?: string | undefined; }
interface TipData { row: SpeiRow; px: number; py: number; }

export function SpeiHeatmap(props: SpeiHeatmapProps) {
  const [mode, setMode]                     = createSignal("all");
  const [animating, setAnimating]           = createSignal(false);
  const [revealedYears, setRevealedYears]   = createSignal<Set<number>>(
    new Set(props.data.data.map(r => r.y))
  );
  const [tipData, setTipData] = createSignal<TipData | null>(null);

  let animRef   = false;
  let animYear  = 0;
  let animTimer: ReturnType<typeof setTimeout> | null = null;
  onCleanup(() => { animRef = false; if (animTimer) clearTimeout(animTimer); });

  const allYears = createMemo((): number[] => {
    const out: number[] = [];
    for (let y = props.data.year_min; y <= props.data.year_max; y++) out.push(y);
    return out;
  });

  const lookup = createMemo((): Record<string, Record<number, SpeiRow>> => {
    const m: Record<string, Record<number, SpeiRow>> = {};
    for (const row of props.data.data) {
      // Bind the inner map to a local: assigning through `m[row.season]` twice
      // does not narrow the second lookup, and re-reading it would.
      const bySeason = m[row.season] ?? (m[row.season] = {});
      bySeason[row.y] = row;
    }
    return m;
  });

  const decadeTicks = createMemo(() => allYears().filter(y => y % 10 === 0));

  // T-5.4a — the same data the colour grid encodes, in a form assistive tech can
  // read: one row per (season, year). Sorted season-then-year for stable reading.
  const tableRows = createMemo(() =>
    [...props.data.data].sort((a, b) =>
      a.season === b.season ? a.y - b.y : a.season.localeCompare(b.season))
  );
  const gridLabel = createMemo(() =>
    t("spei.grid_a11y", { from: props.data.year_min, to: props.data.year_max })
  );

  function isExtreme(cat: string) { return cat === "extreme_dry" || cat === "extreme_wet"; }

  function cellClass(season: string, cat: string, year: number): string {
    if (!revealedYears().has(year)) return "shm-cell shm-cell--dim";
    const m = mode();
    if (m === "all")      return "shm-cell";
    if (m === "extremes") return "shm-cell " + (isExtreme(cat) ? "shm-cell--pulse" : "shm-cell--dim");
    return "shm-cell " + (season === m ? "shm-cell--hl" : "shm-cell--dim");
  }

  const stats = createMemo(() => {
    let extDry = 0, extWet = 0, extDrySince2000 = 0, dryRecent = 0;
    const ym = props.data.year_max;
    const recentFrom = ym - 9;
    const lup = lookup();
    for (const y of revealedYears()) {
      for (const s of SEASON_ORDER) {
        const p = lup[s]?.[y];
        if (!p) continue;
        if (p.cat === "extreme_dry")                             extDry++;
        if (p.cat === "extreme_wet")                             extWet++;
        if (p.cat === "extreme_dry" && y >= 2000)                extDrySince2000++;
        if ((p.cat === "extreme_dry" || p.cat === "dry") && y >= recentFrom) dryRecent++;
      }
    }
    return [
      { n: extDry,          lbl: t("spei.stat_extreme_dry") },
      { n: extWet,          lbl: t("spei.stat_extreme_wet") },
      { n: extDrySince2000, lbl: t("spei.stat_extreme_dry_since") },
      { n: dryRecent,       lbl: t("spei.stat_dry_recent", { from: recentFrom, to: ym }) },
    ];
  });

  function startAnimate() {
    animRef = true;
    animYear = props.data.year_min;
    setAnimating(true);
    setRevealedYears(new Set<number>());
    step();
  }
  function step() {
    if (!animRef) return;
    setRevealedYears(prev => { const s = new Set(prev); s.add(animYear); return s; });
    if (animYear >= props.data.year_max) { stopAnimate(); return; }
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
      {/* T-5.38 — name the location, as the other below-hero sections do. This one is
          national and stays so; the label discloses that (D-7 canonical wording). */}
      <Show when={props.label}>
        <div class="era5-chart-loc">{props.label}</div>
      </Show>
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
          {animating() ? t("spei.anim_stop") : t("spei.anim_play")}
        </button>
      </div>

      {/* Grid — decorative colour encoding; announced as one labelled image so a
          screen reader gets the summary and skips the unlabeled cells. The numbers
          live in the visually-hidden table below (T-5.4a). */}
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
        {(td) => {
          return (
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
                {CAT_LABELS[td().row.cat] ?? td().row.cat}
              </div>
              {t("spei.tooltip_spei")}<b>{fmtSigned(td().row.spei, 2)}</b><br />
              {t("spei.tooltip_balance")}<b>{fmtNum(td().row.balance, 0)}{t("spei.tooltip_balance_unit")}</b><br />
              {t("spei.tooltip_rank", { rank: td().row.rank, season: SEASON_LABEL[td().row.season as Season] ?? td().row.season, count: td().row.total })}
            </div>
          );
        }}
      </Show>

      {/* T-5.4a — screen-reader data-table fallback (visually hidden). Slovenian
          caption/headers awaiting operator review. */}
      <table style={SR_ONLY}>
        <caption>{t("spei.table_caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("spei.th_season")}</th>
            <th scope="col">{t("spei.th_year")}</th>
            <th scope="col">{t("spei.th_category")}</th>
            <th scope="col">{t("spei.th_spei")}</th>
            <th scope="col">{t("spei.th_balance")}</th>
            <th scope="col">{t("spei.th_rank")}</th>
          </tr>
        </thead>
        <tbody>
          <For each={tableRows()}>
            {(r) => (
              <tr>
                <td>{SEASON_LABEL[r.season as Season] ?? r.season}</td>
                <td>{r.y}</td>
                <td>{CAT_LABELS[r.cat] ?? r.cat}</td>
                <td>{fmtSigned(r.spei, 2)}</td>
                <td>{fmtNum(r.balance, 0)}</td>
                <td>{t("spei.rank_of", { rank: r.rank, total: r.total })}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
