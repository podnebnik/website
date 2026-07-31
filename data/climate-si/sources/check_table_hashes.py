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
ULP difference) changed nothing — precompute rounds every value to a fixed number of
decimals (2–6 dp), which absorbs float noise ~six orders of magnitude below the rounding
step. precompute uses no RNG, no wall-clock and no set/dict ordering in its output.

⚠ The manifest is an amd64 artifact by construction. Generation runs ONCE, on native
amd64, in the `generate-db` job (T-5.9) — this check runs in the same builder, on the same
architecture, so the committed hashes and the recomputed hashes share an environment. Do
NOT regenerate the manifest under emulation: emulated-amd64 floating point is not native
amd64 and may not reproduce CI's hashes.

Usage
-----
    # check (default): compare freshly-exported CSVs against the committed manifest
    TABLES_DIR=/build/data/climate-si/data \
        python check_table_hashes.py --manifest data/climate-si/derived-tables.sha256

    # write: regenerate the manifest after a DELIBERATE pipeline change
    TABLES_DIR=.../data python check_table_hashes.py --write \
        --manifest data/climate-si/derived-tables.sha256
"""

import argparse
import hashlib
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


def _csv_path(tables_dir: Path, name: str) -> Path:
    return tables_dir / f"climate-si.{name}.csv"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fo:
        for chunk in iter(lambda: fo.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _compute(tables_dir: Path) -> dict[str, str]:
    """sha256 of every derived CSV export, keyed by table name. Missing file → exit."""
    out: dict[str, str] = {}
    for name in TABLE_NAMES:
        path = _csv_path(tables_dir, name)
        if not path.exists():
            sys.exit(
                f"derived CSV not found: {path}\n"
                f"Run precompute_datasette.py then export_datasette_csv.py first."
            )
        out[name] = _sha256(path)
    return out


def _manifest_text(hashes: dict[str, str]) -> str:
    """`shasum -a 256` format (two spaces), one line per table, sorted by table name."""
    return "".join(
        f"{hashes[name]}  climate-si.{name}.csv\n" for name in sorted(hashes)
    )


def _parse_manifest(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        digest, _, fname = line.partition("  ")
        if not fname:
            sys.exit(f"malformed manifest line (expected '<sha256>  <file>'): {line!r}")
        name = fname.removeprefix("climate-si.").removesuffix(".csv")
        out[name] = digest
    return out


def _write(tables_dir: Path, manifest: Path) -> int:
    hashes = _compute(tables_dir)
    manifest.write_text(_manifest_text(hashes))
    print(f"Wrote {len(hashes)} table hashes → {manifest}")
    for name in sorted(hashes):
        print(f"  {hashes[name]}  climate-si.{name}.csv")
    return 0


def _check(tables_dir: Path, manifest: Path) -> int:
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
    moved = [n for n in TABLE_NAMES if n in expected and actual[n] != expected[n]]

    if missing or extra or moved:
        print("FAIL — derived tables do not match the committed manifest.", file=sys.stderr)
        for n in missing:
            print(f"  MISSING from manifest: {n}", file=sys.stderr)
        for n in extra:
            print(f"  UNKNOWN in manifest:   {n}", file=sys.stderr)
        for n in moved:
            print(f"  MOVED: climate-si.{n}.csv", file=sys.stderr)
            print(f"         expected {expected[n]}", file=sys.stderr)
            print(f"         actual   {actual[n]}", file=sys.stderr)
        print(
            "\nA derived table's bytes changed. If the move is intended, regenerate the\n"
            "manifest in the SAME commit: `python check_table_hashes.py --write` (on native\n"
            "amd64), and update tests/fixtures + tests/snapshot as usual. If it is NOT\n"
            "intended, a pipeline change moved published output — investigate before merging.",
            file=sys.stderr,
        )
        return 1

    print(f"OK — all {len(TABLE_NAMES)} derived tables match {manifest.name}.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Check/write the derived-table sha256 manifest.")
    ap.add_argument("--write", action="store_true",
                    help="regenerate the manifest instead of checking against it")
    ap.add_argument("--manifest", type=Path, default=None,
                    help=f"manifest path (default: {DEFAULT_MANIFEST})")
    args = ap.parse_args()

    tables_dir = Path(os.environ.get("TABLES_DIR", str(DEFAULT_TABLES_DIR)))
    manifest = args.manifest or DEFAULT_MANIFEST

    if args.write:
        return _write(tables_dir, manifest)
    return _check(tables_dir, manifest)


if __name__ == "__main__":
    sys.exit(main())
