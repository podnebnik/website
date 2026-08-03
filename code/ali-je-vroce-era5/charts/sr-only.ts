// T-5.4a / T-5.41 — visually-hidden (screen-reader-only) style, shared by the
// heatmap data-table fallbacks (SeasonHeatmap, SpeiHeatmap). One definition so a
// future component cannot inherit a stale copy.
//
// ⚠ Apply this to a BLOCK WRAPPER (a <div>), never directly to a <table> or any
// other intrinsically-sized / replaced element. Table layout treats width/height
// as MINIMUMS and expands to its content, so the 1px clamp is silently ignored;
// `clip` then clips only the painting, not the layout box, leaving a full-size
// position:absolute box. With no positioned ancestor its containing block is the
// initial containing block (<html>), so it extends the document's scroll height —
// the empty space below the footer fixed in T-5.41. A block <div> honours
// width:1px + height:1px + overflow:hidden and clips the table inside.
//
// Kebab-case keys because Solid's style() calls setProperty() and silently drops
// camelCase.
export const SR_ONLY = {
  position: "absolute", width: "1px", height: "1px", padding: "0",
  margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)",
  "white-space": "nowrap", border: "0",
} as const;
