// T-6.14 — the glossary of terms, a sibling disclosure below the methodology.
//
// Companion to MethodologyPanel: the methodology explains HOW the numbers are
// made; this defines the TERMS a layperson cannot be expected to know. Same
// disclosure treatment — a native <details>/<summary> inside a
// <section class="methodology">, reusing the `.methodology-*` classes so the two
// blocks read as one mechanism — closed by default because it is long reference
// prose. Native <details>/<summary> is keyboard-operable and screen-reader
// labelled with no ARIA of our own (matching the T-5.4a accessibility work).
//
// Self-contained by design (the operator intends to relocate the glossary to its
// own menu page later): the term/definition CATALOGUE lives in i18n/glossary.ts
// and the rendering lives here — a relocation, not a rewrite. The only Slovenian
// hardcoded nowhere: the heading comes from t("glossary.summary") (sl.ts), the
// entries from the glossary catalogue.
//
// ── Display order ────────────────────────────────────────────────────────────
// The catalogue does NOT encode display order (a hardcoded Slovenian-alphabetical
// array would be wrong under translation and mis-sorts č/š/ž). The list is sorted
// HERE, at render time, with Intl.Collator(LOCALE) on the visible `term` label —
// LOCALE ("sl-SI") is the single locale boundary in i18n/format.ts. A second
// locale re-sorts itself for free.

import { For } from "solid-js";
import { glossary } from "../i18n/glossary.ts";
import { t } from "../i18n/format.ts";
import { LOCALE } from "../i18n/format.ts";

// Locale-aware collation on the visible term. `numeric` keeps "ERA5" / "SPEI-3"
// ordering sane; sensitivity "base" folds case so an acronym and a lower-case
// concept interleave alphabetically rather than splitting into two blocks.
const collator = new Intl.Collator(LOCALE, { numeric: true, sensitivity: "base" });

// Sorted once — the catalogue is static.
const ENTRIES = Object.values(glossary)
  .slice()
  .sort((a, b) => collator.compare(a.term, b.term));

export function GlossaryPanel() {
  return (
    <section class="methodology sec-p">
      <details class="methodology-details">
        <summary class="methodology-summary">{t("glossary.summary")}</summary>
        <div class="methodology-body">
          <dl class="methodology-glossary">
            <For each={ENTRIES}>
              {(e) => (
                <>
                  <dt class="methodology-glossary-term">{e.term}</dt>
                  <dd class="methodology-glossary-def">{e.def}</dd>
                </>
              )}
            </For>
          </dl>
        </div>
      </details>
    </section>
  );
}
