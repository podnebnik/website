"""T-5.17 — the derived-table hash gate must PASS on a matching table set, FAIL loudly
on any GATED drift, EXPLAIN what moved down to the column, and treat an EXCLUDED column
(tropical.trend_json) as informational — reported, never failed. This guards the
pipeline-neutrality gate the same way test_validate.py guards the output validator: if a
future edit weakens the check into a no-op, or silently widens the exclusion, the
negative cases here go red.

The gate is architecture-agnostic by construction — it hashes bytes — so these tests use
tiny synthetic CSVs (no precompute run needed). Each synthetic table carries a gated
scalar (`count`), a gated JSON column (`counts_json`) and `trend_json`, which is excluded
for the `tropical` table only.
"""

import json
from pathlib import Path

import check_table_hashes as cth
from validate import TABLE_NAMES


def _make_tables(tables_dir: Path) -> None:
    tables_dir.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(TABLE_NAMES):
        (tables_dir / f"climate-si.{name}.csv").write_text(
            f"era5_name,count,counts_json,trend_json\n"
            f"Stat{i},{i},{json.dumps([i])},{json.dumps({'aic': i})}\n"
        )


def _set_field(path: Path, column: str, value: str) -> None:
    """Rewrite the single data row's `column` to `value`, leaving the rest byte-identical."""
    import csv
    rows = list(csv.DictReader(open(path, newline="")))
    hdr = list(rows[0].keys())
    rows[0][column] = value
    import io
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=hdr)
    w.writeheader()
    w.writerows(rows)
    path.write_text(buf.getvalue())


def test_write_then_check_passes(tmp_path):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)

    assert cth._write(tables, manifest) == 0
    assert manifest.exists()
    text = manifest.read_text()
    # The header states the exclusion, in the manifest itself.
    assert "EXCLUDED FROM THE GATE" in text
    assert "climate-si.tropical.csv#trend_json" in text
    data_lines = [l for l in text.splitlines() if l and not l.startswith("#")]
    file_lines = [l for l in data_lines if "#" not in l]
    col_lines = [l for l in data_lines if "#" in l]
    assert len(file_lines) == len(TABLE_NAMES)
    assert len(col_lines) == 4 * len(TABLE_NAMES)  # four columns each
    for line in data_lines:
        digest, sep, fname = line.partition("  ")
        assert sep == "  " and len(digest) == 64 and fname.startswith("climate-si.")

    assert cth._check(tables, manifest) == 0


def test_gated_column_move_fails(tmp_path):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    _set_field(tables / "climate-si.daily.csv", "count", "999")
    assert cth._check(tables, manifest) == 1


def test_gated_move_names_the_column(tmp_path, capsys):
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    _set_field(tables / "climate-si.daily.csv", "counts_json", json.dumps([42]))
    assert cth._check(tables, manifest) == 1
    err = capsys.readouterr().err
    assert "GATED column(s) moved: ['counts_json']" in err


def test_excluded_trend_json_drift_passes_with_note(tmp_path, capsys):
    """The tropical.trend_json exclusion: an arch-sensitive fit column must NOT fail the
    build, but its drift must stay VISIBLE as an informational note."""
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    _set_field(tables / "climate-si.tropical.csv", "trend_json", json.dumps({"aic": 999}))
    assert cth._check(tables, manifest) == 0            # PASS, not fail
    err = capsys.readouterr().err
    assert "NOTE — informational" in err and "trend_json" in err


def test_gated_move_fails_even_alongside_excluded_drift(tmp_path, capsys):
    """A moved COUNT must fail even when the excluded trend_json also moved — the
    exclusion must never mask a gated column."""
    tables = tmp_path / "data"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    cth._write(tables, manifest)

    t = tables / "climate-si.tropical.csv"
    _set_field(t, "trend_json", json.dumps({"aic": 999}))
    # A collision-proof sentinel: the synthetic counts_json is json.dumps([idx]) where idx is
    # tropical's position in TABLE_NAMES, so the moved value must not equal any table index.
    _set_field(t, "counts_json", json.dumps([999]))
    assert cth._check(tables, manifest) == 1
    err = capsys.readouterr().err
    assert "GATED column(s) moved: ['counts_json']" in err
    assert "NOTE — informational" in err  # trend_json still reported


def test_reference_diff_reports_json_key_and_both_sides(tmp_path, capsys):
    tables = tmp_path / "data"
    reference = tmp_path / "ref"
    manifest = tmp_path / "derived-tables.sha256"
    _make_tables(tables)
    _make_tables(reference)
    cth._write(reference, manifest)

    # Move a GATED JSON column so the gate fails and the reference diff runs.
    _set_field(tables / "climate-si.spei.csv", "counts_json", json.dumps([42]))
    assert cth._check(tables, manifest, reference) == 1
    err = capsys.readouterr().err
    assert "first differing key" in err and "42" in err


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
    # The generated header is comment-only, so parsing recovers exactly the data.
    assert cth._parse_manifest(cth._manifest_text(computed)) == computed


def test_json_key_diff_dict_and_list():
    assert cth._json_key_diff('{"a": 1, "b": 2}', '{"a": 1, "b": 3}') == "['b'] 2 vs 3"
    assert cth._json_key_diff("[1, 2, 3]", "[1, 9, 3]") == "[1] 2 vs 9"
    assert cth._json_key_diff("[1, 2]", "[1, 2, 3]") == "length 2 vs 3"
    assert cth._json_key_diff("not json", "also not") is None


def test_tropical_trend_json_is_excluded_by_config():
    """Guard the exclusion set itself: if someone widens it, this makes them update the
    test deliberately."""
    assert cth.GATE_EXCLUDED == {"tropical": {"trend_json": cth.GATE_EXCLUDED["tropical"]["trend_json"]}}
    assert cth._is_excluded("tropical", "trend_json")
    assert not cth._is_excluded("tropical", "counts_json")
    assert not cth._is_excluded("daily", "trend_json")
