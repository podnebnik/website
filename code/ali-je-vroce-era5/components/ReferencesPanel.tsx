// T-6.8 — the reference list, a third disclosure below the glossary.
//
// The methodology explains HOW the numbers are made; the glossary defines the
// TERMS; this lists the SOURCES the method rests on, so a reader can check the
// page's central claim ("we are open about our method") rather than take it on
// trust. Same disclosure treatment as the other two — a native <details>/<summary>
// inside <section class="methodology">, reusing the `.methodology-*` classes so the
// three blocks read as one mechanism — closed by default because it is reference
// prose. Native <details>/<summary> is keyboard-operable and screen-reader
// labelled with no ARIA of our own (matching the T-5.4a accessibility work).
//
// ── The [n] markers open THIS panel ──────────────────────────────────────────
// Each entry's <li> carries a stable, language-neutral id `ref-${key}`. A marker
// in the methodology prose (`[[ref:era5_land_dataset]]`, rendered by
// MethodologyPanel as a superscript link to `#ref-era5_land_dataset`) is a
// fragment link INTO this closed <details>; the browser auto-opens it on
// navigation (Baseline 2024, the exact mechanism T-6.15 established for the
// glossary) and :target briefly tints the landed entry. No hashchange handler,
// no JS of our own.
//
// ── Order and numbering come from the prose, not from here ────────────────────
// REF_ORDER (i18n/references.ts) is the marker order scanned out of
// methodologyMarkdown; we render exactly those keys, in that order, into an <ol>
// whose native 1..n numbering therefore matches the [n] on every marker. A
// catalogue entry with no marker (theil_sen / yue_wang, held pending the method
// sentence) is absent from REF_ORDER and so does not appear here — left out of the
// numbering entirely rather than orphaned.

import { For } from "solid-js";
import { references, REF_ORDER } from "../i18n/references.ts";
import { t } from "../i18n/format.ts";

export function ReferencesPanel() {
  return (
    <section class="methodology sec-p">
      <details class="methodology-details">
        <summary class="methodology-summary">{t("references.summary")}</summary>
        <div class="methodology-body">
          <ol class="methodology-references">
            <For each={REF_ORDER}>
              {(key) => {
                const entry = references[key]!;
                return (
                  <li id={`ref-${key}`} class="methodology-references-item">
                    <span class="methodology-references-desc">{entry.desc}</span>{" "}
                    <a href={entry.url} target="_blank" rel="noopener noreferrer">
                      {entry.cite}
                    </a>
                    {entry.note ? (
                      <span class="methodology-references-note">{" "}{entry.note}</span>
                    ) : null}
                  </li>
                );
              }}
            </For>
          </ol>
        </div>
      </details>
    </section>
  );
}
