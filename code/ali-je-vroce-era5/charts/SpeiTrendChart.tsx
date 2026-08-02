import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { enableChartA11y } from "./highcharts-a11y.ts";
import { t, fmtNum, fmtSigned, fmtMonthShort } from "../i18n/format.ts";

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

// T-5.5 — the season/month period keys stay English (they index the datasette);
// only their display label is Slovenian (seasons from the catalogue, months from
// the Intl short-month formatter).
function periodLabel(p: string): string {
  const mi = (MONTHS as readonly string[]).indexOf(p);
  return mi >= 0 ? fmtMonthShort(mi + 1) : t(`speitrend.season_${p}`);
}

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
      // T-5.4a — screen-reader summary (Slovenian copy awaiting operator review)
      accessibility: {
        enabled: true,
        description: t("speitrend.a11y"),
      },
      tooltip: {
        formatter(this: any) {
          const v = this.y as number;
          const cat = v < -1.5 ? t("speitrend.tooltip_cat_huda") : v < -1.0 ? t("speitrend.tooltip_cat_suho") : v < 1.0 ? t("speitrend.tooltip_cat_normalno") : v < 1.5 ? t("speitrend.tooltip_cat_mokro") : t("speitrend.tooltip_cat_zelo_mokro");
          return t("speitrend.tooltip", { season: periodLabel(props.season), x: this.x, scale: scaleLabel, v: fmtSigned(v, 2), cat });
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
            label: { text: t("speitrend.threshold_dry"), style: { fontSize: "9px", color: "#8b3a0f", ...MONO } } },
          { value:  1.5, color: "#1e4d78", width: 1, dashStyle: "Dash",  zIndex: 3,
            label: { text: t("speitrend.threshold_wet"), style: { fontSize: "9px", color: "#1e4d78", ...MONO }, align: "right" as const } },
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
    await enableChartA11y(Highcharts);
    chart = Highcharts.chart(container, buildOpts() as any);
  });

  // <Show keyed> in the parent remounts this component on station/period change,
  // so no createEffect needed — just clean up on unmount.
  onCleanup(() => { chart?.destroy(); chart = null; });

  return <div ref={container} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SpeiTrendChartProps {
  data:   SpeiStationData;
  // T-5.36 / D-26 — the location is set by the page-wide floating chooser, not an
  // own picker (retired here; the sibling "Sezonski sušni indeks" is national and
  // untouched). `loc` is the era5_name key that indexes `data.stations`; `label` is
  // the diacritic display name (i18n/station-names via meta.stations). The period
  // control below is NOT a location control and stays.
  loc:    string | null;
  label?: string | undefined;
}

export function SpeiTrendChart(props: SpeiTrendChartProps) {
  const [period, setPeriod] = createSignal<Period>("Summer");

  // T-5.36 part (3) — the section still NAMES its station in the panel header, since
  // its location is now set by a possibly-off-screen control. Show the diacritic
  // display name; ASCII era5_name is the last-resort fallback.
  const stationName = () => props.label ?? (props.loc ?? "").replace(/_/g, " ");

  const series = createMemo((): SpeiSeries | null =>
    (props.loc ? props.data.stations[props.loc] : undefined)?.[period()] ?? null
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
          thresholdLine = t("speitrend.threshold_crossed_dry");
        } else {
          const yr = Math.round((-1.5 - ic) / sl);
          if (yr > lastYear && yr < 2200) thresholdLine = t("speitrend.threshold_reach_dry", { year: yr });
        }
      } else {
        if (curVal >= 1.5) {
          thresholdLine = t("speitrend.threshold_crossed_wet");
        } else {
          const yr = Math.round((1.5 - ic) / sl);
          if (yr > lastYear && yr < 2200) thresholdLine = t("speitrend.threshold_reach_wet", { year: yr });
        }
      }
    }

    const sig = p < 0.05
      ? t("speitrend.sig_significant")
      : t("speitrend.sig_not", { p: fmtNum(p, 3) });

    const tech = t("speitrend.tech", {
      slope: fmtSigned(slope, 3), mk: tr.mk_trend, sig, baseline: props.data.baseline,
      threshold: thresholdLine ? " " + thresholdLine : "",
    });

    return { slope, p, tech };
  });

  // ── Button styles ──────────────────────────────────────────────────────────

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

      {/* Season + month row (the station is set by the page-wide floating chooser) */}
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "5px", "align-items": "center", margin: "0 40px 14px" }}>
        <For each={SEASONS}>
          {(s) => <button style={periodBtnStyle(s)} onClick={() => setPeriod(s)}>{periodLabel(s)}</button>}
        </For>
        <span style={{ display: "inline-block", width: "1px", height: "16px", background: "var(--color-rule-2)", margin: "0 4px" }} />
        <For each={MONTHS}>
          {(m) => <button style={periodBtnStyle(m)} onClick={() => setPeriod(m)}>{periodLabel(m)}</button>}
        </For>
      </div>

      {/* Chart card */}
      <div style={{ margin: "0 40px" }}>
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-rule)", "border-radius": "var(--radius,10px)", overflow: "hidden" }}>

          {/* Panel header */}
          <div style={{ padding: "12px 16px 10px", "border-bottom": "1px solid var(--color-rule)", display: "flex", "justify-content": "space-between", "align-items": "flex-start", gap: "12px" }}>
            <div>
              <div style={{ "font-family": "var(--font-sans)", "font-weight": "500", "font-size": "14px", color: "var(--color-ink)" }}>
                {stationName()} — {periodLabel(period())} {scaleLabel()}
              </div>
              <Show when={series()}>
                {(s) => (
                  <div style={{ "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase", "margin-top": "2px" }}>
                    {t("speitrend.header_count", {
                      count: s().years.length,
                      unit1: isMonth() ? t("speitrend.unit_months_one") : t("speitrend.unit_seasons_one"),
                      unit2: isMonth() ? t("speitrend.unit_months_other") : t("speitrend.unit_seasons_other"),
                      y0: s().years[0] ?? 0,
                      y1: s().years[s().years.length - 1] ?? 0,
                    })}
                  </div>
                )}
              </Show>
            </div>

            {/* Slope box */}
            <Show when={trendStats()}>
              {(ts) => (
                <div style={{ "text-align": "right", "flex-shrink": "0" }}>
                  <div style={{ "font-family": "var(--font-sans)", "font-size": "32px", "font-weight": "700", "line-height": "1", color: ts().slope < 0 ? "#8b3a0f" : "#1e4d78" }}>
                    {fmtSigned(ts().slope, 2)}
                  </div>
                  <div style={{ "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.07em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "margin-top": "2px" }}>
                    {t("speitrend.slope_unit")}
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
              {t("speitrend.too_little")}
            </p>
          </Show>

        </div>
      </div>

    </div>
  );
}
