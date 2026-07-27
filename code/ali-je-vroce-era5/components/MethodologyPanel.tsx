// T-6.1 / T-6.2 — methodology as an expandable block + on-page trust furniture.
//
// T-6.1: the reviewed methodology document (data source, grid resolution, the
// 18-station national definition, the 1991–2020 baseline + SPEI carve-out, the
// fixed 6.5 °C/km lapse correction and Kredarica's −7.85 °C, timezone, "hot"
// thresholds, known limits, and the "not directly comparable to ARSO" statement)
// is rendered here, at the foot of the page, inside a native <details> disclosure
// — closed by default because it is long prose. Native <details>/<summary> is
// keyboard-operable and screen-reader-labelled with no ARIA of our own, matching
// the T-5.4a accessibility work and the existing SeaLevelWidget precedent.
//
// T-6.2 (trimmed scope, 2026-07-27): the always-visible trust strip carries the
// STATION COUNT (derived from meta.stations — never hardcoded) and the correction
// CONTACT (info@podnebnik.org). The deferred items (last-updated timestamp, data
// download link) are intentionally NOT rendered here.
//
// The prose lives VERBATIM in i18n/hero-content.ts (`methodologyMarkdown`); the
// short chrome strings come from the sl.ts catalogue via t(). Nothing Slovenian is
// hardcoded inline in this file.

import { For } from "solid-js";
import type { JSX } from "solid-js";
import { methodologyMarkdown } from "../i18n/hero-content.ts";
import { t } from "../i18n/format.ts";

// T-6.2 correction contact. A literal address, not translatable prose.
const CONTACT_EMAIL = "info@podnebnik.org";

// ── Block-level markdown renderer ───────────────────────────────────────────────
// A deliberately small parser for the exact subset METHODOLOGY.md uses, so the
// reviewed text can be stored byte-for-byte rather than hand-restructured into
// objects: `*italic*` line (subtitle / closing note), `---` rule (spacing only),
// `## heading`, `- bullet`, and the inline marks `**bold**`, `[text](href)`,
// `` `code` ``.

type Block =
  | { kind: "lede"; text: string }   // a whole line wrapped in single `*` (italic)
  | { kind: "h"; text: string }      // `## …`
  | { kind: "p"; text: string }      // paragraph
  | { kind: "ul"; items: string[] }; // consecutive `- …` lines

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;
  const flushList = () => {
    if (list) { blocks.push({ kind: "ul", items: list }); list = null; }
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line === "" || line === "---") { flushList(); continue; }
    if (line.startsWith("## ")) { flushList(); blocks.push({ kind: "h", text: line.slice(3) }); continue; }
    if (line.startsWith("- ")) { (list ??= []).push(line.slice(2)); continue; }
    flushList();
    // A line wholly wrapped in a SINGLE `*` (not `**`) is an italic note.
    if (line.length > 1 && line.startsWith("*") && !line.startsWith("**") && line.endsWith("*")) {
      blocks.push({ kind: "lede", text: line.slice(1, -1) });
      continue;
    }
    blocks.push({ kind: "p", text: line });
  }
  flushList();
  return blocks;
}

/** Render inline `**bold**`, `[text](href)` and `` `code` `` within one text run. */
function renderInline(text: string): (string | JSX.Element)[] {
  const out: (string | JSX.Element)[] = [];
  let buf = "";
  let i = 0;
  const flush = () => { if (buf) { out.push(buf); buf = ""; } };

  while (i < text.length) {
    // [text](href)
    if (text.charAt(i) === "[") {
      const close = text.indexOf("]", i);
      if (close !== -1 && text.charAt(close + 1) === "(") {
        const paren = text.indexOf(")", close + 2);
        if (paren !== -1) {
          flush();
          out.push(<a href={text.slice(close + 2, paren)}>{renderInline(text.slice(i + 1, close))}</a>);
          i = paren + 1;
          continue;
        }
      }
    }
    // **bold**
    if (text.charAt(i) === "*" && text.charAt(i + 1) === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flush();
        out.push(<strong>{renderInline(text.slice(i + 2, end))}</strong>);
        i = end + 2;
        continue;
      }
    }
    // `code`
    if (text.charAt(i) === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        out.push(<code>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    buf += text.charAt(i);
    i++;
  }
  flush();
  return out;
}

// Parsed once — the document is static.
const BLOCKS: Block[] = parseBlocks(methodologyMarkdown);

export function MethodologyPanel(props: { stationCount: number }) {
  return (
    <section class="methodology sec-p">
      <details class="methodology-details">
        <summary class="methodology-summary">{t("methodology.summary")}</summary>
        <div class="methodology-body">
          <For each={BLOCKS}>
            {(b) =>
              b.kind === "h" ? (
                <h3 class="methodology-h">{renderInline(b.text)}</h3>
              ) : b.kind === "lede" ? (
                <p class="methodology-lede"><em>{renderInline(b.text)}</em></p>
              ) : b.kind === "ul" ? (
                <ul class="methodology-ul">
                  <For each={b.items}>{(it) => <li>{renderInline(it)}</li>}</For>
                </ul>
              ) : (
                <p class="methodology-p">{renderInline(b.text)}</p>
              )
            }
          </For>
        </div>
      </details>

      {/* Always-visible trust furniture: station count (derived) + correction contact. */}
      <p class="methodology-furniture">
        <span class="methodology-furniture-stations">
          {t("methodology.stations", { count: props.stationCount })}
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
