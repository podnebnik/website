// Single source of "today" for the ERA5 page.
//
// Production behaviour is deliberately IDENTICAL to the inline
// `new Date().toISOString().slice(0, 10)` this replaces (AliJeVroceERA5.tsx:43,
// api.ts:382, api.ts:423): still a UTC calendar day. Moving the day boundary to
// Europe/Ljubljana is D-4, implemented in T-4.3a, and ships separately.
//
// "Single source" is a claim about READS OF THE SYSTEM CLOCK, not about every
// `new Date(...)` in the island. Re-audited by `grep -rn "new Date(" ` over
// code/ali-je-vroce-era5 on 2026-07-23 after T-2.1 deleted the five orphaned
// components; that grep returns 17 hits, 4 of which are in this file itself
// (3 in this comment, 1 the fallback below). The other 13, and why each is or
// is not a clock read:
//
//   PURE DATE ARITHMETIC on an explicit argument — 12 hits, deterministic,
//   no clock involved:
//     api.ts:103                     doy table anchor, Date.UTC(2001,0,1)
//     api.ts:505,507,535,537         parse the `date` argument and fixture rows
//     AliJeVroceERA5.tsx:29,30       parse the passed dateStr
//     charts/YearRoundChart.tsx:23,24,116  doy <-> month/day on a fixed 2001
//     components/TodayCard.tsx:64    parse the passed dateStr
//     components/RegressionPanel.tsx:27    doy label anchor
//
//   The one remaining un-routed CLOCK READ recorded here before T-2.1 was
//   components/ArsoTrendChart.tsx:25, in a file imported nowhere. T-2.1 deleted
//   it, so the island now has no un-routed clock read outside this file.
//
//   CLOCK READ, not displayed — 1 hit. A wall-clock timestamp on a diagnostic
//   record, in a module that only exists under VITE_FIXTURES=1:
//     fixtures/install.ts:176 (miss timestamp)
//
//   ROUTED THROUGH todayYear() — no longer `new Date`, listed because the
//   previous revision of this comment wrongly recorded them as left alone:
//     components/TodayTrendChart.tsx:41   current-year plotline label
//     components/TodayCard.tsx:41         year_max fallback in the blurb
//     charts/TropicalChart.tsx:101,197    current-year bar colour + its tooltip
//       (TropicalChart.tsx:102,198 after the import; :101,197 before it.)
//       These last two sit inside TropHighchart (TropicalChart.tsx:96-234),
//       imported by charts/Era5TropicalChart.tsx:3 and mounted twice on a default
//       page load (AliJeVroceERA5.tsx:279,291 — tropical days and nights). The
//       T-1.2 review scoped them out on the grounds that T-2.1/T-2.3 delete them;
//       they do not (T-2.1 deletes five other files, T-2.3 removes only the
//       sidecar config at TropicalChart.tsx:44-63), so they were live,
//       clock-driven, visible output and would have flipped the T-1.3 baseline on
//       1 January. Fixed in the follow-up commit.
//
//       ONE BEHAVIOURAL CAVEAT, deliberate: those two read
//       `new Date().getFullYear()`, the viewer's LOCAL year, and now read
//       today()'s UTC year. Identical all year except for the UTC-offset window
//       around New Year (in Ljubljana, 00:00-01:00 or 02:00 CET on 1 January).
//       Taking the UTC year is the correct end of that trade: it makes this chart
//       agree with the rest of the page, which is UTC-day throughout until D-4
//       moves the whole island to Europe/Ljubljana in T-4.3a.
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
 * The calendar year of `today()`. Four call sites, all of them visible output on
 * components that mount on a default page load, so this must move with the
 * pinned date or the T-1.1 snapshot and T-1.3 baselines change on 1 January:
 *
 *   TodayTrendChart.tsx:41   the "current year" plotline label
 *   TodayCard.tsx:41         the year_max fallback in the category blurb
 *   TropicalChart.tsx:102    highlights the current year's bar (ACCENT, 0.4)
 *   TropicalChart.tsx:198    appends "(leto v teku)" to that bar's tooltip
 *
 * The UTC year, not the local one — see the caveat in the header comment.
 */
export function todayYear(): number {
  return Number(today().slice(0, 4));
}
