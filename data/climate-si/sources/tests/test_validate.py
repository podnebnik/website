"""T-3.6 / T-5.7c — the output validator must pass on a valid table set and fail
loudly on a corrupted one. This guards the safety net itself: if a future edit
weakens a check into a no-op, the negative cases here go red.

T-5.7c untracked the derived ``climate-si.*.csv`` (they are generated at datasette
image-build time now), so these tests no longer read them from disk. Instead they
build a *structurally valid* nine-table set in code, keyed to the real ``si.yaml``
station list, and mutate one field per negative case.

The frames carry dummy values on purpose: ``validate.py`` checks shape, bounds and
cross-table consistency — not that the numbers were correctly computed. That the
*real* generated frames validate is a separate guarantee, enforced at build time
where ``precompute_datasette.main()`` calls ``validate_tables`` before writing (a
violation aborts the image build). Building against the real ``si.yaml`` config
keeps the stations / elevation checks honest against production metadata.
"""

import numpy as np
import pandas as pd
import pytest

import validate as v

# Two-year continuous daily span shared by daily + daily_window (the year bounds
# must agree — _check_window_year_bounds). 2000 is a leap year, so the range is
# 731 continuous days; the exact length only has to be gap-free.
_DAILY_START, _DAILY_END = "2000-01-01", "2001-12-31"
_YEAR_MIN, _YEAR_MAX = 2000, 2001

# 365 (month, day) pairs of a non-leap year — the day-of-year grid that
# daily_window and daily_percentiles must cover exactly once (_check_doy_count).
_MD = [(d.month, d.day) for d in pd.date_range("2001-01-01", "2001-12-31")]
assert len(_MD) == 365

# First N stations are treated as "mapped" (carry a Vremenar station_id); the
# rest are ERA5-only (station_id NULL). Ids are arbitrary — validate.py only
# checks that daily_percentiles' ids are a subset of the stations table's.
_N_MAPPED = 9


def _sid(i: int) -> float:
    return float(100 + i) if i < _N_MAPPED else np.nan


