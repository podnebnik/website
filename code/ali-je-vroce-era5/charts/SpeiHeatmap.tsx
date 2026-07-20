import { createSignal, createMemo, For, Show, onCleanup } from "solid-js";

const SEASON_ORDER = ["Autumn", "Summer", "Spring", "Winter"] as const;
type Season = typeof SEASON_ORDER[number];

const SEASON_LABEL: Record<Season, string> = {
  Autumn: "Jesen", Summer: "Poletje", Spring: "Pomlad", Winter: "Zima",
};

const CAT_LABELS: Record<string, string> = {
  extreme_dry: "Huda suša (SPEI < −1,5)",
  dry:         "Suho (SPEI −1,5 do −1,0)",
  normal:      "Normalno (SPEI −1,0 do 1,0)",
  wet:         "Mokro (SPEI 1,0 do 1,5)",
  extreme_wet: "Zelo mokro (SPEI > 1,5)",
};

const CAT_COLORS: Record<string, string> = {
  extreme_dry: "#8b3a0f",
  dry:         "#c2713a",
  normal:      "#e7e0d0",
  wet:         "#4a80b0",
  extreme_wet: "#1e4d78",
};

const MODES = [
  { key: "all",      label: "Vse letne čase" },
  { key: "extremes", label: "Samo ekstremi" },
  { key: "Autumn",   label: "Jesen" },
  { key: "Summer",   label: "Poletje" },
  { key: "Spring",   label: "Pomlad" },
  { key: "Winter",   label: "Zima" },
];

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

export interface SpeiHeatmapProps { data: SpeiData; }
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
      if (!m[row.season]) m[row.season] = {};
      m[row.season][row.y] = row;
    }
    return m;
  });

  const decadeTicks = createMemo(() => allYears().filter(y => y % 10 === 0));

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
      { n: extDry,          lbl: "Sezone hude suše (SPEI < −1,5)" },
      { n: extWet,          lbl: "Izjemno mokre sezone (SPEI > 1,5)" },
      { n: extDrySince2000, lbl: "Sezone hude suše od 2000" },
      { n: dryRecent,       lbl: `Suho ali suša (${recentFrom}–${ym})` },
    ];
  });

  function startAnimate() {
    animRef = true;
    animYear = props.data.year_min;
    setAnimating(true);
    setRevealedYears(new Set());
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

      {/* Grid */}
      <div class="shm-grid">
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
          const speiSign = td().row.spei >= 0 ? "+" : "";
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
              SPEI: <b>{speiSign}{td().row.spei.toFixed(2)}</b><br />
              Vodni bilans: <b>{td().row.balance.toFixed(0)} mm P−ET₀</b><br />
              {td().row.rank}. najsušnejša {SEASON_LABEL[td().row.season as Season] ?? td().row.season} od {td().row.total} let
            </div>
          );
        }}
      </Show>
    </div>
  );
}
