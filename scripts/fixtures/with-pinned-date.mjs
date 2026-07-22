#!/usr/bin/env node
// T-1.2 — single source for the pinned fixture date.
//
// `tests/fixtures/manifest.json` `primary_date` is the ONE place the pinned date
// is written. The recorder reads it directly; this wrapper hands the same value
// to the app as VITE_PINNED_DATE, so `yarn fixtures:start` and
// `yarn fixtures:build` cannot drift from the matrix that was recorded.
//
//     node scripts/fixtures/with-pinned-date.mjs <command> [args…]
//
// Sets VITE_FIXTURES=1 and VITE_PINNED_DATE, then execs the command.
//
// The runtime backstop is in code/ali-je-vroce-era5/fixtures/install.ts, which
// compares index.json `primary_date` against what clock.ts actually returns and
// throws on a mismatch — so starting the app WITHOUT this wrapper also fails
// loudly rather than quietly requesting unrecorded URLs.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MANIFEST = join(ROOT, "tests", "fixtures", "manifest.json");

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const pinned = manifest.primary_date;

if (typeof pinned !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(pinned)) {
  console.error(`[fixtures] manifest.json \`primary_date\` is not an ISO date: ${JSON.stringify(pinned)}`);
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/fixtures/with-pinned-date.mjs <command> [args…]");
  process.exit(1);
}

console.log(`[fixtures] VITE_FIXTURES=1 VITE_PINNED_DATE=${pinned} (from tests/fixtures/manifest.json)`);

const child = spawn(cmd, args, {
  stdio: "inherit",
  env: { ...process.env, VITE_FIXTURES: "1", VITE_PINNED_DATE: pinned },
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
