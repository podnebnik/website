"""
T-5.17 — a committed sha256 manifest of the derived tables, so a pipeline change
that MOVES published output fails CI until the manifest is updated in the same commit.

Why this exists
---------------
`yarn snapshot:check` records its fixtures from the STAGE datasette, which serves the
last DEPLOYED image. A pipeline-side change (precompute_datasette.py, si.yaml, the raw
CSVs) does not reach stage until the image is rebuilt AND redeployed, so a green
snapshot proved only that the FRONTEND did not move — never that the PIPELINE did not.
T-4.2 changed the anomaly baseline and the season-heatmap anomaly it moved stayed
invisible to the fixtures for a whole phase (see DECISIONS D-3/T-4.2, PROGRESS T-4.3b).

This is T-5.3a's one-off `sha256 + diff -rq` proof made permanent, and it does not
depend on stage at all. It fires ONLY when the derived output actually moves — the real
signal — and the fix is the same deliberate, reviewable act re-recording fixtures already
is: regenerate and commit the new manifest, in the same commit that moved the numbers.

Self-diagnosis (T-5.17 amendment)
---------------------------------
The gate fires in the amd64 `generate-db` job, and the amd64 CSV it built is never
uploaded — so the check must explain itself from what it has. The manifest therefore
carries, besides the file-level hash that IS the gate, a per-COLUMN hash for every table.
On failure the check names the exact column(s) whose bytes moved, which is usually enough
to tell a fitted display statistic (tropical's `trend_json`, output of an iterative
NB-GLM whose optimiser path is architecture-sensitive) from a deterministic COUNT
(`counts_json`, `years_json`, `nonzero_count`) that a reader sees and that must never
differ across machines. Point `--reference <dir>` at the other CSV set (when both are on
one machine) to also get bounded row-level diffs with both sides — for a long JSON column
it reports the differing JSON KEY and its two values, not the whole blob.

Gated vs informational columns
------------------------------
`tropical.trend_json` is the output of that iterative fit and DID differ between amd64 and
aarch64 (T-5.17 amendment), so it is listed in GATE_EXCLUDED: still hashed and recorded,
its drift printed as a NOTE, but never failing the build — demanding byte-identity from an
optimiser across architectures would guarantee recurring false failures. Every other
column, including the tropical COUNTS, stays gated. GATE_EXCLUDED is the single source of
truth; the manifest header is generated from it so the file always states its exclusions.

What is hashed, and where it runs
---------------------------------
The nine derived CSV EXPORTS (export_datasette_csv.py output: pandas to_csv, index-less,
NaN → ""), NOT the sqlite files (SQLite is not byte-stable) and NOT the in-memory to_sql
tables (those carry `null` where an absent station_id is served as ""). The exports are
what `invoke create-databases` imports verbatim, so hashing them ties the manifest to what
production serves.

Determinism was verified before relying on it (T-5.17): two full precompute+export runs on
the same inputs produced byte-identical CSVs on all nine tables, and forcing a different
BLAS thread count (a reduction-order perturbation of the same class as a cross-architecture
ULP difference) changed nothing. precompute rounds every value to a fixed number of
decimals and uses no RNG, no wall-clock and no set/dict ordering in its output.

⚠ The manifest is an amd64 artifact by construction: generation runs ONCE, on native
amd64, in the `generate-db` job (T-5.9), and this check runs in the same builder. Do NOT
regenerate it under emulation — emulated-amd64 floating point is not native amd64.

Usage
-----
    # check (default): compare freshly-exported CSVs against the committed manifest
    TABLES_DIR=/build/data/climate-si/data \
        python check_table_hashes.py --manifest data/climate-si/derived-tables.sha256

    # check with row-level diffs against another CSV set (both must be local)
    TABLES_DIR=.../amd64  python check_table_hashes.py --reference .../aarch64

    # write: regenerate the manifest after a DELIBERATE pipeline change
    TABLES_DIR=.../data python check_table_hashes.py --write \
        --manifest data/climate-si/derived-tables.sha256
"""

import argparse
import csv
import hashlib
import json
import os
import sys
from pathlib import Path

# One canonical table list, shared with the pipeline validator so the two cannot drift
# (same reasoning as D-18's single column declaration).
from validate import TABLE_NAMES

# Defaults mirror validate.py: TABLES_DIR is where export_datasette_csv.py writes the nine
# climate-si.<table>.csv files; the manifest sits beside datapackage.yaml as a peer data
# contract for the derived tables.
DEFAULT_TABLES_DIR = Path(__file__).parent.parent / "data"
DEFAULT_MANIFEST = Path(__file__).parent.parent / "derived-tables.sha256"

