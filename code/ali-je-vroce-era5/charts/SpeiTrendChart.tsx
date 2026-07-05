import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpeiTrend {
  slope_per_decade: number;
  p_value:          number;
  mk_trend:         string;
  intercept:        number;
}

interface SpeiSeries {
  years: number[];
  spei:  number[];
  trend: SpeiTrend | Record<string, never>;
}

export interface SpeiStationData {
  available: boolean;
  stations:  Record<string, Record<string, SpeiSeries>>;
  era5_last: string;
  baseline:  string;
  year_min:  number;
  year_max:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEASONS = ["Annual", "Winter", "Spring", "Summer", "Autumn"] as const;
const MONTHS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;
type Period   = typeof SEASONS[number] | typeof MONTHS[number];

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const MONO     = { fontFamily: "'JetBrains Mono', monospace" };

function speiColor(v: number): string {
  if (v < -1.5) return "#8b3a0f";
  if (v < -1.0) return "#c2713a";
  if (v <  1.0) return "#aaa49a";
  if (v <  1.5) return "#4a80b0";
  return "#1e4d78";
}

// ── Inner Highcharts scatter component ───────────────────────────────────────

interface ChartProps {
  series:   SpeiSeries;
  season:   string;
  baseline: string;
}

function SpeiScatterChart(props: ChartProps) {
  let container!: HTMLDivElement;
  let chart: any = null;

  const buildOpts = () => {
    const { years, spei, trend } = props.series;
    const n = years.length;
    const isMonth = (MONTHS as readonly string[]).includes(props.season);
    const scaleLabel = isMonth ? "SPEI-30" : "SPEI-3";

    const scatter = years.map((y, i) => ({
      x: y, y: spei[i],
      color: speiColor(spei[i]!),
      marker: { radius: 4 },
    }));

    const tr = trend as SpeiTrend | undefined;
    const trendLine = tr?.slope_per_decade != null ? (() => {
      const sl = tr.slope_per_decade / 10;
      const ic = tr.intercept;
      return [
        [years[0],     +(sl * years[0]!     + ic).toFixed(3)],
        [years[n - 1], +(sl * years[n - 1]! + ic).toFixed(3)],
      ];
    })() : [];

    return {
      chart: { type: "scatter", height: 280, backgroundColor: "transparent", animation: false, style: { fontFamily: "'Space Grotesk', sans-serif" } },
      title:   { text: "" },
      credits: { enabled: false },
      legend:  { enabled: false },
      tooltip: {
        formatter(this: any) {
          const v = this.y as number;
          const cat = v < -1.5 ? "Huda suša" : v < -1.0 ? "Suho" : v < 1.0 ? "Normalno" : v < 1.5 ? "Mokro" : "Zelo mokro";
          const sign = v >= 0 ? "+" : "";
          return `<b>${props.season} ${this.x}</b><br>${scaleLabel}: <b>${sign}${v.toFixed(2)}</b><br>${cat}`;
        },
      },
      xAxis: {
        title: { text: "" },
        labels: { style: { fontSize: "10px", color: INK_SOFT, ...MONO } },
        gridLineWidth: 0,
        tickColor: "rgba(14,14,12,0.1)",
      },
      yAxis: {
        title: { text: scaleLabel, style: { fontSize: "10px", color: INK_SOFT } },
        min: -3, max: 3,
        gridLineColor: "rgba(14,14,12,0.06)",
        labels: { style: { fontSize: "10px", color: INK_SOFT, ...MONO } },
        plotLines: [
          { value: 0,    color: INK,       width: 1, dashStyle: "Solid", zIndex: 3 },
          { value: -1.5, color: "#8b3a0f", width: 1, dashStyle: "Dash",  zIndex: 3,
            label: { text: "huda suša", style: { fontSize: "9px", color: "#8b3a0f", ...MONO } } },
          { value:  1.5, color: "#1e4d78", width: 1, dashStyle: "Dash",  zIndex: 3,
            label: { text: "zelo mokro", style: { fontSize: "9px", color: "#1e4d78", ...MONO }, align: "right" as const } },
        ],
      },
      series: [
        { type: "scatter", data: scatter, zIndex: 4 },
        ...(trendLine.length ? [{
          type: "line", data: trendLine, color: INK, lineWidth: 2,
          dashStyle: "Solid", marker: { enabled: false }, enableMouseTracking: false, zIndex: 5,
        }] : []),
      ],
    };
  };

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    chart = Highcharts.chart(container, buildOpts() as any);
  });

  // <Show keyed> in the parent remounts this component on station/period change,
  // so no createEffect needed — just clean up on unmount.
  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SpeiTrendChartProps { data: SpeiStationData; }

