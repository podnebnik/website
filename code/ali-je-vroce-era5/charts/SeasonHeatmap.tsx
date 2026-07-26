import { createSignal, createMemo, For, Show, onCleanup } from "solid-js";
import type { SeasonHeatmapRow } from "../types.ts";

const SEASON_ORDER = ["Autumn", "Summer", "Spring", "Winter"] as const;
type Season = typeof SEASON_ORDER[number];

const SEASON_LABEL: Record<Season, string> = {
  Autumn: "Jesen", Summer: "Poletje", Spring: "Pomlad", Winter: "Zima",
};

const CAT_LABELS: Record<string, string> = {
  cold:    "Hladno (<10. pct)",
  cool:    "Sveže (10–20. pct)",
  normal:  "Normalno (20–80. pct)",
  hot:     "Vroče (80–95. pct)",
  extreme: "Ekstremno (>95. pct)",
};

const CAT_COLORS: Record<string, string> = {
  cold: "#3a5a8a", cool: "#6c8fb6", normal: "#e7d9b8", hot: "#c25a2c", extreme: "#962c1a",
};

const MODES = [
  { key: "all",      label: "Vse letne čase" },
  { key: "extremes", label: "Samo ekstremi" },
  { key: "Autumn",   label: "Jesen" },
  { key: "Summer",   label: "Poletje" },
  { key: "Spring",   label: "Pomlad" },
  { key: "Winter",   label: "Zima" },
];

// T-5.4a — visually-hidden (screen-reader-only) style. Kept off the visual layout
// entirely, so it changes nothing a sighted reader sees. Kebab-case keys because
// Solid's style() calls setProperty() and silently drops camelCase.
const SR_ONLY = {
  position: "absolute", width: "1px", height: "1px", padding: "0",
  margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)",
  "white-space": "nowrap", border: "0",
} as const;

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
    return `Toplotna karta letnih časov po letih od ${ys[0]} do ${ys[ys.length - 1]}: vsak stolpec je eno leto, vsaka vrstica en letni čas, barva pa uvršča povprečno najvišjo temperaturo od hladne do ekstremne glede na referenčno obdobje. Celotni podatki so v tabeli pod grafom.`;
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
      { n: ext,          lbl: "Ekstremne sezone" },
      { n: cold,         lbl: "Hladne sezone" },
      { n: extSince2010, lbl: "Ekstremne od 2010" },
      { n: hotRecent,    lbl: `Vroče ali ekstremne (${recentFrom}–${ym})` },
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
          {animating() ? "⏹ Ustavi" : "▶ Animacija"}
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
        {(td) => (
          <div
            class="shm-tip"
            style={{
              left: `${Math.min(td().px + 16, window.innerWidth - 220)}px`,
              top:  `${Math.max(8, td().py - 52)}px`,
            }}
          >
            <strong>{td().row.season} {td().row.y}</strong>
            <div class="shm-tip-row">
              <span class="shm-tip-sw" style={{ background: td().row.color }} />
              {CAT_LABELS[td().row.cat]}
            </div>
            Povprečni maks: <b>{td().row.avg.toFixed(1)} °C</b><br />
            {td().row.rank}. najtoplejša {SEASON_LABEL[td().row.season as Season] ?? td().row.season} od {td().row.total} let
          </div>
        )}
      </Show>

      {/* T-5.4a — screen-reader data-table fallback (visually hidden). Slovenian
          caption/headers awaiting operator review. */}
      <table style={SR_ONLY}>
        <caption>Podatki toplotne karte letnih časov po letih</caption>
        <thead>
          <tr>
            <th scope="col">Letni čas</th>
            <th scope="col">Leto</th>
            <th scope="col">Kategorija</th>
            <th scope="col">Povprečni maksimum (°C)</th>
            <th scope="col">Uvrstitev</th>
          </tr>
        </thead>
        <tbody>
          <For each={tableRows()}>
            {(r) => (
              <tr>
                <td>{SEASON_LABEL[r.season as Season] ?? r.season}</td>
                <td>{r.y}</td>
                <td>{CAT_LABELS[r.cat] ?? r.cat}</td>
                <td>{r.avg.toFixed(1)}</td>
                <td>{r.rank}. od {r.total}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