def _build_valid_tables(config: dict) -> dict[str, pd.DataFrame]:
    stations_cfg = config["stations"]

    # stations — one row per si.yaml station, in the same order (the config-match
    # check compares name/elevation/lat/lon lists positionally).
    stations = pd.DataFrame([
        {
            "era5_name": s["name"],
            "name": s["name"].replace("_", " "),
            "official_name": s["name"].replace("_", " "),
            "name_locative": "v " + s["name"].replace("_", " "),
            "station_id": _sid(i),
            "xml_id": f"X{i}" if i < _N_MAPPED else None,
            "lat": s["lat"],
            "lon": s["lon"],
            "elevation": s["elevation"],
            "elevation_era5_m": s["elevation_era5_m"],
        }
        for i, s in enumerate(stations_cfg)
    ])

    # daily — a gap-free two-year series per station.
    dates = pd.date_range(_DAILY_START, _DAILY_END)
    daily = pd.concat([
        pd.DataFrame({
            "station_id": _sid(i),
            "era5_name": s["name"],
            "date": dates.strftime("%Y-%m-%d"),
            "year": dates.year,
            "month": dates.month,
            "day": dates.day,
            "temperature_max_2m": 20.0,
            "temperature_average_2m": 15.0,
            "temperature_min_2m": 10.0,
        })
        for i, s in enumerate(stations_cfg)
    ], ignore_index=True)

    # daily_window — 365 doy rows per station, percentiles non-decreasing.
    daily_window = pd.concat([
        pd.DataFrame({
            "era5_name": s["name"],
            "station_id": _sid(i),
            "month": [m for m, _ in _MD],
            "day": [d for _, d in _MD],
            "p5": 5.0, "p10": 6.0, "p20": 7.0,
            "p50": 8.0, "p80": 9.0, "p95": 10.0,
            "n_samples": 100,
            "year_min": _YEAR_MIN,
            "year_max": _YEAR_MAX,
            "distribution_json": "[[0.0,0.1]]",
        })
        for i, s in enumerate(stations_cfg)
    ], ignore_index=True)

    # daily_percentiles — 365 doy rows per mapped station only.
    perc_dates = pd.date_range("2025-01-01", "2025-12-31")  # 2025 is non-leap
    daily_percentiles = pd.concat([
        pd.DataFrame({
            "date": perc_dates.strftime("%Y-%m-%d"),
            "station_id": int(100 + i),
            "p05": 1.0, "p20": 2.0, "p40": 3.0,
            "p60": 4.0, "p80": 5.0, "p95": 6.0,
        })
        for i in range(_N_MAPPED)
    ], ignore_index=True)

    # annual_trend — a handful of rows; n_years must equal the inclusive span.
    trend_vars = sorted(v.TREND_VARIABLES)
    annual_trend = pd.DataFrame([
        {
            "era5_name": s["name"],
            "station_id": _sid(i),
            "variable": var,
            "month": 1,
            "day": 15,
            "day_label": "Jan 15",
            "year_min": 2000,
            "year_max": 2011,
            "trend10": 0.5,
            "p_val": 0.5,
            "tau": 0.1,
            "n_years": 12,
            "proj_end_year": 2050,
            "slope": 0.05,
            "intercept": 1.0,
            "slope_hi": 0.06,
            "intercept_hi": 1.1,
            "slope_lo": 0.04,
            "intercept_lo": 0.9,
            "scatter_json": '[{"x":2000,"y":1.0}]',
        }
        for i, s in enumerate(stations_cfg)
        for var in trend_vars
    ])

    # annual_trend_windows — same shape as annual_trend plus a `window` column, one row
    # per station × variable × window (3/15/45). ±7 is NOT present here (it lives only in
    # annual_trend); the uniqueness key includes `window` (T-4.26a, Option C).
    annual_trend_windows = pd.DataFrame([
        {
            "era5_name": s["name"],
            "station_id": _sid(i),
            "variable": var,
            "month": 1,
            "day": 15,
            "day_label": "Jan 15",
            "year_min": 2000,
            "year_max": 2011,
            "trend10": 0.5,
            "p_val": 0.5,
            "tau": 0.1,
            "n_years": 12,
            "proj_end_year": 2050,
            "slope": 0.05,
            "intercept": 1.0,
            "slope_hi": 0.06,
            "intercept_hi": 1.1,
            "slope_lo": 0.04,
            "intercept_lo": 0.9,
            "scatter_json": '[{"x":2000,"y":1.0}]',
            "window": win,
        }
        for i, s in enumerate(stations_cfg)
        for var in trend_vars
        for win in (3, 15, 45)
    ])

    # season_heatmap — one normal-category row per station.
    season_heatmap = pd.DataFrame([
        {
            "era5_name": s["name"],
            "station_id": _sid(i),
            "x": 0,
            "y": 2001,
            "season": "Winter",
            "avg": 15.0,
            "percentile": 50.0,
            "cat": "normal",
            "rank": 1,
            "total": 1,
            "color": v.SEASON_CAT_COLOR["normal"],
            "n_days": 90,
        }
        for i, s in enumerate(stations_cfg)
    ])

    # tropical — one row per station; nonzero_count must agree with counts_json.
    tropical = pd.DataFrame([
        {
            "era5_name": s["name"],
            "station_id": _sid(i),
            "kind": "days",
            "threshold": 30,
            "streak": 1,
            "years_json": "[2000,2001]",
            "counts_json": "[0,1]",
            "nonzero_count": 1,
            "trend_json": "{}",
        }
        for i, s in enumerate(stations_cfg)
    ])

    # spei — national seasonal rows (no station dimension).
    spei = pd.DataFrame([
        {
            "x": xi,
            "y": 2001,
            "spei": 0.0,
            "balance": 1.0,
            "cat": "normal",
            "rank": 1,
            "total": 1,
            "color": v.SPEI_CAT_COLOR["normal"],
            "season": season,
            "n_days": 90,
        }
        for xi, season in enumerate(["Winter", "Spring"])
    ])

    # spei_station — one series row per station.
    spei_station = pd.DataFrame([
        {
            "era5_name": s["name"],
            "station_id": _sid(i),
            "series": "Annual",
            "years_json": "[2000,2001]",
            "spei_json": "[0.1,0.2]",
            "trend_json": "{}",
        }
        for i, s in enumerate(stations_cfg)
    ])

    return {
        "stations": stations,
        "daily": daily,
        "daily_percentiles": daily_percentiles,
        "daily_window": daily_window,
        "annual_trend": annual_trend,
        "annual_trend_windows": annual_trend_windows,
        "season_heatmap": season_heatmap,
        "tropical": tropical,
        "spei": spei,
        "spei_station": spei_station,
    }


