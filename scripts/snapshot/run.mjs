#!/usr/bin/env node
// T-1.1 — snapshot harness entry point.
//
//     yarn snapshot                       # write tests/fixtures/snapshot.json
//     yarn snapshot --out /tmp/a.json     # write somewhere else (used by --verify)
//     yarn snapshot --simulate-date 2027-01-01T03:00:00Z
//     yarn snapshot --verify              # the T-1.1 done-when, self-contained
//
// This file exists only to fix the environment before Node reads it. Three
// process-level settings are baked into rendered output and are read ONCE at
// interpreter start, so they cannot be set from inside the harness:
//
//   TZ=UTC        The island is UTC-day throughout (clock.ts), and date parsing
//                 in api.ts:505,507,535,537 goes through the local timezone.
//                 D-4/T-4.3a moves the page to Europe/Ljubljana; this pin moves
//                 with it, deliberately, as a reviewed snapshot diff.
//   LANG/LC_ALL   TodayCard.tsx:170,225 and HeroCards.tsx render sample counts
//                 through Number.prototype.toLocaleString(), so the thousands
//                 separator is a function of the machine's locale. Pinning it
//                 makes the snapshot a property of the repo rather than of the
//                 developer who ran it.
//
// The harness re-asserts all three from inside (scripts/snapshot/main.mjs) so a
// machine whose ICU disagrees fails loudly instead of writing a snapshot that
// only reproduces locally.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MAIN = fileURLToPath(new URL("./main.mjs", import.meta.url));

const PINNED_ENV = {
  TZ: "UTC",
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
};

function runChild(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [MAIN, ...args], {
      stdio: "inherit",
      env: { ...process.env, ...PINNED_ENV },
      cwd: ROOT,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const argv = process.argv.slice(2);

if (!argv.includes("--verify")) {
  process.exitCode = await runChild(argv);
} else {
  // ── The T-1.1 done-when, as one command ───────────────────────────────────
  //
  // "Running the harness twice on two different simulated system dates produces
  // byte-identical output." Run 1 uses the real system clock. Run 2 replaces the
  // global Date with one frozen at 2027-01-01T03:00:00Z — a different day, a
  // different YEAR, and specifically the New Year rollover that the two clock
  // leaks fixed during T-1.2 (TodayTrendChart.tsx:41, TropicalChart.tsx:102)
  // would have flipped. If any un-pinned clock read reaches rendered output, the
  // two files differ and this exits non-zero.
  const a = join(tmpdir(), `podnebnik-snapshot-a-${process.pid}.json`);
  const b = join(tmpdir(), `podnebnik-snapshot-b-${process.pid}.json`);

  console.log("── run 1: real system clock ───────────────────────────────────");
  let code = await runChild(["--out", a]);
  if (code !== 0) process.exit(code);

  console.log("\n── run 2: system clock faked to 2027-01-01T03:00:00Z ──────────");
  code = await runChild(["--out", b, "--simulate-date", "2027-01-01T03:00:00Z"]);
  if (code !== 0) process.exit(code);

  const bufA = readFileSync(a);
  const bufB = readFileSync(b);
  const identical = bufA.equals(bufB);

  console.log("\n── done-when ──────────────────────────────────────────────────");
  console.log(`  run 1 (${new Date().getFullYear()} clock) : ${bufA.length} bytes`);
  console.log(`  run 2 (2027-01-01 clock)  : ${bufB.length} bytes`);
  console.log(`  byte-identical            : ${identical ? "YES" : "NO"}`);

  if (!identical) {
    console.error(
      `\nThe two runs differ, so some rendered value still reads the system clock ` +
        `rather than the pinned date. Compare with:\n  diff ${a} ${b}\n` +
        `Nothing was written to tests/fixtures/snapshot.json.`,
    );
    process.exit(1);
  }

  rmSync(a, { force: true });
  rmSync(b, { force: true });

  console.log("\n── writing tests/fixtures/snapshot.json ───────────────────────");
  process.exitCode = await runChild([]);
}