export function SpeiTrendChart(props: SpeiTrendChartProps) {
  const stations = createMemo(() => Object.keys(props.data.stations).sort());

  const [station, setStation] = createSignal<string>(stations()[0] ?? "");
  const [period,  setPeriod]  = createSignal<Period>("Summer");

  const series = createMemo((): SpeiSeries | null =>
    props.data.stations[station()]?.[period()] ?? null
  );

  const isMonth = createMemo(() => (MONTHS as readonly string[]).includes(period()));
  const scaleLabel = createMemo(() => isMonth() ? "SPEI-30" : "SPEI-3");

  // Trend stats for the header box
  const trendStats = createMemo(() => {
    const s = series();
    if (!s) return null;
    const tr = s.trend as SpeiTrend | undefined;
    if (tr?.slope_per_decade == null) return null;

    const slope    = tr.slope_per_decade;
    const p        = tr.p_value;
    const n        = s.years.length;
    const lastYear = s.years[n - 1]!;
    const sl       = slope / 10;
    const ic       = tr.intercept;
    const curVal   = sl * lastYear + ic;

    let thresholdLine = "";
    if (sl !== 0) {
      if (sl < 0) {
        if (curVal <= -1.5) {
          thresholdLine = "Trendna linija je že prečkala prag hude suše (SPEI −1,5).";
        } else {
          const yr = Math.round((-1.5 - ic) / sl);
          if (yr > lastYear && yr < 2200) thresholdLine = `Pri tem trendu doseže hudo sušo (SPEI −1,5) okoli leta ${yr}.`;
        }
      } else {
        if (curVal >= 1.5) {
          thresholdLine = "Trendna linija je že prečkala prag zelo mokrega (SPEI +1,5).";
        } else {
          const yr = Math.round((1.5 - ic) / sl);
          if (yr > lastYear && yr < 2200) thresholdLine = `Pri tem trendu doseže zelo mokro (SPEI +1,5) okoli leta ${yr}.`;
        }
      }
    }

    const sig = p < 0.05
      ? `statistično značilen (p < 0,05)`
      : `ni statistično značilen (p = ${p.toFixed(3)})`;

    const tech = `Theil-Sen naklon: ${slope >= 0 ? "+" : ""}${slope.toFixed(3)} SPEI/desetletje · Mann-Kendall: ${tr.mk_trend} · ${sig}. Negativen trend pomeni, da razmere postajajo sušnejše glede na osnovno obdobje ${props.data.baseline}.${thresholdLine ? " " + thresholdLine : ""}`;

    return { slope, p, tech };
  });

  // ── Button styles ──────────────────────────────────────────────────────────

  function stationBtnStyle(s: string) {
    const active = station() === s;
    return {
      "font-family": "var(--font-sans)", "font-size": "11px", padding: "4px 10px",
      "border-radius": "20px", border: "1px solid var(--color-rule-2)", cursor: "pointer",
      background: active ? "var(--color-ink)" : "var(--color-card)",
      color: active ? "#fff" : "var(--color-ink-soft)",
    };
  }

  function periodBtnStyle(p: Period) {
    const active = period() === p;
    return {
      "font-family": "var(--font-mono)", "font-size": "10px", "letter-spacing": "0.04em",
      padding: "3px 9px", "border-radius": "20px",
      border: "1px solid var(--color-rule-2)", cursor: "pointer",
      background: active ? "var(--color-ink)" : "var(--color-card)",
      color: active ? "#fff" : "var(--color-ink-soft)",
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Station row */}
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px", margin: "0 40px 10px" }}>
        <For each={stations()}>
          {(s) => (
            <button style={stationBtnStyle(s)} onClick={() => setStation(s)}>
              {s.replace(/_/g, " ")}
            </button>
          )}
        </For>
      </div>

      {/* Season + month row */}
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "5px", "align-items": "center", margin: "0 40px 14px" }}>
        <For each={SEASONS}>
          {(s) => <button style={periodBtnStyle(s)} onClick={() => setPeriod(s)}>{s}</button>}
        </For>
        <span style={{ display: "inline-block", width: "1px", height: "16px", background: "var(--color-rule-2)", margin: "0 4px" }} />
        <For each={MONTHS}>
          {(m) => <button style={periodBtnStyle(m)} onClick={() => setPeriod(m)}>{m}</button>}
        </For>
      </div>

      {/* Chart card */}
      <div style={{ margin: "0 40px" }}>
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-rule)", "border-radius": "var(--radius,10px)", overflow: "hidden" }}>

          {/* Panel header */}
          <div style={{ padding: "12px 16px 10px", "border-bottom": "1px solid var(--color-rule)", display: "flex", "justify-content": "space-between", "align-items": "flex-start", gap: "12px" }}>
            <div>
              <div style={{ "font-family": "var(--font-sans)", "font-weight": "500", "font-size": "14px", color: "var(--color-ink)" }}>
                {station().replace(/_/g, " ")} — {period()} {scaleLabel()}
              </div>
              <Show when={series()}>
                {(s) => (
                  <div style={{ "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase", "margin-top": "2px" }}>
                    {s().years.length} {isMonth() ? "mesecev" : "sezon"} · {s().years[0]}–{s().years[s().years.length - 1]}
                  </div>
                )}
              </Show>
            </div>

            {/* Slope box */}
            <Show when={trendStats()}>
              {(ts) => (
                <div style={{ "text-align": "right", "flex-shrink": "0" }}>
                  <div style={{ "font-family": "var(--font-sans)", "font-size": "32px", "font-weight": "700", "line-height": "1", color: ts().slope < 0 ? "#8b3a0f" : "#1e4d78" }}>
                    {ts().slope >= 0 ? "+" : ""}{ts().slope.toFixed(2)}
                  </div>
                  <div style={{ "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.07em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "margin-top": "2px" }}>
                    SPEI / desetletje
                  </div>
                </div>
              )}
            </Show>
          </div>

          {/* Chart */}
          <div style={{ padding: "0 8px" }}>
            <Show when={series()} keyed>
              {(s) => <SpeiScatterChart series={s} season={period()} baseline={props.data.baseline} />}
            </Show>
          </div>

          {/* Explanation */}
          <Show when={trendStats()}>
            {(ts) => (
              <p style={{ margin: "0", padding: "8px 16px 12px", "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "line-height": "1.6", "border-top": "1px solid var(--color-rule)" }}>
                {ts().tech}
              </p>
            )}
          </Show>
          <Show when={!trendStats() && series()}>
            <p style={{ margin: "0", padding: "8px 16px 12px", "font-family": "var(--font-sans)", "font-size": "12px", color: "var(--color-ink-soft)", "line-height": "1.55", "border-top": "1px solid var(--color-rule)" }}>
              Premalo podatkov za izračun trenda.
            </p>
          </Show>

        </div>
      </div>

    </div>
  );
}