@pytest.fixture(scope="module")
def config() -> dict:
    return v._load_config()


@pytest.fixture(scope="module")
def tables(config) -> dict[str, pd.DataFrame]:
    return _build_valid_tables(config)


def test_valid_tables_pass(tables):
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


# ── SPEI fabrication / degradation tripwire (D-16, T-5.1 part 4) ──────────────
#
# _check_spei_consistency fails the build if SPEI stops being a monotone, non-
# degenerate transform of the water balance — the shape a fabricated or collapsed
# fit produces, which every per-table pandera schema otherwise passes (fabricated
# values still clip to [-3,3] with a valid cat/colour/rank). The valid `tables`
# fixture has one row per x group, so it never exercises the check; these build a
# multi-row national-heatmap group for one season (x=0).


def _spei_group(speis: list[float]) -> pd.DataFrame:
    """A one-season (x=0) national heatmap group, balance ascending, five years.
    `cat`/`color` are held at 'normal' — the pandera schema only checks their mutual
    consistency, not that they match the spei value, so these stay valid there and
    isolate _check_spei_consistency."""
    balances = [-50.0, -10.0, 5.0, 30.0, 80.0]
    assert len(speis) == len(balances)
    return pd.DataFrame([
        {"x": 0, "y": 1990 + i, "spei": sp, "balance": b, "cat": "normal",
         "rank": i + 1, "total": len(balances), "color": v.SPEI_CAT_COLOR["normal"],
         "season": "Winter", "n_days": 90}
        for i, (b, sp) in enumerate(zip(balances, speis))
    ])


def test_spei_valid_multirow_group_passes(tables):
    # A genuinely monotone SPEI series (what a real fit produces) must pass — proves
    # the tripwire does not false-positive on valid multi-row data.
    t = dict(tables)
    t["spei"] = _spei_group([-2.0, -0.8, 0.1, 0.9, 2.1])
    v.validate_tables(t)


def test_spei_non_monotone_rejected(tables):
    # SPEI decoupled from / not ordered by balance — a scrambled or fabricated fit.
    t = dict(tables)
    t["spei"] = _spei_group([1.5, -2.0, 0.9, -0.5, 0.3])
    _expect_error(t, "not monotone in water balance")


def test_spei_constant_across_balances_rejected(tables):
    # SPEI collapsed to a single value across wet-to-dry years — a degenerate fit.
    t = dict(tables)
    t["spei"] = _spei_group([0.0, 0.0, 0.0, 0.0, 0.0])
    _expect_error(t, "constant across")


def test_spei_station_length_mismatch_rejected(tables):
    t = dict(tables)
    s = tables["spei_station"].copy()
    s.loc[0, "spei_json"] = "[0.1,0.2,0.3]"   # 3 SPEI vs 2 years
    t["spei_station"] = s
    _expect_error(t, "years/SPEI length mismatch")


def test_spei_station_constant_series_rejected(tables):
    t = dict(tables)
    s = tables["spei_station"].copy()
    s.loc[0, "years_json"] = "[2000,2001,2002]"
    s.loc[0, "spei_json"] = "[0.5,0.5,0.5]"    # flat across years -> collapsed fit
    t["spei_station"] = s
    _expect_error(t, "constant across")


