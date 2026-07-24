// Types for the `import.meta.env` values this island reads.
//
// Deliberately *not* `/// <reference types="vite/client" />`: that declaration
// carries an `[key: string]: any` index signature, so every misspelled variable
// would type-check as `any`. Listing the four we actually use keeps a typo a
// compile error. Each is optional because Vite only defines a variable when it
// is present in the environment at build time.
interface ImportMetaEnv {
  /** Vite's own flag: true in `vite dev`, false in a production build. */
  readonly DEV: boolean;
  /** Datasette origin override for local dev (see api.ts:12). */
  readonly VITE_DATASETTE_URL?: string;
  /** "1" installs the recorded fetch fixtures (see entry.tsx:16). */
  readonly VITE_FIXTURES?: string;
  /** ISO date pinning "today" for reproducible snapshots (see clock.ts:76). */
  readonly VITE_PINNED_DATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Vite resolves a side-effect CSS import to an injected stylesheet; there is no
// module shape to describe, but `tsc` still needs the specifier to resolve
// (SeaLevelWidget.tsx:3 imports leaflet's stylesheet this way).
declare module "*.css";
