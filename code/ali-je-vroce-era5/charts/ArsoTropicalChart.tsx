import { createResource, createMemo, Show } from "solid-js";
import { fetchArsoTropical, isArsoLoc } from "../api.ts";
import { TropHighchart } from "./TropicalChart.tsx";
import type { Config } from "./TropicalChart.tsx";

function pFmt(p: number): string {
  return p < 0.001 ? "p < 0.001" : p < 0.01 ? "p < 0.01" : p < 0.05 ? `p = ${p.toFixed(3)}` : `p = ${p.toFixed(3)} (ns)`;
}

const ARSO_CONFIGS: Record<string, Config> = {
  days: {
    kind:             "days",
    endpoint:         "",
    unitLabel:        "dni",
    defaultThreshold: 30,
    minT: 15, maxT: 45,
    subLabel:         (th) => `Število dni z najvišjo temperaturo nad ${th} °C na leto · ARSO meritve`,
    tooltipNoun:      "Tropski dnevi",
    plainDesc:        (th) => `Tropski dan — ko dnevna temperatura preseže ${th} °C — povečuje toplotni stres in zdravstvena tveganja.`,
    plainNoun:        "tropski dan",
  },
  nights: {
    kind:             "nights",
    endpoint:         "",
    unitLabel:        "noči",
    defaultThreshold: 20,
    minT: 5, maxT: 35,
    subLabel:         (th) => `Število noči z najnižjo temperaturo nad ${th} °C na leto · ARSO meritve`,
    tooltipNoun:      "Tropske noči",
    plainDesc:        (th) => `Tropska noč — ko temperatura čez noč ostane nad ${th} °C — preprečuje telesu okrevanje po dnevni vročini.`,
    plainNoun:        "tropska noč",
  },
};

interface Props {
  loc:       string | null;
  label?:    string;
  kind:      "days" | "nights";
  threshold: number;
}

export function ArsoTropicalChart(props: Props) {
  const cfg = () => ARSO_CONFIGS[props.kind]!;

  const stationId = createMemo(() => {
    const l = props.loc ?? "";
    return isArsoLoc(l) ? Number(l.replace("arso:", "")) : null;
  });

  const [data] = createResource(
    () => {
      const id = stationId();
      return id != null ? { id, kind: props.kind, threshold: props.threshold } : null;
    },
    ({ id, kind, threshold }) => fetchArsoTropical(id, kind, threshold),
  );

  const display = () => data() ?? data.latest;

  const trendDesc = () => {
    const d = display();
    if (!d) return null;
    const tr = d.trend;
    if (!tr.model_used) return null;
    const dpd = tr.days_per_decade;
    const p   = tr.p_value;
    const nz  = d.nonzero_count;

    const techLine =
      `NB GLM: ${tr.rate_per_year >= 0 ? "+" : ""}${tr.rate_per_year.toFixed(2)}%/leto · ` +
      `${dpd >= 0 ? "+" : ""}${dpd.toFixed(1)} ${cfg().unitLabel}/desetletje · ` +
      `95% CI · ${p < 0.05 ? `statistično značilen (${pFmt(p)})` : `ni značilen (${pFmt(p)})`} · ` +
      `AIC ${tr.aic.toFixed(0)} · α=${tr.alpha}.`;

    const fittedLast = tr.y_line[tr.y_line.length - 1]!;
    const proj2050   = Math.round(fittedLast * Math.pow(1 + tr.rate_per_year / 100, 2050 - tr.fit_year_max));
    const dir        = dpd > 0 ? "več" : "manj";
    const sig        = p < 0.05 ? "statistično značilen trend" : "trend, ki še ni statistično značilen";
    const forward    = p < 0.05 && proj2050 > 0
      ? `Če trend nadaljuje, bi bilo do 2050 tipičnih okoli ${proj2050} ${cfg().unitLabel} na leto.`
      : `Podatki ne kažejo jasnega signala, a smer spremembe je vredna pozornosti.`;

    const plainLine = `${cfg().plainDesc(props.threshold)} Postaja ${props.label ?? ""} kaže ${sig}: grobe ${Math.abs(dpd).toFixed(1)} ${dir} ${cfg().unitLabel} na desetletje. ${forward}`;

    return { tech: techLine, plain: plainLine };
  };

  const noTrendReason = () => {
    const d = display();
    if (!d || d.trend.model_used) return null;
    const nz = d.nonzero_count;
    return `Premalo let z ${cfg().plainNoun}i za izračun trenda (${nz} let z vrednostjo > 0). Potrebnih je vsaj 10.`;
  };

  return (
    <div style={{ margin: "0 40px" }}>
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-rule)", "border-radius": "var(--radius,10px)", overflow: "hidden" }}>

        <div style={{ padding: "12px 16px 10px", "border-bottom": "1px solid var(--color-rule)", display: "flex", "align-items": "baseline", "justify-content": "space-between" }}>
          <div style={{ "font-family": "var(--font-sans)", "font-weight": "500", "font-size": "14px", color: "var(--color-ink)" }}>
            {cfg().tooltipNoun}{props.label ? ` · ${props.label}` : ""}
          </div>
          <Show when={display()}>
            {(d) => (
              <div style={{ "font-family": "var(--font-mono)", "font-size": "10px", color: "var(--color-ink-soft)", "letter-spacing": "0.06em", "text-transform": "uppercase" }}>
                {d().years.length} let · {d().nonzero_count} z vrednostjo &gt; 0
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
        </div>

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
  );
}
