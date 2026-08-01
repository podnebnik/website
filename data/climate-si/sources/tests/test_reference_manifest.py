"""T-5.43 — the frozen-reference derived-table gate.

Why this exists
---------------
The old T-5.17 manifest hashed precompute's output over the LIVE raw data. That
conflated two questions — "did the data change?" (yes, every daily refresh) and
"did the code change what it produces?" (rare, the whole point) — so once the refresh
runs daily it would move every day and the code signal would drown. This gate hashes
precompute's output over a FROZEN fixture instead, so it moves when and ONLY when code
changes behaviour. No daily red; the signal the gate exists for is preserved.

It lives here, as a pytest, rather than in the datasette image build: it is a
code-behaviour assertion, it needs no real database, and it runs on every human PR (the
only place code drift enters). The refresh PR is data-only, so it does not need to run
here at all.

The fixture (tests/fixtures/reference-raw/) is two real stations — Ljubljana (lowland:
tropical days, the strict-`>` count path) and Kredarica (high-altitude: the −1207 m
lapse correction, a near-zero tropical count) — sliced to three years INSIDE the
1991-2020 anomaly baseline. That window deliberately omits SPEI's 1950-1980 calibration
window, so SPEI is WITHHELD (D-16): the fixture guards the eight non-SPEI tables in full
plus SPEI's withhold shape and its upstream water-balance computation, but NOT the Fisk
fit / SPEI-value mapping / categorisation / ranking, which never run on an empty
baseline. Those keep their dedicated unit tests (test_spei_fit_success_returns_monotone_
values, test_spei_baseline_is_decoupled_and_frozen_1950_1980) and validate.py's D-16
monotone tripwire on every real build. Keeping full SPEI coverage would force a ~1950-2020
span and a ~2 MB fixture; ~200 KB was judged the better trade (T-5.43).

Determinism: the gate excludes tropical.trend_json exactly as T-5.17 did (an iterative
NB-GLM whose optimiser path is architecture-sensitive). Every other column is a COUNT or a
rounded stat, shown byte-stable across architecture and BLAS-thread count (T-4.25); the CI
pytest step pins single-threaded BLAS for belt-and-suspenders. The manifest is regenerated
with `--write` (see `_write_reference_manifest` below), the same deliberate act the T-5.17
manifest was.
"""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

import check_table_hashes as cth
import precompute_datasette as pc
import validate as pipeline_validate
import validate_raw

_HERE = Path(__file__).resolve().parent
FIXTURE_RAW = _HERE / "fixtures" / "reference-raw"
REFERENCE_MANIFEST = _HERE / "fixtures" / "reference-tables.sha256"
_EXPORT_SCRIPT = Path(pc.__file__).resolve().parent / "export_datasette_csv.py"


def _fixture_csvs() -> list[Path]:
    return sorted(FIXTURE_RAW.glob("*.csv"))


def _build_and_export(out_dir: Path, monkeypatch) -> None:
    """Load the frozen fixture, build all nine tables, and export them to CSV in
    out_dir — the same to_sql → export_datasette_csv path production hashes."""
    monkeypatch.setattr(pc, "DATA_DIR", FIXTURE_RAW)
    data = pc.load_all()
    tables = pc.build_all_tables(data)

    # The fixture window omits SPEI's 1950-1980 baseline, so spei/spei_station are
    # WITHHELD → empty frames with NO columns, which `to_sql` cannot create. On real
    # data these are never empty. Give an empty frame its authoritative datapackage
    # columns (D-18) so it exports as a header-only CSV — faithfully pinning "withheld".
    dp_columns = pipeline_validate._load_datapackage_columns()
    for name, df in list(tables.items()):
        if df.shape[1] == 0 and name in dp_columns:
            tables[name] = pd.DataFrame(columns=dp_columns[name])

    db_path = out_dir / "climate-si.db"
    conn = sqlite3.connect(db_path)
    try:
        for name, df in tables.items():
            df.to_sql(name, conn, if_exists="replace", index=False)
    finally:
        conn.close()

    # Export via the production script (DB → CSV, NaN → "") so the bytes we hash are
    # exactly what `invoke create-databases` would import.
    env = {**os.environ, "DB_PATH": str(db_path), "OUT_DIR": str(out_dir)}
    subprocess.run(
        [sys.executable, str(_EXPORT_SCRIPT)],
        env=env, check=True, capture_output=True, text=True,
    )


def test_fixture_matches_the_raw_schema():
    """Drift guard (T-5.43): the frozen fixture must still satisfy the SAME strict raw
    schema validate_raw owns (RAW_COLUMNS, ALLOWED_SOURCES). If a raw column is added or
    a source value introduced, this fails until the fixture is re-sliced — the fixture
    cannot silently rot away from the real contract. One definition, one more caller."""
    schema = validate_raw._schema_raw_station()
    csvs = _fixture_csvs()
    assert csvs, f"no fixture CSVs under {FIXTURE_RAW}"
    for csv in csvs:
        df = pd.read_csv(csv)
        schema.validate(df, lazy=True)  # raises SchemaErrors on any column/dtype/source drift


def test_reference_manifest_matches(tmp_path, monkeypatch):
    """The gate: precompute's output over the frozen fixture must hash-match the committed
    reference manifest. It moves when and only when code changes what the pipeline
    produces — regenerate with `--write` in the same commit, tracing the moved values."""
    assert REFERENCE_MANIFEST.exists(), (
        f"{REFERENCE_MANIFEST} missing — seed it with _write_reference_manifest()."
    )
    _build_and_export(tmp_path, monkeypatch)
    rc = cth._check(tmp_path, REFERENCE_MANIFEST)
    assert rc == 0, "derived-table output moved vs the reference manifest (see stderr)"


def _write_reference_manifest() -> int:
    """Regenerate tests/fixtures/reference-tables.sha256 from the frozen fixture.

    Not a test — invoked deliberately (like check_table_hashes --write) when a code
    change legitimately moves the fixture's output:
        python -c "import tests.test_reference_manifest as t; t._write_reference_manifest()"
    run from data/climate-si/sources with the venv active. Pins single-threaded BLAS via
    the CI step / your shell for cross-machine stability on gated columns.
    """
    import tempfile

    class _MP:  # minimal monkeypatch stand-in for standalone use
        def setattr(self, obj, name, value):
            setattr(obj, name, value)

    with tempfile.TemporaryDirectory() as d:
        out = Path(d)
        _build_and_export(out, _MP())
        return cth._write(out, REFERENCE_MANIFEST)
