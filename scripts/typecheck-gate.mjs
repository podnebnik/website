#!/usr/bin/env node
// Typecheck gate for CI (ticket T-3.7).
//
// `tsc --noEmit` on this repo exits 0 as of T-5.8, which resolved the last of
// the tolerated Highcharts typings errors — tests/typecheck-allowlist.txt is now
// empty. This gate asserts the live error set is EXACTLY that allowlist, keyed by
// file, line, column and error code; with the list empty it asserts ZERO errors.
// Any drift — a new error, or a future re-added allowlist entry disappearing —
// fails, loudly, and says what to do. (History: the allowlist once carried 8
// deliberately-unsuppressed Highcharts 12.6.0 mismatches; a bare `|| true` would
// have let a real regression slip through as one got fixed, hence this gate.)
//
// Exit 0: live set == allowlist. Exit 1: any difference (or tsc crashed).

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowlistPath = join(repoRoot, 'tests', 'typecheck-allowlist.txt');

// A primary tsc error line starts at column 0 (the path); the follow-on detail
// lines are indented. Capture `path(line,col): error TSxxxx`, normalise to
// `path(line,col): TSxxxx` — location + code, no message text (which shifts
// with the Highcharts version).
const ERROR_RE = /^(\S.*\(\d+,\d+\)): error (TS\d+)/;

function parseErrors(text) {
  const out = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = ERROR_RE.exec(line);
    if (m) out.add(`${m[1]}: ${m[2]}`);
  }
  return out;
}

function loadAllowlist() {
  const raw = readFileSync(allowlistPath, 'utf8');
  const out = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith('#')) out.add(t);
  }
  return out;
}

// Run the same compiler invocation as `yarn typecheck` (tsc --noEmit), from the
// repo root, capturing output regardless of the (expected non-zero) exit code.
const tscBin = join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const res = spawnSync(tscBin, ['--noEmit'], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (res.error) {
  console.error(`typecheck-gate: could not run tsc: ${res.error.message}`);
  process.exit(1);
}

const output = `${res.stdout || ''}${res.stderr || ''}`;
const live = parseErrors(output);
const allow = loadAllowlist();

const unexpected = [...live].filter((e) => !allow.has(e)).sort();
const missing = [...allow].filter((e) => !live.has(e)).sort();

if (unexpected.length === 0 && missing.length === 0) {
  console.log(`typecheck-gate: OK — exactly the ${allow.size} allowlisted Highcharts typings errors, nothing else.`);
  process.exit(0);
}

console.error('typecheck-gate: FAIL — the TypeScript error set no longer matches tests/typecheck-allowlist.txt.\n');

if (unexpected.length > 0) {
  console.error('  NEW / UNEXPECTED errors (a regression — fix your code, do NOT add them to the allowlist):');
  for (const e of unexpected) console.error(`    + ${e}`);
  console.error('');
}

if (missing.length > 0) {
  console.error('  ALLOWLISTED errors that are GONE (you fixed or moved one of the known 8 — good, but you MUST');
  console.error('  update tests/typecheck-allowlist.txt in the same commit so the gate tracks reality):');
  for (const e of missing) console.error(`    - ${e}`);
  console.error('');
}

console.error(`  Live errors: ${live.size}. Allowlisted: ${allow.size}.`);
console.error('  If a Highcharts bump or T-5.8 legitimately changed these, regenerate the list — see the header');
console.error('  of tests/typecheck-allowlist.txt — and commit it alongside the code change.');
process.exit(1);
