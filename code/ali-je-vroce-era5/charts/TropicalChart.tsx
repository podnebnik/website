import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";

interface TropTrend {
  model_used:      boolean | "nb";
  rate_per_year:   number;
  days_per_decade: number;
  p_value:         number;
  x_line:          number[];
  y_line:          number[];
  ci_low:          number[];
  ci_high:         number[];
  pi_low?:         number[];
  pi_high?:        number[];
  fit_year_max:    number;
  aic:             number;
  alpha:           number;
}

interface TropStation {
  years:         number[];
  counts:        number[];
  nonzero_count: number;
  trend:         TropTrend;
}

interface TropData {
  stations:  Record<string, TropStation>;
  era5_last: string;
}

interface Config {
  kind:             "days" | "nights";
  endpoint:         string;
  unitLabel:        string;
  defaultThreshold: number;
  minT:             number;
  maxT:             number;
  subLabel:         (th: number, st: number) => string;
  tooltipNoun:      string;
  plainDesc:        (th: number) => string;
  plainNoun:        string;
}

const SIDECAR_BASE = (import.meta.env.VITE_ERA5_SIDECAR_URL as string | undefined) ?? "";

const CONFIGS: Record<string, Config> = {
  days: {
    kind:             "days",
    endpoint:         `${SIDECAR_BASE}/api/live/tropical_days`,
    unitLabel:        "dni",
    defaultThreshold: 30,
    minT:             15,
    maxT:             45,
    subLabel:         (th, st) => `Število dni z najvišjo temperaturo nad ${th} °C` +
      (st > 1 ? `, v nizih ${st}+ zaporednih dni` : "") +
      ` na leto · lapsna korekcija nadmorske višine · ERA5-Land`,
    tooltipNoun:      "Tropski dnevi",
    plainDesc:        (th) => `Tropski dan — ko dnevna temperatura preseže ${th} °C — povečuje toplotni stres in zdravstvena tveganja.`,
    plainNoun:        "tropski dan",
  },
  nights: {
    kind:             "nights",
    endpoint:         `${SIDECAR_BASE}/api/live/tropical_nights`,
    unitLabel:        "noči",
    defaultThreshold: 20,
    minT:             5,
    maxT:             35,
    subLabel:         (th, st) => `Število noči z najnižjo temperaturo nad ${th} °C` +
      (st > 1 ? `, v nizih ${st}+ zaporednih noči` : "") +
      ` na leto · lapsna korekcija nadmorske višine · ERA5-Land`,
    tooltipNoun:      "Tropske noči",
    plainDesc:        (th) => `Tropska noč — ko temperatura čez noč ostane nad ${th} °C — preprečuje telesu okrevanje po dnevni vročini.`,
    plainNoun:        "tropska noč",
  },
};

const INK      = "#0E0E0C";
const INK_SOFT = "#6B655B";
const ACCENT   = "#C25A2C";
const MONO     = { fontFamily: "'JetBrains Mono', monospace" };

function pFmt(p: number): string {
  return p < 0.001 ? "p < 0.001" : p < 0.01 ? "p < 0.01" : p < 0.05 ? `p = ${p.toFixed(3)}` : `p = ${p.toFixed(3)} (ns)`;
}

// ── Highcharts inner component ────────────────────────────────────────────────

interface ChartProps {
  station:   string;
  series:    TropStation;
  cfg:       Config;
  threshold: number;
}

