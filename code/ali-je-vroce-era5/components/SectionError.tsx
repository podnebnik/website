import { Show } from "solid-js";
import type { JSXElement } from "solid-js";
import { t } from "../i18n/format.ts";

// T-5.1 — the ONE visible error state for a failed section fetch, reused at every
// section boundary. Before this, a failed section fetch either vanished (the
// tropical/SPEI helpers swallowed the error into an `available:false` sentinel and
// the `<Show>` rendered nothing) or blanked its subtree (an unguarded throw from
// dsGet / JSON.parse propagated with no boundary). Both are silent failures: the
// reader sees missing data with no signal that anything went wrong. This renders a
// message the reader can see instead.
//
// `style()` keys are kebab-case on purpose: Solid's style() calls setProperty(), so
// a camelCase key is silently dropped (see CLAUDE.md "Solid's style() silently
// ignores camelCase properties").
export function SectionError(props: { onRetry?: (() => void) | undefined; minHeight?: string | undefined }): JSXElement {
  return (
    <div
      role="alert"
      style={{
        "min-height":      props.minHeight ?? "120px",
        display:           "flex",
        "flex-direction":  "column",
        "align-items":     "center",
        "justify-content": "center",
        gap:               "10px",
        padding:           "20px",
        "text-align":      "center",
        border:            "1px solid var(--color-rule)",
        "border-radius":   "var(--radius, 10px)",
        background:        "var(--color-paper-2)",
        color:             "var(--color-ink-soft)",
        "font-family":     "var(--font-sans)",
        "font-size":       "13px",
        "line-height":     "1.5",
      }}
    >
      <span>{t("error.section")}</span>
      <Show when={props.onRetry}>
        <button
          type="button"
          onClick={() => props.onRetry!()}
          style={{
            "font-family":   "var(--font-mono)",
            "font-size":     "11px",
            "letter-spacing":"0.06em",
            "text-transform":"uppercase",
            color:           "var(--color-ink)",
            background:      "var(--color-card)",
            border:          "1px solid var(--color-rule-2)",
            "border-radius": "7px",
            padding:         "5px 12px",
            cursor:          "pointer",
          }}
        >
          {t("error.retry")}
        </button>
      </Show>
    </div>
  );
}

// Fallback factory for <ErrorBoundary fallback={…}>. Keeps the boundaries uniform:
// each call site passes only its resource's refetch (so "Poskusi znova" genuinely
// re-fetches rather than just re-mounting an already-errored resource) and, if it
// wants, a min-height so the error box matches the chart it replaces. The failure
// is also logged, so it is visible in the console, not only on screen.
export function sectionErrorFallback(
  retry?: () => void,
  minHeight?: string,
): (err: unknown, reset: () => void) => JSXElement {
  return (err, reset) => {
    console.error("[section] failed to load:", err);
    return (
      <SectionError
        minHeight={minHeight}
        onRetry={retry ? () => { retry(); reset(); } : undefined}
      />
    );
  };
}