# How much of a failing diff to print — enough to diagnose, never the whole table.
_MAX_DIFF_ROWS = 8
_MAX_VAL = 160

# ── Columns EXCLUDED from the gate (T-5.17 amendment) ────────────────────────────
# A column listed here is still hashed and recorded, but a mismatch is reported as
# INFORMATIONAL and does NOT fail the build. This is the ONLY source of truth for the
# exclusion — the manifest header is generated from it, so the two cannot drift, and
# removing an entry here makes the gate fail-closed (the column becomes gated again).
#
# `tropical.trend_json` is excluded because it is the output of an iterative
# negative-binomial GLM fit (precompute_datasette.py:_tropical_trend). An optimiser's
# convergence path is architecture-sensitive: amd64 and aarch64 differ in the last
# digits, and a marginal fit can converge on one and fail (→ withheld `{}`) on the
# other — CI showed 30 fit failures on amd64 vs 28 on aarch64. Demanding byte-identity
# from that across architectures guarantees recurring false failures. The COUNTS a
# reader sees (counts_json, years_json, nonzero_count) are deterministic and stay
# GATED. The fit-failure behaviour itself is tracked as a separate finding, not here.
GATE_EXCLUDED: dict[str, dict[str, str]] = {
    "tropical": {
        "trend_json":
            "iterative negative-binomial fit; optimiser path is architecture-sensitive "
            "(30 fit failures on amd64 vs 28 on aarch64), so byte-identity across "
            "architectures cannot be required. Recorded as informational so drift stays "
            "visible without failing the build. Gated counts: counts_json, years_json, "
            "nonzero_count. See T-5.17.",
    },
}


def _is_excluded(table: str, column: str) -> bool:
    return column in GATE_EXCLUDED.get(table, {})