# ── datapackage.yaml as the authoritative column set (D-18, T-5.3a) ──────────────
#
# validate.py no longer hardcodes the column SET; it derives it from
# datapackage.yaml (`_load_datapackage_columns`) and pairs each declared column with
# a hand spec via `_strict_schema`. These cover the loader and the two-directional
# drift it must catch: a column declared in datapackage with no spec, and a spec with
# no datapackage declaration. The end-to-end rename case (which doubles as the
# datapackage-side corruption proof) drives a mutated datapackage through
# validate_tables and asserts it fails loudly, naming the table and column.

import pandera.pandas as pa      # noqa: E402
import yaml                      # noqa: E402
from pathlib import Path         # noqa: E402


def test_load_datapackage_columns_happy():
    cols = v._load_datapackage_columns()
    # every validated table has a declared resource
    for name in v.TABLE_NAMES:
        assert name in cols, f"{name} missing from datapackage.yaml"
        assert cols[name], f"{name} has no fields"
    # a couple of representative, order-sensitive checks
    assert cols["daily_percentiles"] == ["date", "station_id",
                                         "p05", "p20", "p40", "p60", "p80", "p95"]
    assert cols["daily_window"][:4] == ["era5_name", "station_id", "month", "day"]


def test_load_datapackage_missing_fields_raises(tmp_path, monkeypatch):
    bad = {"resources": [{"name": "daily", "schema": {}}]}   # no schema.fields
    p = tmp_path / "datapackage.yaml"
    p.write_text(yaml.safe_dump(bad))
    monkeypatch.setenv("DATAPACKAGE_FILE", str(p))
    with pytest.raises(ValueError, match="no schema.fields"):
        v._load_datapackage_columns()


def test_strict_schema_missing_resource():
    # a table with no resource in datapackage → loud, named, no silent pass
    with pytest.raises(v.SchemaColumnMismatch) as ei:
        v._strict_schema("nope", {"a": pa.Column(int)}, {})
    assert "no resource declared" in " ".join(ei.value.error_lines())


def test_strict_schema_extra_spec_column():
    # spec has a column datapackage does not declare (spec not emitted / not declared)
    with pytest.raises(v.SchemaColumnMismatch) as ei:
        v._strict_schema("t", {"a": pa.Column(int), "b": pa.Column(int)},
                         {"t": ["a"]})
    lines = " ".join(ei.value.error_lines())
    assert "'b'" in lines and "not declared in datapackage.yaml" in lines


def test_strict_schema_missing_spec_column():
    # datapackage declares a column the spec map does not cover (declared, no spec)
    with pytest.raises(v.SchemaColumnMismatch) as ei:
        v._strict_schema("t", {"a": pa.Column(int)}, {"t": ["a", "b"]})
    lines = " ".join(ei.value.error_lines())
    assert "'b'" in lines and "no validate.py check spec" in lines


def test_datapackage_column_rename_fails_validation(tables, tmp_path, monkeypatch):
    """End-to-end: rename a column in datapackage.yaml and drive real (valid) tables
    through validate_tables. Because the column set now comes from datapackage, the
    rename no longer matches the spec map — the build must fail, naming the table and
    both offending column names. This is the datapackage-side corruption proof."""
    real_dp = Path(__file__).resolve().parent.parent.parent / "datapackage.yaml"
    dp = yaml.safe_load(real_dp.read_text())
    for res in dp["resources"]:
        if res["name"] == "daily_percentiles":
            for fld in res["schema"]["fields"]:
                if fld["name"] == "p05":
                    fld["name"] = "p05_renamed"
    p = tmp_path / "datapackage.yaml"
    p.write_text(yaml.safe_dump(dp))
    monkeypatch.setenv("DATAPACKAGE_FILE", str(p))
    with pytest.raises(v.PipelineValidationError) as ei:
        v.validate_tables(dict(tables))
    msg = str(ei.value)
    assert "daily_percentiles" in msg
    assert "p05_renamed" in msg      # declared in datapackage, no spec
    assert "p05" in msg              # spec exists, no datapackage declaration
