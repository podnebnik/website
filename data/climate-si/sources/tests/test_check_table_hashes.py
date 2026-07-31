"""T-5.17 — the derived-table hash gate must PASS on a matching table set and FAIL
loudly on any drift. This guards the pipeline-neutrality gate the same way
test_validate.py guards the output validator: if a future edit weakens the check
into a no-op, the negative cases here go red.

The gate is architecture-agnostic by construction — it hashes bytes — so these tests
use tiny synthetic CSVs (no precompute run needed). That the REAL nine tables are
byte-deterministic across runs is a separate property, verified in the T-5.17 session
and re-checked at image-build time by the committed manifest.
"""

from pathlib import Path

import check_table_hashes as cth
from validate import TABLE_NAMES


def _make_tables(tables_dir: Path) -> None:
    """Write one small, distinct CSV per derived table name."""
    tables_dir.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(TABLE_NAMES):
        (tables_dir / f"climate-si.{name}.csv").write_text(f"col_a,col_b\n{i},{name}\n")


def test_write_then_check_passes(tmp_path):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)

    assert cth._write(tables, manifest) == 0
    assert manifest.exists()
    # One line per table, `shasum -a 256` format (64 hex + two spaces + filename).
    lines = manifest.read_text().splitlines()
    assert len(lines) == len(TABLE_NAMES)
    for line in lines:
        digest, sep, fname = line.partition("  ")
        assert sep == "  " and len(digest) == 64 and fname.startswith("climate-si.")

    assert cth._check(tables, manifest) == 0


def test_check_fails_when_a_table_moves(tmp_path):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    # A one-byte change to a single derived CSV must be caught.
    moved = tables / "climate-si.daily.csv"
    moved.write_text(moved.read_text() + "999,extra\n")
    assert cth._check(tables, manifest) == 1


def test_check_fails_on_missing_manifest(tmp_path):
    tables = tmp_path / "data"
    _make_tables(tables)
    assert cth._check(tables, tmp_path / "absent.sha256") == 1


def test_manifest_roundtrips(tmp_path):
    tables = tmp_path / "data"
    _make_tables(tables)
    hashes = cth._compute(tables)
    assert set(hashes) == set(TABLE_NAMES)
    assert cth._parse_manifest(cth._manifest_text(hashes)) == hashes
