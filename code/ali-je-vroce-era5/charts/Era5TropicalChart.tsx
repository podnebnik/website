import { createResource, createMemo, Show, ErrorBoundary } from "solid-js";
import { fetchEra5Tropical, isArsoLoc, ERA5_NATIONAL } from "../api.ts";
import { sectionErrorFallback } from "../components/SectionError.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { TropHighchart } from "./TropicalChart.tsx";
import type { Config } from "./TropicalChart.tsx";
import { t, fmtNum, fmtInt, fmtSigned } from "../i18n/format.ts";

function pFmt(p: number): string {
  return p < 0.001 ? "p < 0,001" : p < 0.01 ? "p < 0,01" : p < 0.05 ? `p = ${fmtNum(p, 3)}` : `p = ${fmtNum(p, 3)} (ns)`;
}

const ERA5_CONFIGS: Record<string, Config> = {
  days: {
    kind:             "days",
    unitLabel:        t("tropical.unit_days"),
    defaultThreshold: 30,
    minT: 25, maxT: 35,
    // NB: subLabel is currently unreferenced (the section subtitle is rendered from
    // sections.tropical_days_sub in AliJeVroceERA5). Left as-is — see PROGRESS T-5.5.
    subLabel:         (th, st) => `Število dni z najvišjo temperaturo nad ${th} °C` +
      (st > 1 ? `, v nizih ${st}+ zaporednih dni` : "") +
      ` na leto · lapsna korekcija nadmorske višine · ERA5-Land`,
    tooltipNoun:      t("tropical.noun_days"),
    plainDesc:        (th) => t("tropical.plain_desc_days", { th: fmtInt(th) }),
    plainNounInstr:   t("tropical.instr_days"),
  },
  nights: {
    kind:             "nights",
    unitLabel:        t("tropical.unit_nights"),
    defaultThreshold: 20,
    minT: 15, maxT: 25,
    subLabel:         (th, st) => `Število noči z najnižjo temperaturo nad ${th} °C` +
      (st > 1 ? `, v nizih ${st}+ zaporednih noči` : "") +
      ` na leto · lapsna korekcija nadmorske višine · ERA5-Land`,
    tooltipNoun:      t("tropical.noun_nights"),
    plainDesc:        (th) => t("tropical.plain_desc_nights", { th: fmtInt(th) }),
    plainNounInstr:   t("tropical.instr_nights"),
  },
};

interface Props {
  loc:       string | null;
  label?:    string | undefined;
  kind:      "days" | "nights";
  threshold: number;
  streak:    number;
}

