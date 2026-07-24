"""T-3.6 — the output validator must pass on the committed tables and fail loudly
on a corrupted one. This guards the safety net itself: if a future edit weakens a
check into a no-op, the negative cases here go red.
"""

from pathlib import Path

import pandas as pd
import pytest

import validate as v

DATA_DIR = Path(__file__).resolve().parents[3] / "climate-si" / "data"


@pytest.fixture(scope="module")
def tables() -> dict[str, pd.DataFrame]:
    return {n: pd.read_csv(DATA_DIR / f"climate-si.{n}.csv") for n in v.TABLE_NAMES}


def test_committed_tables_validate(tables):
    # Raises PipelineValidationError on any violation; passing == returns None.
    v.validate_tables(dict(tables))


def _expect_error(tables, snippet):
    with pytest.raises(v.PipelineValidationError) as ei:
        v.validate_tables(tables)
    assert snippet in str(ei.value), str(ei.value)


def test_temperature_out_of_bounds(tables):
    t = dict(tables)
    d = tables["daily"].copy()
    d.loc[0, "temperature_max_2m"] = 99.9
    t["daily"] = d
    _expect_error(t, "temperature outside")


def test_temperature_ordering(tables):
    t = dict(tables)
    d = tables["daily"].copy()
    d.loc[0, "temperature_min_2m"] = d.loc[0, "temperature_max_2m"] + 5
    t["daily"] = d
    _expect_error(t, "temperature ordering violated")


def test_date_gap(tables):
    t = dict(tables)
    t["daily"] = tables["daily"].drop(index=5)
    _expect_error(t, "missing day")


def test_percentiles_out_of_order(tables):
    t = dict(tables)
    d = tables["daily_window"].copy()
    d.loc[0, "p95"] = -999.0
    t["daily_window"] = d
    _expect_error(t, "percentiles out of order")


def test_station_elevation_mismatch(tables):
    t = dict(tables)
    s = tables["stations"].copy()
    s.loc[0, "elevation"] = 1
    t["stations"] = s
    _expect_error(t, "elevation does not match si.yaml")


def test_missing_table(tables):
    t = {k: df for k, df in tables.items() if k != "spei"}
    _expect_error(t, "missing table")


def test_cat_color_inconsistent(tables):
    t = dict(tables)
    s = tables["season_heatmap"].copy()
    s.loc[0, "color"] = "#000000"
    t["season_heatmap"] = s
    _expect_error(t, "cat/color mapping inconsistent")


def test_extra_column_is_schema_drift(tables):
    t = dict(tables)
    s = tables["spei"].copy()
    s["surprise"] = 1
    t["spei"] = s
    _expect_error(t, "column_in_schema")
