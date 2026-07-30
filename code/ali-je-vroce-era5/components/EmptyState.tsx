import type { JSXElement } from "solid-js";
import { t } from "../i18n/format.ts";

// T-5.14 — the ONE visible empty state for a section whose fetch resolved to no
// rows. Distinct from SectionError: datasette returns 200 + [] for a genuinely
// empty (or, for SPEI, a D-16-withheld) result, so `dsGet`'s !resp.ok guard
// never fires and this is NOT an error — the reader sees a section heading with
// nothing beneath it and no signal whether the page is broken or the data is
// simply absent. This renders the shared `common.no_data` message where the body
// would be, matching the lighter reg.no_data treatment (a centred, muted line —
// no box; the boxed treatment is reserved for the error state).
//
// role="status" (polite) so a screen reader announces it when it appears after a
// station change; the boxed error uses role="alert" (assertive) for the same
// reason at a higher urgency.
//
// `style()` keys are kebab-case on purpose: Solid's style() calls setProperty(),
// so a camelCase key is silently dropped (see CLAUDE.md "Solid's style()
// silently ignores camelCase properties").
export function EmptyState(props: { minHeight?: string | undefined }): JSXElement {
  return (
    <div
      role="status"
      style={{
        flex:              "1",
        display:           "flex",
        "align-items":     "center",
        "justify-content": "center",
        "min-height":      props.minHeight ?? "160px",
        padding:           "20px",
        "text-align":      "center",
        color:             "var(--color-ink-soft)",
        "font-family":     "var(--font-sans)",
        "font-size":       "13px",
        "line-height":     "1.5",
      }}
    >
      {t("common.no_data")}
    </div>
  );
}
