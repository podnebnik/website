// T-6.2 / T-6.22 — the always-visible trust furniture at the foot of the ERA5 page.
//
// HISTORY: this file once rendered the full methodology document (T-6.1) inside a
// <details> disclosure, with the glossary (T-6.14) and references (T-6.8) as sibling
// disclosures. T-6.22 MOVED all three bodies to standalone plain-markdown site pages
// (pages/methodology.md — which now also carries the glossary links and the numbered
// references — and pages/glossary.md), reachable from the footer. What STAYS on the
// chart page is only the one closing line the reader needs in context: the derived
// station count and the correction contact. The disclosure, the block-markdown parser,
// the [[ref:…]] marker rendering and the elevation-band table all left with the prose.
//
// The furniture carries the STATION COUNT (derived from meta.stations — never
// hardcoded) and the correction CONTACT (info@podnebnik.org). Nothing Slovenian is
// hardcoded here: the short chrome strings come from the sl.ts catalogue via t().

import type { SiteMeta } from "../types.ts";
import { t } from "../i18n/format.ts";

// T-6.2 correction contact. A literal address, not translatable prose.
const CONTACT_EMAIL = "info@podnebnik.org";

export function MethodologyPanel(props: { stations: SiteMeta["stations"] }) {
  return (
    <section class="methodology sec-p">
      {/* Always-visible trust furniture: station count (derived) + correction contact. */}
      <p class="methodology-furniture">
        <span class="methodology-furniture-stations">
          {t("methodology.stations", { count: props.stations.length })}
        </span>
        <span class="methodology-furniture-sep" aria-hidden="true">·</span>
        <span class="methodology-furniture-contact">
          {t("methodology.contact_label")}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </span>
      </p>
    </section>
  );
}
