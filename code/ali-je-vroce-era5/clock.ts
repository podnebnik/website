// Single source of "today" for the ERA5 page.
//
// Production behaviour is deliberately IDENTICAL to the inline
// `new Date().toISOString().slice(0, 10)` this replaces (AliJeVroceERA5.tsx:43,
// api.ts:382, api.ts:423): still a UTC calendar day. Moving the day boundary to
// Europe/Ljubljana is D-4, implemented in T-4.3a, and ships separately.
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
