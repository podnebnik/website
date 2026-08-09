// T-5.71 — DEFER + IDLE-PREFETCH mount wrapper.
//
// WHY. On first load the page mounted eight Highcharts instances (the gauge plus
// seven charts) in one shot. The measured symptom (PROGRESS T-5.71) was a single
// 1.5–2.0 s monolithic main-thread task — Solid render + eight chart constructions
// in one block. A desktop absorbs it; an iPhone drops frames and the gauge needle
// visibly janks mid-sweep. This wrapper keeps everything below the gauge card OUT
// of that first-paint block: a chart mounts only when it scrolls into view, and —
// separately — the remaining ones mount ONE AT A TIME once the main thread is idle,
// so a reader who scrolls usually finds them already there.
//
// TWO INDEPENDENT TRIGGERS, one idempotent reveal (the double-mount guard):
//   1. IntersectionObserver — mounts the moment the placeholder nears the viewport.
//   2. Idle queue — a shared FIFO drained ONE entry PER idle callback, so the
//      browser can interleave and the mount storm never re-forms elsewhere.
// Both call the same `reveal()`, which flips a single boolean signal. Setting it
// true twice is a no-op (Solid signal equality), and <Show> mounts its child
// exactly once — so intersection and idle can never double-mount.
//
// ⚠ requestIdleCallback IS NOT SUPPORTED IN SAFARI / iOS WebKit — the very device
// this ticket exists for. The feature test below falls back to setTimeout, so on
// iOS the "idle" prefetch degrades to "after a short delay", NOT a true idle
// signal. Intersection still fires normally on iOS, so a chart the reader actually
// scrolls to always mounts on time regardless.
//
// ⚠ HARNESS/SSR SAFETY. jsdom (the snapshot harness) exposes no IntersectionObserver;
// when it is absent we reveal IMMEDIATELY and never touch the idle queue, so the
// wrapped child mounts synchronously exactly as before. (In practice the harness
// mounts leaf charts directly and never instantiates this wrapper at all — this
// guard just makes the component correct anywhere it might run without IO.)

import { createSignal, onMount, onCleanup, Show, type JSX } from "solid-js";

// Shared idle-prefetch queue across every DeferMount on the page. FIFO, so charts
// prefetch in document (mount) order — top of the page first.
const idleQueue: Array<() => void> = [];
let pumping = false;

// requestIdleCallback where available (Chrome/Firefox), setTimeout fallback for
// Safari/iOS WebKit. The timeout arm is deliberately short: it is a background
// prefetch, and intersection is what guarantees on-time mounts for scrolled-to
// content, so this only needs to be "soon after idle-ish", not precise.
const scheduleIdle: (cb: () => void) => void =
  typeof window !== "undefined" && typeof (window as unknown as {
    requestIdleCallback?: unknown;
  }).requestIdleCallback === "function"
    ? (cb) => (window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
      }).requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => { setTimeout(cb, 200); };

// Drain the queue one entry per callback so the browser interleaves other work
// (paint, the gauge sweep) between chart mounts. Mounting several per callback
// would just recreate the storm in a different place.
function pump(): void {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const next = idleQueue.shift();
    if (!next) { pumping = false; return; }
    next(); // idempotent reveal — a no-op if intersection already mounted this one
    if (idleQueue.length > 0) scheduleIdle(step);
    else pumping = false;
  };
  scheduleIdle(step);
}

export function DeferMount(props: {
  children: JSX.Element;
  /** Placeholder height so layout does not jump before the chart mounts. */
  minHeight: string;
  /** How early (before entering the viewport) to mount. Default 300px. */
  rootMargin?: string;
}): JSX.Element {
  const [shown, setShown] = createSignal(false);
  let disposed = false;
  let placeholder: HTMLDivElement | undefined;

  // The single reveal both triggers share. Idempotent, and guarded against a
  // late idle callback firing after the wrapper was disposed.
  const reveal = () => { if (!disposed) setShown(true); };

  onMount(() => {
    // No IntersectionObserver (jsdom/SSR) → never defer; mount now.
    if (typeof IntersectionObserver !== "function") { reveal(); return; }

    // (d) idle prefetch — mount in the background when the thread is idle.
    idleQueue.push(reveal);
    pump();

    // (a) intersection — mount immediately when scrolled near view. Wins the race
    // for content the reader actually reaches before the idle queue does.
    if (placeholder) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { reveal(); io.disconnect(); }
      }, { rootMargin: props.rootMargin ?? "300px" });
      io.observe(placeholder);
      onCleanup(() => io.disconnect());
    }
  });

  onCleanup(() => { disposed = true; });

  return (
    <Show
      when={shown()}
      fallback={<div ref={placeholder} style={{ "min-height": props.minHeight }} aria-hidden="true" />}
    >
      {props.children}
    </Show>
  );
}