function TropHighchart(props: ChartProps) {
  let container!: HTMLDivElement;
  let chart: any = null;

  const buildSeries = () => {
    const { years, counts, trend } = props.series;
    const currentYear = new Date().getFullYear();

    const barData = years.map((y, i) => ({
      x: y, y: counts[i]!,
      ...(y === currentYear ? { color: ACCENT, opacity: 0.4 } : {}),
    }));

    const out: any[] = [
      {
        type: "column",
        name: props.cfg.tooltipNoun,
        data: barData,
        color: ACCENT + "99",
        groupPadding: 0.05,
        pointPadding: 0,
        borderWidth: 0,
        zIndex: 2,
        dataLabels: {
          enabled: true,
          style: { fontSize: "8px", fontWeight: "400", color: INK_SOFT, textOutline: "none" },
          formatter(this: any) { return this.y || null; },
        },
      },
    ];

    if (trend?.model_used && trend.x_line) {
      const dpd = trend.days_per_decade;
      const p   = trend.p_value;

      if (trend.pi_low) {
        out.push({
          type: "arearange",
          name: "95% PI",
          data: trend.x_line.map((x, i) => [x, trend.pi_low![i], trend.pi_high![i]]),
          color: INK,
          fillOpacity: 0.05,
          lineWidth: 0,
          marker: { enabled: false },
          enableMouseTracking: false,
          zIndex: 0,
        });
      }

      out.push(
        {
          type: "arearange",
          name: "95% CI",
          data: trend.x_line.map((x, i) => [x, trend.ci_low[i], trend.ci_high[i]]),
          color: INK,
          fillOpacity: 0.12,
          lineWidth: 0,
          marker: { enabled: false },
          enableMouseTracking: false,
          zIndex: 1,
        },
        {
          type: "line",
          name: `NB fit (${dpd >= 0 ? "+" : ""}${dpd.toFixed(1)} ${props.cfg.unitLabel}/des · ${pFmt(p)})`,
          data: trend.x_line.map((x, i) => ({ x, y: trend.y_line[i] })),
          color: INK,
          lineWidth: 2,
          dashStyle: "Solid",
          marker: { enabled: false },
          zIndex: 3,
        }
      );
    }
    return out;
  };

  const buildXPlotLines = () => {
    if (!props.series.trend?.fit_year_max) return [];
    return [{
      value: props.series.trend.fit_year_max + 0.5,
      color: INK_SOFT, width: 1, dashStyle: "Dot" as const, zIndex: 4,
      label: {
        text: `trend do ${props.series.trend.fit_year_max}`, rotation: 0,
        align: "right" as const, x: -4, y: -4,
        style: { fontSize: "9px", color: INK_SOFT, ...MONO },
      },
    }];
  };

  onMount(async () => {
    const Highcharts = (await import("highcharts")).default;
    await import("highcharts/highcharts-more");

    chart = Highcharts.chart(container, {
      chart: { type: "column", height: 300, backgroundColor: "transparent", animation: false, style: { fontFamily: "Space Grotesk, sans-serif" } },
      title:   { text: undefined },
      credits: { enabled: false },
      legend:  { enabled: true, itemStyle: { fontSize: "10px", fontWeight: "400", color: INK } },
      tooltip: {
        formatter(this: any) {
          if (this.series.type === "line") return `<b>${Math.round(this.x)}</b><br>Trend: <b>${this.y!.toFixed(1)}</b> ${props.cfg.unitLabel}`;
          if (this.series.type === "arearange") return false as any;
          const partial = this.x === new Date().getFullYear() ? " <i>(leto v teku)</i>" : "";
          return `<b>${this.x}</b>${partial}<br>${props.cfg.tooltipNoun}: <b>${this.y}</b>`;
        },
      },
      xAxis: {
        title: { text: null },
        labels: { style: { color: INK_SOFT, fontSize: "10px", ...MONO } },
        gridLineWidth: 0,
        tickColor: "rgba(14,14,12,0.1)",
        plotLines: buildXPlotLines(),
      },
      yAxis: {
        title: { text: props.cfg.unitLabel.charAt(0).toUpperCase() + props.cfg.unitLabel.slice(1), style: { fontSize: "10px", color: INK_SOFT } },
        min: 0,
        gridLineColor: "rgba(14,14,12,0.06)",
        labels: { style: { fontSize: "10px", color: INK_SOFT, ...MONO } },
      },
      series: buildSeries(),
    } as any);
  });

  // ── KEY FIX: read reactive props BEFORE early return so deps are always tracked ──
  createEffect(() => {
    const _series    = props.series;    // establish reactive dependency
    const _threshold = props.threshold; // establish reactive dependency
    if (!chart) return;
    const series = buildSeries();
    while (chart.series.length) chart.series[0].remove(false);
    series.forEach(s => chart.addSeries(s, false));
    chart.xAxis[0].update({ plotLines: buildXPlotLines() }, false);
    chart.redraw(false);
  });

  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { kind: "days" | "nights"; }

export function TropicalChart(props: Props) {
  const cfg = CONFIGS[props.kind]!;

  const [threshold, setThreshold] = createSignal(cfg.defaultThreshold);
  const [streak,    setStreak]    = createSignal(1);
  const [station,   setStation]   = createSignal<string | null>(null);
  const [data,      setData]      = createSignal<TropData | null>(null);
  const [loading,   setLoading]   = createSignal(false);
  const [error,     setError]     = createSignal(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const resp = await fetch(`${cfg.endpoint}?threshold=${threshold()}&streak=${streak()}`);
      if (!resp.ok) throw new Error();
      const d: TropData = await resp.json();
      if (!d.stations) throw new Error();
      setData(d);
      const stations = Object.keys(d.stations).sort();
      if (!station() || !stations.includes(station()!)) {
        setStation(stations[0] ?? null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  onMount(load);

  const stations = () => Object.keys(data()?.stations ?? {}).sort();
  const series   = () => data()?.stations[station() ?? ""] ?? null;
  const trend    = () => series()?.trend;

  const trendDesc = () => {
    const tr = trend();
    if (!tr?.model_used) return null;
    const dpd  = tr.days_per_decade;
    const p    = tr.p_value;
    const nz   = series()?.nonzero_count ?? 0;

    const techLine =
      `NB GLM: ${tr.rate_per_year >= 0 ? "+" : ""}${tr.rate_per_year.toFixed(2)}%/leto · ` +
      `${dpd >= 0 ? "+" : ""}${dpd.toFixed(1)} ${cfg.unitLabel}/desetletje · ` +
      `95% CI · ${p < 0.05 ? `statistično značilen (${pFmt(p)})` : `ni značilen (${pFmt(p)})`} · ` +
      `AIC ${tr.aic.toFixed(0)} · α=${tr.alpha}.`;

    const fittedLast = tr.y_line[tr.y_line.length - 1]!;
    const proj2050   = Math.round(fittedLast * Math.pow(1 + tr.rate_per_year / 100, 2050 - tr.fit_year_max));
    const dir        = dpd > 0 ? "več" : "manj";
    const sig        = p < 0.05 ? "statistično značilen trend" : "trend, ki še ni statistično značilen";
    const forward    = p < 0.05 && proj2050 > 0
      ? `Če trend nadaljuje, bi bilo do 2050 tipičnih okoli ${proj2050} ${cfg.unitLabel} na leto.`
      : `Podatki ne kažejo jasnega signala, a smer spremembe je vredna pozornosti.`;

    const plainLine = `${cfg.plainDesc(threshold())} Postaja kaže ${sig}: grobe ${Math.abs(dpd).toFixed(1)} ${dir} ${cfg.unitLabel} na desetletje. ${forward}`;

    return { tech: techLine, plain: plainLine };
  };

  const noTrendReason = () => {
    const tr = trend();
    if (tr?.model_used) return null;
    const nz = series()?.nonzero_count ?? 0;
    return nz < 10
      ? `Premalo let z ${cfg.plainNoun}i za izračun trenda (${nz} let z vrednostjo > 0). Potrebnih je vsaj 10.`
      : null;
  };

  const INPUT_STYLE = { width: "52px", border: "1px solid var(--color-rule-2)", "border-radius": "6px", padding: "3px 6px", "font-family": "var(--font-mono)", "font-size": "11px", background: "var(--color-card)", color: "var(--color-ink)", "text-align": "center" } as const;
  const LABEL_STYLE = { display: "flex", "align-items": "center", gap: "6px", "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.08em", "text-transform": "uppercase" } as const;

  return (
    <div>

      {/* ── Station picker ── */}
      <Show when={stations().length > 0}>
        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px", margin: "0 40px 12px" }}>
          <For each={stations()}>
            {(s) => (
              <button
                style={{
                  "font-family": "var(--font-sans)", "font-size": "11px", padding: "4px 10px",
                  "border-radius": "20px", border: "1px solid var(--color-rule-2)", cursor: "pointer",
                  background: station() === s ? "var(--color-ink)" : "var(--color-card)",
                  color: station() === s ? "#fff" : "var(--color-ink-soft)",
                }}
                onClick={() => setStation(s)}
              >
                {s.replace(/_/g, " ")}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* ── Parameter controls ── */}
      <div style={{ display: "flex", gap: "16px", "align-items": "center", margin: "0 40px 8px", "flex-wrap": "wrap" }}>
        <label style={LABEL_STYLE}>
          Prag:
          <input
            type="number" value={threshold()} min={cfg.minT} max={cfg.maxT} step={0.5}
            style={INPUT_STYLE}
            onBlur={(e) => { const v = parseFloat(e.currentTarget.value); if (!isNaN(v)) { setThreshold(Math.max(cfg.minT, Math.min(cfg.maxT, v))); load(); } }}
            onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat(e.currentTarget.value); if (!isNaN(v)) { setThreshold(Math.max(cfg.minT, Math.min(cfg.maxT, v))); load(); } } }}
          />
          °C
        </label>

        <label style={LABEL_STYLE}>
          Min. zap. {cfg.unitLabel}:
          <input
            type="number" value={streak()} min={1} max={60} step={1}
            style={INPUT_STYLE}
            onBlur={(e) => { const v = parseInt(e.currentTarget.value, 10); if (!isNaN(v)) { setStreak(Math.max(1, Math.min(60, v))); load(); } }}
            onKeyDown={(e) => { if (e.key === "Enter") { const v = parseInt(e.currentTarget.value, 10); if (!isNaN(v)) { setStreak(Math.max(1, Math.min(60, v))); load(); } } }}
          />
        </label>

        <span style={{ "font-family": "var(--font-mono)", "font-size": "9px", color: "var(--color-ink-soft)", "line-height": "1.4" }}>
          {cfg.subLabel(threshold(), streak())}
        </span>
      </div>

      {/* ── Chart card ── */}
      <div style={{ margin: "0 40px" }}>
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-rule)", "border-radius": "var(--radius,10px)", overflow: "hidden" }}>

          <div style={{ padding: "12px 16px 10px", "border-bottom": "1px solid var(--color-rule)", display: "flex", "align-items": "baseline", "justify-content": "space-between" }}>
            <div style={{ "font-family": "var(--font-sans)", "font-weight": "500", "font-size": "14px", color: "var(--color-ink)" }}>
              {station()?.replace(/_/g, " ") ?? "—"}
            </div>
            <Show when={series()}>
              {(s) => (
                <div style={{ "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase" }}>
                  {s().years.length} let · {s().years[0]}–{s().years[s().years.length - 1]}
                </div>
              )}
            </Show>
          </div>

          <div style={{ padding: "0 8px" }}>
            <Show when={loading()}>
              <div style={{ height: "300px" }} class="animate-pulse bg-[var(--color-paper-2)] rounded" />
            </Show>
            <Show when={!loading() && error()}>
              <div style={{ height: "200px", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--color-ink-soft)", "font-size": "13px" }}>
                Podatkov ni mogoče naložiti.
              </div>
            </Show>
            <Show when={!loading() && !error() && series()}>
              {(s) => (
                <TropHighchart
                  station={station() ?? ""}
                  series={s()}
                  cfg={cfg}
                  threshold={threshold()}
                />
              )}
            </Show>
          </div>

          {/* Trend description */}
          <Show when={trendDesc()}>
            {(td) => (
              <div style={{ margin: "0", padding: "0 16px 12px", "font-size": "12px", "line-height": "1.55", "border-top": "1px solid var(--color-rule)" }}>
                <p style={{ margin: "8px 0 4px", "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)" }}>
                  {td().tech}
                </p>
                <p style={{ margin: "0", "font-family": "var(--font-sans)", color: "var(--color-ink-soft)" }}>
                  {td().plain}
                </p>
              </div>
            )}
          </Show>
          <Show when={noTrendReason()}>
            {(r) => (
              <p style={{ margin: "0", padding: "0 16px 12px", "font-family": "var(--font-sans)", "font-size": "12px", color: "var(--color-ink-soft)", "line-height": "1.55", "border-top": "1px solid var(--color-rule)" }}>
                {r()}
              </p>
            )}
          </Show>

        </div>
      </div>

    </div>
  );
}