def _csv_path(tables_dir: Path, name: str) -> Path:
    return tables_dir / f"climate-si.{name}.csv"


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fo:
        for chunk in iter(lambda: fo.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _column_hashes(path: Path) -> dict[str, str]:
    """sha256 per column, over the RAW csv cell strings in row order — no float reparse,
    so the diagnostic introduces no noise of its own. Order-sensitive, so it moves iff a
    cell in that column moves."""
    with open(path, newline="") as fo:
        reader = csv.reader(fo)
        header = next(reader, [])
        hs = [hashlib.sha256() for _ in header]
        for row in reader:
            for i, cell in enumerate(row):
                if i < len(hs):
                    hs[i].update(cell.encode("utf-8"))
                    hs[i].update(b"\n")
    return {col: hs[i].hexdigest() for i, col in enumerate(header)}


def _compute(tables_dir: Path) -> dict[str, dict]:
    """For every derived table: its file hash and per-column hashes. Missing file → exit."""
    out: dict[str, dict] = {}
    for name in TABLE_NAMES:
        path = _csv_path(tables_dir, name)
        if not path.exists():
            sys.exit(
                f"derived CSV not found: {path}\n"
                f"Run precompute_datasette.py then export_datasette_csv.py first."
            )
        out[name] = {"file": _file_hash(path), "columns": _column_hashes(path)}
    return out


def _manifest_header() -> str:
    """Generated FROM GATE_EXCLUDED so the file always states its own exclusions and the
    reason, and never drifts from the code that enforces them."""
    out = [
        "# T-5.17 — sha256 manifest of the nine derived CSV exports.",
        "# Recomputed by the datasette image build (generate-db, amd64); the build FAILS",
        "# if any GATED column moved without this file being updated in the same commit.",
        "# Each table has a file-level hash and one hash per column, `<file>#<column>`.",
        "# The gate uses the file hash for tables with no excluded column, and the",
        "# per-column hashes for tables that have one.",
        "#",
        "# EXCLUDED FROM THE GATE — recorded as informational; a mismatch is REPORTED,",
        "# never fails the build. Do not gate these (see GATE_EXCLUDED in",
        "# check_table_hashes.py, the single source of truth):",
    ]
    for table in sorted(GATE_EXCLUDED):
        for col, reason in GATE_EXCLUDED[table].items():
            out.append(f"#   climate-si.{table}.csv#{col}")
            words, line = reason.split(), "#     "
            for w in words:
                if len(line) + len(w) + 1 > 78:
                    out.append(line)
                    line = "#     " + w
                else:
                    line += (" " if line != "#     " else "") + w
            out.append(line)
    out.append("#")
    return "\n".join(out) + "\n"


def _manifest_text(manifest: dict[str, dict]) -> str:
    """`shasum -a 256` format (two spaces). A generated header states the gate
    exclusions, then one file line per table and one line per column `<file>#<column>`,
    columns in CSV order. Sorted by table name."""
    lines: list[str] = []
    for name in sorted(manifest):
        entry = manifest[name]
        lines.append(f"{entry['file']}  climate-si.{name}.csv")
        for col, digest in entry["columns"].items():
            lines.append(f"{digest}  climate-si.{name}.csv#{col}")
    return _manifest_header() + "".join(f"{line}\n" for line in lines)


def _parse_manifest(text: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        digest, sep, fname = line.partition("  ")
        if not sep:
            sys.exit(f"malformed manifest line (expected '<sha256>  <file>'): {line!r}")
        fname, _, col = fname.partition("#")
        name = fname.removeprefix("climate-si.").removesuffix(".csv")
        entry = out.setdefault(name, {"file": None, "columns": {}})
        if col:
            entry["columns"][col] = digest
        else:
            entry["file"] = digest
    return out


def _truncate(s: str) -> str:
    return s if len(s) <= _MAX_VAL else s[:_MAX_VAL] + f"…(+{len(s) - _MAX_VAL})"


def _json_key_diff(a: str, b: str) -> str | None:
    """For two JSON blobs, return a compact description of the FIRST differing key/index
    and both values, rather than dumping the whole thing. None if not both JSON."""
    try:
        ja, jb = json.loads(a), json.loads(b)
    except (ValueError, TypeError):
        return None
    if isinstance(ja, dict) and isinstance(jb, dict):
        for k in sorted(set(ja) | set(jb)):
            if ja.get(k) != jb.get(k):
                return f"[{k!r}] {ja.get(k)!r} vs {jb.get(k)!r}"
    if isinstance(ja, list) and isinstance(jb, list):
        if len(ja) != len(jb):
            return f"length {len(ja)} vs {len(jb)}"
        for i, (x, y) in enumerate(zip(ja, jb)):
            if x != y:
                return f"[{i}] {x!r} vs {y!r}"
    return None


def _short_context(row: dict[str, str], differing: str) -> str:
    """The identifying (short, non-blob) fields of a row, for locating the diff."""
    bits = [f"{k}={v}" for k, v in row.items()
            if k != differing and len(v) <= 24 and not k.endswith("_json")]
    return ", ".join(bits)


def _diff_rows(current: Path, reference: Path) -> None:
    """Print bounded row-level diffs between two CSVs, aligned by row index (precompute
    output order is deterministic). Both sides shown; JSON columns reduced to the key."""
    with open(current, newline="") as fo:
        cur = list(csv.DictReader(fo))
    with open(reference, newline="") as fo:
        ref = list(csv.DictReader(fo))

    if len(cur) != len(ref):
        print(f"      row COUNT differs: {len(cur)} (current) vs {len(ref)} (reference)",
              file=sys.stderr)

    shown = 0
    total = 0
    for i in range(min(len(cur), len(ref))):
        cols = [c for c in cur[i] if cur[i].get(c) != ref[i].get(c)]
        if not cols:
            continue
        total += 1
        if shown >= _MAX_DIFF_ROWS:
            continue
        shown += 1
        ctx = _short_context(cur[i], cols[0])
        print(f"      row {i} ({ctx or '—'})", file=sys.stderr)
        for c in cols:
            cv, rv = cur[i].get(c, ""), ref[i].get(c, "")
            jk = _json_key_diff(cv, rv) if c.endswith("_json") else None
            if jk is not None:
                print(f"        {c}: first differing key {jk}", file=sys.stderr)
            else:
                print(f"        {c}: {_truncate(cv)}  (current)", file=sys.stderr)
                print(f"        {c}: {_truncate(rv)}  (reference)", file=sys.stderr)
    print(f"      {total} row(s) differ in this table"
          + (f" (showing {shown})" if total > shown else ""), file=sys.stderr)


def _write(tables_dir: Path, manifest: Path) -> int:
    computed = _compute(tables_dir)
    manifest.write_text(_manifest_text(computed))
    ncols = sum(len(e["columns"]) for e in computed.values())
    nexcl = sum(len(v) for v in GATE_EXCLUDED.values())
    print(f"Wrote {len(computed)} table + {ncols} column hashes → {manifest}")
    print(f"  {nexcl} column(s) excluded from the gate (informational): "
          f"{[f'{t}.{c}' for t, cols in GATE_EXCLUDED.items() for c in cols]}")
    for name in sorted(computed):
        print(f"  {computed[name]['file']}  climate-si.{name}.csv")
    return 0


def _check(tables_dir: Path, manifest: Path, reference: Path | None = None) -> int:
    if not manifest.exists():
        print(
            f"FAIL — manifest not found: {manifest}\n"
            f"Seed it with `--write` (on native amd64) and commit it.",
            file=sys.stderr,
        )
        return 1

    expected = _parse_manifest(manifest.read_text())
    actual = _compute(tables_dir)

    missing = [n for n in TABLE_NAMES if n not in expected]
    extra = [n for n in expected if n not in TABLE_NAMES]

    # Per table, split moved columns into GATED (fail) and EXCLUDED (informational).
    gated: dict[str, list[str]] = {}   # table -> gated columns that moved
    info: dict[str, list[str]] = {}    # table -> excluded columns that moved
    structural: list[str] = []         # file moved but no column did (whitespace/layout)
    for n in TABLE_NAMES:
        if n not in expected:
            continue
        exp_cols, act_cols = expected[n].get("columns", {}), actual[n]["columns"]
        if not exp_cols:  # legacy manifest with no per-column hashes: gate on file hash
            if actual[n]["file"] != expected[n]["file"]:
                gated[n] = []
            continue
        moved = [c for c in act_cols if exp_cols.get(c) != act_cols[c]]
        g = [c for c in moved if not _is_excluded(n, c)]
        i = [c for c in moved if _is_excluded(n, c)]
        if g:
            gated[n] = g
        if i:
            info[n] = i
        if actual[n]["file"] != expected[n]["file"] and not moved:
            structural.append(n)

    # Informational drift is always reported — that is how excluded-column drift stays
    # visible (e.g. tropical.trend_json across architectures) without failing the build.
    for n, cols in info.items():
        for c in cols:
            print(f"NOTE — informational (not gated): climate-si.{n}.csv#{c} moved "
                  f"(expected {expected[n]['columns'][c][:12]}…, "
                  f"actual {actual[n]['columns'][c][:12]}…). "
                  f"Excluded: {GATE_EXCLUDED[n][c].split(';')[0]}.", file=sys.stderr)

    if not (missing or extra or gated or structural):
        gcols = sum(len(cs) for cs in info.values())
        note = f" ({gcols} informational column drift noted above)" if gcols else ""
        print(f"OK — all gated columns match {manifest.name}{note}.")
        return 0

    print("FAIL — gated derived-table columns do not match the committed manifest.",
          file=sys.stderr)
    for n in missing:
        print(f"  MISSING from manifest: {n}", file=sys.stderr)
    for n in extra:
        print(f"  UNKNOWN in manifest:   {n}", file=sys.stderr)
    for n in sorted(set(gated) | set(structural)):
        print(f"  MOVED: climate-si.{n}.csv", file=sys.stderr)
        print(f"         expected {expected[n]['file']}", file=sys.stderr)
        print(f"         actual   {actual[n]['file']}", file=sys.stderr)
        if n in structural:
            print("         (file differs but no column hash did — check line "
                  "endings / column order)", file=sys.stderr)
        else:
            unchanged = [c for c in actual[n]["columns"] if c not in gated[n]]
            print(f"         GATED column(s) moved: {gated[n]}", file=sys.stderr)
            print(f"         column(s) unchanged:   {unchanged}", file=sys.stderr)
        if reference is not None:
            ref_csv = _csv_path(reference, n)
            if ref_csv.exists():
                _diff_rows(_csv_path(tables_dir, n), ref_csv)
            else:
                print(f"      (no reference CSV at {ref_csv})", file=sys.stderr)

    print(
        "\nA GATED derived-table column changed. If the move is intended, regenerate the\n"
        "manifest in the SAME commit: `python check_table_hashes.py --write` (on native\n"
        "amd64), and update tests/fixtures + tests/snapshot as usual. If it is NOT\n"
        "intended, a pipeline change moved published output — investigate before merging.\n"
        "Pass --reference <dir> with the other CSV set for row-level, both-sides diffs.",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Check/write the derived-table sha256 manifest.")
    ap.add_argument("--write", action="store_true",
                    help="regenerate the manifest instead of checking against it")
    ap.add_argument("--manifest", type=Path, default=None,
                    help=f"manifest path (default: {DEFAULT_MANIFEST})")
    ap.add_argument("--reference", type=Path, default=None,
                    help="directory holding the OTHER climate-si.*.csv set, for "
                         "row-level both-sides diffs on failure")
    args = ap.parse_args()

    tables_dir = Path(os.environ.get("TABLES_DIR", str(DEFAULT_TABLES_DIR)))
    manifest = args.manifest or DEFAULT_MANIFEST

    if args.write:
        return _write(tables_dir, manifest)
    return _check(tables_dir, manifest, args.reference)


if __name__ == "__main__":
    sys.exit(main())