export function Era5TropicalChart(props: Props) {
  const cfg = () => ERA5_CONFIGS[props.kind]!;

  const era5Loc = createMemo(() => {
    const l = props.loc ?? "";
    return l && !isArsoLoc(l) && l !== ERA5_NATIONAL ? l : null;
  });

  const [data, { refetch }] = createResource(
    () => {
      const loc = era5Loc();
      return loc ? { loc, kind: props.kind, threshold: props.threshold, streak: props.streak } : null;
    },
    ({ loc, kind, threshold, streak }) => fetchEra5Tropical(loc, kind, threshold, streak),
  );

  const display = () => data() ?? data.latest;

  const trendDesc = () => {
    const d = display();
    if (!d) return null;
    const tr = d.trend;
    if (!tr.model_used) return null;
    const dpd = tr.days_per_decade;
    const p   = tr.p_value;

    const sigphrase = p < 0.05 ? t("tropical.sig_yes", { p: pFmt(p) }) : t("tropical.sig_no", { p: pFmt(p) });
    const techLine = t("tropical.tech", {
      rate: fmtSigned(tr.rate_per_year, 2), dpd: fmtSigned(dpd, 1), unit: cfg().unitLabel,
      sigphrase, aic: fmtInt(tr.aic), alpha: tr.alpha,
    });

    const fittedLast = tr.y_line[tr.y_line.length - 1]!;
    const proj2050   = Math.round(fittedLast * Math.pow(1 + tr.rate_per_year / 100, 2050 - tr.fit_year_max));
    const dir        = dpd > 0 ? t("tropical.dir_more") : t("tropical.dir_less");
    const sig        = p < 0.05 ? t("tropical.sig_trend_yes") : t("tropical.sig_trend_no");
    const forward    = p < 0.05 && proj2050 > 0
      ? t("tropical.forward_yes", { proj2050: fmtInt(proj2050), unit: cfg().unitLabel })
      : t("tropical.forward_no");

    const plainLine = t("tropical.plain", {
      plainDesc: cfg().plainDesc(props.threshold), station: props.label ?? "", sig,
      dpd: fmtNum(Math.abs(dpd), 1), dir, unit: cfg().unitLabel, forward,
    });

    return { tech: techLine, plain: plainLine };
  };

  const noTrendReason = () => {
    const d = display();
    if (!d || d.trend.model_used) return null;
    // T-4.24 — two distinct withhold reasons. The pipeline's insufficiency gate is
    // <10 non-zero years (precompute_datasette.py:593); with ≥10 the withhold is a
    // convergence/covariance failure instead, so the "at least 10 needed" wording
    // would be false. Branch on the count the pipeline gates on so the message
    // never contradicts the visible year count.
    if (d.nonzero_count < 10)
      return t("tropical.no_trend", { instr: cfg().plainNounInstr, count: d.nonzero_count });
    return t("tropical.no_trend_unreliable");
  };

  return (
    <div style={{ margin: "0 40px" }}>
      <ErrorBoundary fallback={sectionErrorFallback(refetch, "300px")}>
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-rule)", "border-radius": "var(--radius,10px)", overflow: "hidden" }}>

        <div style={{ padding: "12px 16px 10px", "border-bottom": "1px solid var(--color-rule)", display: "flex", "align-items": "baseline", "justify-content": "space-between" }}>
          <div style={{ "font-family": "var(--font-sans)", "font-weight": "500", "font-size": "14px", color: "var(--color-ink)" }}>
            {cfg().tooltipNoun}{props.label ? ` · ${props.label}` : ""}
          </div>
          <Show when={display()}>
            {(d) => (
              <div style={{ "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase" }}>
                {t("tropical.header_count", { count: d().years.length, nonzero: d().nonzero_count })}
              </div>
            )}
          </Show>
        </div>

        <div style={{ padding: "0 8px" }}>
          <Show when={display()}>
            {(d) => (
              <TropHighchart
                station={props.label ?? ""}
                series={d()}
                cfg={cfg()}
                threshold={props.threshold}
              />
            )}
          </Show>
          <Show when={data.loading && !display()}>
            <div style={{ height: "300px" }} class="animate-pulse bg-[var(--color-paper-2)] rounded" />
          </Show>
          {/* T-5.14 — resolved to no row (fetchEra5Tropical → null): message in the
              card body, not the card chrome + title over an empty chart. The
              !loading guard keeps it from flashing during a station refetch. */}
          <Show when={!data.loading && !display()}>
            <EmptyState minHeight="300px" />
          </Show>
        </div>

        {/* T-5.4b — the current-year (right-most) bar is drawn in the same hue as
            the others but at a lower opacity (TropicalChart.tsx:74-77) to mark it
            as the still-incomplete year in progress. That distinction was visible
            only through the fill and, on hover, the tooltip's "(leto v teku)"; a
            screen-reader user already gets it from the chart description, but a
            sighted (incl. colour-blind) user had no PERSISTENT text cue. This
            legend-style line supplies one, matching the swatch+label pattern of
            the map elevation legend (AliJeVroceERA5.tsx:154-164). Colour, wording
            and placement are PROVISIONAL — flagged for the designer/content review
            (D-17); the category colours themselves are unchanged. */}
        <Show when={display()}>
          <div style={{ padding: "0 16px 10px", display: "flex", "align-items": "center", gap: "5px", "font-family": "var(--font-mono)", "font-size": "9px", "letter-spacing": "0.06em", "text-transform": "uppercase", color: "var(--color-ink-soft)" }}>
            <span style={{ width: "10px", height: "10px", background: "rgba(194,90,44,0.4)", "border-radius": "2px", display: "inline-block", border: "1px solid rgba(0,0,0,0.15)", "flex-shrink": "0" }} />
            {t("tropical.year_legend")}
          </div>
        </Show>

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
      </ErrorBoundary>
    </div>
  );
}
