"""T-5.17 — the derived-table hash gate must PASS on a matching table set and FAIL
loudly on any drift, and (the amendment) EXPLAIN what moved down to the column. This
guards the pipeline-neutrality gate the same way test_validate.py guards the output
validator: if a future edit weakens the check into a no-op, the negative cases here go
red.

The gate is architecture-agnostic by construction — it hashes bytes — so these tests
use tiny synthetic CSVs (no precompute run needed). That the REAL nine tables are
byte-deterministic across runs is a separate property, verified in the T-5.17 session
and re-checked at image-build time by the committed manifest.
"""

import json
from pathlib import Path

import check_table_hashes as cth
from validate import TABLE_NAMES


def _make_tables(tables_dir: Path) -> None:
    """Write one small, distinct three-column CSV per derived table name."""
    tables_dir.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(TABLE_NAMES):
        (tables_dir / f"climate-si.{name}.csv").write_text(
            f"era5_name,count,trend_json\nStat{i},{i},{json.dumps({'aic': i})}\n"
        )


def test_write_then_check_passes(tmp_path):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)

    assert cth._write(tables, manifest) == 0
    assert manifest.exists()
    lines = manifest.read_text().splitlines()
    # One file-level line per table (the gate) plus one line per column (the diagnostic).
    file_lines = [l for l in lines if "#" not in l]
    col_lines = [l for l in lines if "#" in l]
    assert len(file_lines) == len(TABLE_NAMES)
    assert len(col_lines) == 3 * len(TABLE_NAMES)  # three columns each
    for line in lines:
        digest, sep, fname = line.partition("  ")
        assert sep == "  " and len(digest) == 64 and fname.startswith("climate-si.")

    assert cth._check(tables, manifest) == 0


def test_check_fails_when_a_table_moves(tmp_path):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    moved = tables / "climate-si.daily.csv"
    moved.write_text(moved.read_text().replace("Stat1", "StatX"))
    assert cth._check(tables, manifest) == 1


def test_check_names_the_moved_column(tmp_path, capsys):
    """The self-diagnosis: on failure the check must name the column that moved and
    leave the others listed as unchanged — that is what tells a fitted display stat
    (trend_json) from a deterministic count (T-5.17 amendment)."""
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    # Move ONLY trend_json in one table, leave era5_name / count byte-identical.
    idx = TABLE_NAMES.index("tropical")
    t = tables / "climate-si.tropical.csv"
    t.write_text(f"era5_name,count,trend_json\nStat{idx},{idx},{json.dumps({'aic': 999})}\n")

    assert cth._check(tables, manifest) == 1
    err = capsys.readouterr().err
    assert "climate-si.tropical.csv" in err
    assert "trend_json" in err
    # era5_name and count must be reported UNCHANGED, not moved.
    assert "column(s) moved: ['trend_json']" in err


def test_reference_diff_reports_json_key_and_both_sides(tmp_path, capsys):
    tables = tmp_path / "data"
    reference = tmp_path / "ref"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    _make_tables(reference)          # identical baseline …
    cth._write(reference, manifest)  # … and its manifest

    # Now move trend_json.aic in the current set only.
    t = tables / "climate-si.spei.csv"
    t.write_text(t.read_text().rsplit(",", 1)[0] + "," + json.dumps({"aic": 42}) + "\n")

    assert cth._check(tables, manifest, reference) == 1
    err = capsys.readouterr().err
    assert "first differing key" in err and "'aic'" in err
    assert "42" in err  # the current-side value appears


def test_check_fails_on_missing_manifest(tmp_path):
    tables = tmp_path / "data"
    _make_tables(tables)
    assert cth._check(tables, tmp_path / "absent.sha256") == 1


def test_manifest_roundtrips(tmp_path):
    tables = tmp_path / "data"
    _make_tables(tables)
    computed = cth._compute(tables)
    assert set(computed) == set(TABLE_NAMES)
    assert all("file" in e and "columns" in e for e in computed.values())
    assert cth._parse_manifest(cth._manifest_text(computed)) == computed


def test_json_key_diff_dict_and_list():
    assert cth._json_key_diff('{"a": 1, "b": 2}', '{"a": 1, "b": 3}') == "['b'] 2 vs 3"
    assert cth._json_key_diff("[1, 2, 3]", "[1, 9, 3]") == "[1] 2 vs 9"
    assert cth._json_key_diff("[1, 2]", "[1, 2, 3]") == "length 2 vs 3"
    assert cth._json_key_diff("not json", "also not") is None
