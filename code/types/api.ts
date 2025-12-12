
/**
 * Lightweight compatibility barrel.
 *
 * This file intentionally does not declare types itself — it re-exports
 * the canonical `api-raw.ts` (raw external API shapes) and `models.ts`
 * (processed/UI types). Keeping this wrapper maintains backwards
 * compatibility for any imports that pointed at `code/types/api`.
 */

export * from './api-raw.js';
export * from './models.js';


