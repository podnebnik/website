// Single source of "today" for the ERA5 page.
//
// Production behaviour is deliberately IDENTICAL to the inline
// `new Date().toISOString().slice(0, 10)` this replaces (AliJeVroceERA5.tsx:43,
// api.ts:382, api.ts:423): still a UTC calendar day. Moving the day boundary to
// Europe/Ljubljana is D-4, implemented in T-4.3a, and ships separately.
//
// "Single source" is a claim about READS OF THE SYSTEM CLOCK, not about every
// `new Date(...)` in the island. Audited by grep over code/ali-je-vroce-era5 on
// 2026-07-22; the complete set of remaining occurrences, and why each is not a
// clock read:
//
//   PURE DATE ARITHMETIC on an explicit argument — deterministic, no clock:
//     api.ts:103                     doy table anchor, Date.UTC(2001,0,1)
//     api.ts:505,507,535,537         parse the `date` argument and fixture rows
//     AliJeVroceERA5.tsx:29,30       parse the passed dateStr
//     charts/YearRoundChart.tsx:23,24,116  doy <-> month/day on a fixed 2001
//     components/TodayCard.tsx:61    parse the passed dateStr
//     components/RegressionPanel.tsx:27    doy label anchor
//     components/RegressionSection.tsx:18  doy label anchor
//
//   CLOCK READS, still present, NOT routed here in this pass:
//
//     components/ArsoTrendChart.tsx:25 — genuinely orphaned (imported nowhere),
//       deleted by T-2.1. Whoever revives it must switch it to todayYear().
//
//     charts/TropicalChart.tsx:101,197 — !! NOT DEAD CODE !! Both sit inside
//       TropHighchart (TropicalChart.tsx:95-233), which is imported by
//       charts/Era5TropicalChart.tsx:3 and mounted at AliJeVroceERA5.tsx:279,291.
//       T-2.1 does not delete this file, and T-2.3 removes only the sidecar
//       config at TropicalChart.tsx:44-63 — TropHighchart survives both. Line 101
//       colours the current year's bar ACCENT at 0.4 opacity and line 197 appends
//       "(leto v teku)" to its tooltip, so BOTH ARE VISIBLE OUTPUT DRIVEN BY THE
//       SYSTEM CLOCK, on a chart a default page load renders twice (days and
//       nights). They are the same defect this file exists to fix and they will
//       flip the T-1.3 baseline on 1 January. Left untouched only because the
//       T-1.2 review explicitly scoped them out on the (mistaken) grounds that
//       they were orphaned; see PROGRESS.md 2026-07-22 review entry.
//
//   CLOCK READ, not displayed — a wall-clock timestamp on a diagnostic record,
//   in a module that only exists under VITE_FIXTURES=1:
//     fixtures/install.ts (miss timestamp)
//
//   CLOCK READ, intentional, inside this file:
//     the production fallback in today() below
//
// The overrides exist only so the output snapshot (T-1.1) and the visual
// baselines (T-1.3) can pin the date. They are gated on a dev server or a
// fixture build, so a production bundle reads the system clock and nothing else
// — in particular `window.__PODNEBNIK_TODAY__` is inert in production and cannot
// be used to spoof the displayed date.

declare global {
  interface Window {
    __PODNEBNIK_TODAY__?: string;
  }
}

const OVERRIDES_ALLOWED =
  import.meta.env.DEV === true || import.meta.env.VITE_FIXTURES === "1";

const PINNED_DATE = (import.meta.env.VITE_PINNED_DATE as string | undefined) ?? "";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function today(): string {
  if (OVERRIDES_ALLOWED) {
    // Build-time pin (VITE_PINNED_DATE) wins; the window global is the escape
    // hatch for Playwright, which injects before page scripts run.
    if (ISO_DATE.test(PINNED_DATE)) return PINNED_DATE;
    const injected = typeof window !== "undefined" ? window.__PODNEBNIK_TODAY__ : undefined;
    if (injected && ISO_DATE.test(injected)) return injected;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * The calendar year of `today()`. Rendered directly by TodayTrendChart.tsx:41
 * (the "current year" plotline label, on a component that mounts unconditionally)
 * and TodayCard.tsx:41 (the year_max fallback in the category blurb), so it must
 * move with the pinned date or the T-1.1 snapshot changes on 1 January.
 */
export function todayYear(): number {
  return Number(today().slice(0, 4));
}
