// Per-device UI preferences — the FIRST browser-stored state on this page.
//
// T-6.5 tier 0 established that the page persisted NOTHING before T-5.35 (no URL
// state, no cookies, no storage of any kind). This module is that seam: a single
// localStorage key, PAGE-SCOPED (not named for any one feature), holding a small
// JSON object so every future per-device UI preference shares ONE key instead of
// littering the origin. Add fields to `UiPrefs`; reuse `readUiPrefs`/`writeUiPref`.
//
// It stores only non-identifying booleans/flags. It is NOT for shareable state —
// the selected station and date belong in the URL (T-5.29), a different mechanism.
//
// Every access is wrapped in try/catch and FAILS TOWARD "not set": if storage is
// unavailable (private browsing, disabled, quota), a read returns {} and a write is
// silently dropped, so a one-time cue simply shows again rather than erroring. No
// caller may depend on storage to function — it only remembers, never gates.
const KEY = "podnebnik:ali-je-vroce";

export interface UiPrefs {
  // T-5.35 — set once the reader has opened the floating location chooser, so the
  // first-use attention cue (accent ring + finite ripple + hero label) is shown
  // only until the control has been discovered.
  locChooserSeen?: boolean;
}

export function readUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UiPrefs) : {};
  } catch {
    return {}; // storage unavailable → treat as fresh; any one-time cue shows again
  }
}

export function writeUiPref<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]): void {
  try {
    const cur = readUiPrefs();
    cur[key] = value;
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* write unavailable (private mode / quota) → the flag is not remembered and the
       cue re-shows next visit; never surfaced as an error, control still works */
  }
}
