import { createResource, Show, ErrorBoundary } from "solid-js";
import { fetchRegression } from "../api.ts";
import { sectionErrorFallback } from "./SectionError.tsx";
import { EmptyState } from "./EmptyState.tsx";
import type { RegressionResult } from "../types.ts";
import { t, fmtNum, fmtSigned } from "../i18n/format.ts";
// T-6.32 — per-location content is centralised in the catalogue; read the raw
// objects here for the `<Show>` guards, which a key-returning t() cannot express.
// The card shows ONE station description (by era5_name) plus ONE category text
// (by trend band), replacing the former single per-band narrative + risk line.
import { stationDescriptions, categoryTexts } from "../i18n/hero-content.ts";

const CATEGORIES: Record<string, string> = {
  catastrophic: t("hero.cat_catastrophic"),
  extreme:      t("hero.cat_extreme"),
  bad:          t("hero.cat_bad"),
  moderate:     t("hero.cat_moderate"),
  baseline:     t("hero.cat_baseline"),
};

const CAT_STYLE: Record<string, { background: string; color: string }> = {
  catastrophic: { background: "#962c1a", color: "#fff" },
  extreme:      { background: "#C25A2C", color: "#fff" },
  bad:          { background: "#c2843a", color: "#fff" },
  moderate:     { background: "#b5a06a", color: "#fff" },
  baseline:     { background: "#6c8fb6", color: "#fff" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendCategory(trend10: number): string {
  if (trend10 >= 0.30) return "catastrophic";
  if (trend10 >= 0.20) return "extreme";
  if (trend10 >= 0.10) return "bad";
  if (trend10 >= 0.05) return "moderate";
  return "baseline";
}

function stars(p: number): string {
  if (p < 0.001) return "★★★  p < 0,001";
  if (p < 0.01)  return "★★  p < 0,01";
  if (p < 0.05)  return `★  p = ${fmtNum(p, 3)}`;
  return `p = ${fmtNum(p, 3)} (ns)`;
}

function ar1Label(ar1: number | null): string {
  if (ar1 === null) return "—";
  const abs = Math.abs(ar1);
  const strength = abs < 0.1 ? t("hero.ar1_negligible") : abs < 0.3 ? t("hero.ar1_weak") : t("hero.ar1_moderate");
  return t("hero.ar1", { ar1: fmtNum(ar1, 2), strength });
}

function verdictHtml(st: RegressionResult["stats"], unit: string): string {
  if (st.trend10 === 0) return t("hero.verdict_none");
  const isPos = st.trend10 > 0;
  // fmtSigned reproduces the old "{sign}{t100}" (warming "+", cooling "−").
  const t100  = fmtSigned(st.trend10 * 10, 2);
  const yrs   = fmtNum(Math.abs(10 / st.trend10), 1);
  return t(isPos ? "hero.verdict_warming" : "hero.verdict_cooling", { t100, unit, yrs });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  loc:        string | null;
  // T-5.27 part (3) — the DIACRITIC display name (station.label). loc is the ASCII
  // era5_name key used for fetching; the card must show the label, not the key.
  label?:     string | undefined;
  doy:        number;
  dateLabel?: string;
}

const MONO     = { "font-family": "var(--font-mono)" };
const SANS     = { "font-family": "var(--font-sans)" };

export function HeroCards(props: Props) {
  const loc = () => props.loc ?? "Ljubljana";

  const [resp, { refetch }] = createResource(
    () => ({ loc: loc(), doy: props.doy }),
    ({ loc, doy }) =>
      fetchRegression({ locs: [loc], var: "temperature_max", doy }),
  );

  return (
    <ErrorBoundary fallback={sectionErrorFallback(refetch, "180px")}>
      <Show when={resp()?.results?.length} fallback={<EmptyState minHeight="180px" />}>
        <HeroCard res={resp()!.results[0]!} unit={resp()!.unit} dateLabel={resp()!.date_label} label={props.label} />
      </Show>
    </ErrorBoundary>
  );
}

function HeroCard(props: { res: RegressionResult; unit: string; dateLabel: string; label?: string | undefined }) {
  const res = () => props.res;
  // Display name (label) for what the reader sees; res().loc stays the ASCII key for
  // the stationDescriptions lookup below.
  const displayName = () => props.label ?? res().loc.replace(/_/g, " ");
  const st  = () => res().stats;
  const cat = () => trendCategory(st().trend10);
  const isPos = () => st().trend10 >= 0;
  const signColor = () => isPos() ? "#C25A2C" : "#3A5A8A";

  const nValues = () => (st() as any).n_values as number | undefined;

  // Station description is band-independent (keyed by era5_name); the category
  // text is keyed by the trend band. Both render in the right column.
  const desc = () => stationDescriptions[res().loc];
  const catText = () => categoryTexts[cat()];

  return (
    <div
      role="group"
      class="wide-item"
      aria-label={t("hero.group_a11y", { station: displayName() })}
      style={{
      background:    "var(--color-card)",
      border:        "1px solid var(--color-rule)",
      "border-radius": "var(--radius, 10px)",
      overflow:      "hidden",
    }}>

      {/* Top row: eyebrow + trend stat + verdict */}
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "0", "border-bottom": "1px solid var(--color-rule)" }}>

        {/* Left column: eyebrow + stat */}
        <div class="md:flex-[0_0_240px]" style={{ padding: "18px 20px 16px", "border-right": "1px solid var(--color-rule)" }}>
          {/* Eyebrow */}
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "12px", "flex-wrap": "wrap" }}>
            <span style={{ ...SANS, "font-size": "15px", "font-weight": "600", color: "var(--color-ink)" }}>
              {displayName()}
            </span>
            {/* <span style={{ width: "4px", height: "4px", "border-radius": "50%", background: "var(--color-ink-soft)", display: "inline-block", "flex-shrink": "0" }} /> */}
            <span style={{ ...MONO, "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase" }}>
              {props.dateLabel} · {t("hero.eyebrow_var")}
            </span>
          </div>

          {/* Trend number */}
          <div style={{ display: "flex", "align-items": "baseline", gap: "4px", "margin-bottom": "6px" }}>
            <span style={{ "font-family": "var(--font-serif)", "font-size": "42px", "font-weight": "400", "line-height": "1", color: signColor() }}>
              {fmtSigned(st().trend10, 3)}
            </span>
            <span style={{ ...MONO, "font-size": "13px", color: "var(--color-ink-soft)" }}>
              {t("hero.unit_decade")}
            </span>
          </div>
        </div>

        {/* Right column: verdict + category */}
        <div style={{ flex: "1 1 280px", padding: "18px 20px 16px", display: "flex", "flex-direction": "column", gap: "10px" }}>

          {/* Category badge */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={{
              ...MONO,
              "font-size":      "10px",
              "font-weight":    "500",
              "letter-spacing": "0.08em",
              "text-transform": "uppercase",
              padding:          "3px 10px",
              "border-radius":  "20px",
              ...CAT_STYLE[cat()],
            }}>
              {CATEGORIES[cat()]}
            </span>
          </div>

          {/* Station description (band-independent) */}
          <Show when={desc()}>
            <p style={{ ...SANS, margin: "0", "font-size": "13px", color: "var(--color-ink-soft)", "line-height": "1.55" }}>
              {desc()}
            </p>
          </Show>

          {/* Category text (per trend band) */}
          <Show when={catText()}>
            <p style={{ ...SANS, margin: "0", "font-size": "13px", color: "var(--color-ink-soft)", "line-height": "1.55" }}>
              {catText()}
            </p>
          </Show>

          {/* Verdict */}
          <div>
            <p style={{ ...SANS, margin: "0 0 2px", "font-size": "13px", color: "var(--color-ink)", "line-height": "1.55" }}
               innerHTML={verdictHtml(st(), props.unit)} />
            <p style={{ ...MONO, margin: "0", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.05em" }}>
              {t("hero.method_theilsen")}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", "flex-wrap": "wrap", "border-top": "0" }}>
        {([
          [t("hero.stat_significance"), stars(st().p_val)],
          [st().metric_lbl, fmtNum(st().metric, 4)],
          [t("hero.stat_sample"), nValues() ? t("hero.sample_full", { count: nValues()!, count2: st().n_years }) : t("hero.sample_years", { count: st().n_years })],
          [t("hero.stat_autocorrelation"), ar1Label(st().ar1)],
        ] as [string, string][]).map(([k, v], i) => (
          <div style={{
            flex:            "1 1 160px",
            padding:         "10px 16px 10px",
            "border-right":  i < 3 ? "1px solid var(--color-rule)" : "none",
            // "border-top":    "1px solid var(--color-rule)",
          }}>
            <div style={{ ...MONO, "font-size": "9px", "letter-spacing": "0.08em", "text-transform": "uppercase", color: "var(--color-ink-soft)", "margin-bottom": "3px" }}>
              {k}
            </div>
            <div style={{ ...MONO, "font-size": "11px", color: "var(--color-ink)" }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
