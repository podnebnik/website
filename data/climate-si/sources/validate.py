"""
T-3.6 — validate the pipeline's output tables before they are published.

This is a safety net for one moment in particular: T-4.3b/T-4.4 re-fetch the whole
1950–present archive with a new timezone (D-4) and a changed elevation correction
(D-5). That regeneration must not be able to publish a subtly broken table quietly.

Two ways to run it:

  * from the pipeline — `precompute_datasette.main()` calls `validate_tables(...)`
    with the DataFrames it just built, before the process finishes. A violation
    raises `PipelineValidationError`, so the build exits non-zero and nothing ships.

  * standalone, against the committed table CSVs (what CI does on every PR):

        uv run --project data/climate-si/sources python \
            data/climate-si/sources/validate.py

    It reads `climate-si.<table>.csv` from `data/climate-si/data/` (override with
    TABLES_DIR) and exits 0 if every table is valid, 1 otherwise.

Design notes
------------
* Expectations are derived from the committed CSVs as they stand (data generation of
  2026-07-22), but deliberately *not* hardcoded where D-4/D-5 will legitimately move
  them. Row counts are checked as invariants (a continuous daily series; 365 day-of-
  year slots), not as frozen totals; year bounds are checked against the data present,
  not against 2026; temperature bounds are chosen wide enough to survive the D-5 lapse
  change (see TEMP_MIN_C / TEMP_MAX_C below). The point is to catch a broken
  regeneration, not to forbid the intended one.
* Validation is lazy and aggregating: it collects every violation across every table
  and reports them together, rather than stopping at the first.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pandera.pandas as pa
import yaml

# ── Config (station list) ──────────────────────────────────────────────────────
# Loaded the same way precompute_datasette.py loads it, so the two never disagree
# about which stations / elevations are canonical. We do NOT import precompute here
# (it would be a circular import — precompute imports us).

COUNTRY = os.environ.get("COUNTRY", "si")


def _load_config() -> dict:
    for _cfg in [
        Path(os.environ.get("CONFIG_FILE", "__none__")),
        Path(__file__).parent / f"{COUNTRY}.yaml",
    ]:
        if _cfg.exists():
            with open(_cfg) as f:
                return yaml.safe_load(f)
    raise FileNotFoundError(f"Config file for COUNTRY={COUNTRY} not found")


# ── Physical bounds ─────────────────────────────────────────────────────────────
# Bounds on a *daily* ERA5-Land temperature (°C) for a Slovenian grid cell. A value
# outside them is a pipeline bug (unit/scale/sign error, corrupt merge), not weather.
#
# TEMP_MAX_C = 45.0
#   Slovenia's absolute measured record is 40.6 °C (Cerklje ob Krki, 2013). ERA5-Land
#   grid-cell daily values with the ≤0.5 °C lapse nudge stay well under 41 °C (current
#   committed max is 39.336 °C, a lowland station). Lowland stations set the warm
#   extreme and are untouched by D-5, so the regeneration cannot push past this. 45 °C
#   is above any physically plausible Slovenian daily temperature yet catches a bug.
#
# TEMP_MIN_C = -50.0
#   Current committed minimum is -40.557 °C (Kredarica, lapse-corrected down to its
#   real 2514 m). D-5 STOPS correcting Kredarica, warming it by ~7.85 °C, so the
#   regeneration moves the cold extreme UP toward -32 °C — away from this bound, not
#   toward it. -50 °C sits below the current committed minimum and below any plausible
#   Slovenian daily grid value (measured record low ≈ -34 °C; mountain grid cells
#   corrected to 2514 m reach the low -40s), so it survives both today's data and the
#   D-5 change while still catching a gross error.
TEMP_MIN_C = -50.0
TEMP_MAX_C = 45.0

# Earliest admissible year: the configured data start (si.yaml data_start_date). The
# upper year bound is computed at run time (current year + 1) so a fresh D-4 re-fetch
# that extends the record is not flagged.
DATA_START_YEAR = 1950  # overridden from config in validate_tables()

# The five variables annual_trend fits, and the four seasons.
TREND_VARIABLES = {
    "temperature_mean", "temperature_max", "temperature_min",
    "precipitation_sum", "et0_evapotranspiration",
}
SEASONS = {"Winter", "Spring", "Summer", "Autumn"}

# Category → colour maps, copied from precompute_datasette.py. A mismatch means the
# categorisation and the colour it drives have drifted apart.
SEASON_CAT_COLOR = {
    "cold": "#3a5a8a", "cool": "#6c8fb6", "normal": "#e7d9b8",
    "hot": "#c25a2c", "extreme": "#962c1a",
}
SPEI_CAT_COLOR = {
    "extreme_dry": "#8b3a0f", "dry": "#c2713a", "normal": "#e7e0d0",
    "wet": "#4a80b0", "extreme_wet": "#1e4d78",
}

TABLE_NAMES = [
    "stations", "daily", "daily_percentiles", "daily_window",
    "annual_trend", "season_heatmap", "tropical", "spei", "spei_station",
]


class PipelineValidationError(Exception):
    """Raised when one or more output tables fail validation. Message lists all."""


# ── datapackage.yaml as the authoritative column declaration (D-18, T-5.3a) ──────
# The per-table column SET is owned by data/climate-si/datapackage.yaml — NOT by a
# hardcoded list here. validate.py owns only the per-column dtype / bounds / domain
# CHECKS; frictionless's coarse string/number/integer/date types are deliberately
# NOT used as dtypes, since they are weaker than the pandera checks below. Each
# schema builder supplies a `{column: pa.Column(...)}` spec map of those checks, and
# `_strict_schema` builds the schema's column set FROM datapackage, pairing each
# declared column with its hand spec.
#
# One mechanism, two guarantees:
#   1. datapackage ↔ validate.py parity — a column renamed in datapackage but not in
#      the spec map (or vice-versa) fails at build, naming the table + column, so the
#      two can no longer silently diverge. This is the redundancy T-5.3a collapses:
#      datapackage becomes the single column source, not a parallel hardcoded list.
#   2. datapackage ↔ data parity — because the resulting strict=True schema runs
#      against the real emitted tables, a column present in the data but not in
#      datapackage (or missing from the data) also fails. The same check that ties
#      validate.py to datapackage therefore also enforces that the published tables
#      match the declared package.


class SchemaColumnMismatch(Exception):
    """A table's hand-declared spec map disagrees with datapackage.yaml's declared
    column set. Carries the offending columns so `validate_tables` can aggregate them
    into named error lines, in the same style as every other validation failure."""

    def __init__(self, table: str, *, missing_spec: list[str] | None = None,
                 extra_spec: list[str] | None = None, no_resource: bool = False):
        self.table = table
        self.missing_spec = missing_spec or []
        self.extra_spec = extra_spec or []
        self.no_resource = no_resource
        super().__init__(table)

    def error_lines(self) -> list[str]:
        if self.no_resource:
            return [f"{self.table}: no resource declared in datapackage.yaml"]
        lines: list[str] = []
        for c in self.missing_spec:
            lines.append(f"{self.table}: column '{c}' is declared in datapackage.yaml "
                         f"but has no validate.py check spec")
        for c in self.extra_spec:
            lines.append(f"{self.table}: column '{c}' has a validate.py check spec "
                         f"but is not declared in datapackage.yaml")
        return lines


def _load_datapackage_columns() -> dict[str, list[str]]:
    """Read the authoritative per-table column set from datapackage.yaml (D-18).

    Returns ``{resource_name: [field name, …]}`` in declared order. Read once and
    threaded into every schema builder, so the file is parsed a single time per
    validate_tables() call. Path override via DATAPACKAGE_FILE (used by tests)."""
    dp_path = Path(os.environ.get(
        "DATAPACKAGE_FILE",
        str(Path(__file__).parent.parent / "datapackage.yaml")))
    with open(dp_path) as f:
        dp = yaml.safe_load(f)
    out: dict[str, list[str]] = {}
    for res in dp.get("resources", []):
        fields = res.get("schema", {}).get("fields")
        if fields is None:
            raise ValueError(
                f"datapackage.yaml resource {res.get('name')!r} has no schema.fields")
        out[res["name"]] = [fld["name"] for fld in fields]
    return out


def _strict_schema(table: str, specs: dict[str, pa.Column],
                   dp_columns: dict[str, list[str]], *,
                   checks=None, unique=None) -> pa.DataFrameSchema:
    """Build a strict DataFrameSchema whose column SET comes from datapackage.yaml
    (D-18), pairing each declared column with its hand-declared spec in ``specs``.
    Raises SchemaColumnMismatch — naming every offending column — when the declared
    set and the spec map disagree."""
    want = dp_columns.get(table)
    if want is None:
        raise SchemaColumnMismatch(table, no_resource=True)
    missing_spec = [c for c in want if c not in specs]
    extra_spec = [c for c in specs if c not in want]
    if missing_spec or extra_spec:
        raise SchemaColumnMismatch(table, missing_spec=missing_spec,
                                   extra_spec=extra_spec)
    columns = {c: specs[c] for c in want}
    kwargs: dict = {"strict": True}
    if checks is not None:
        kwargs["checks"] = checks
    if unique is not None:
        kwargs["unique"] = unique
    return pa.DataFrameSchema(columns, **kwargs)


# ── Reusable checks ─────────────────────────────────────────────────────────────

def _json_parseable(name: str) -> pa.Check:
    def _check(s: pd.Series) -> pd.Series:
        def ok(v) -> bool:
            try:
                json.loads(v)
                return True
            except Exception:
                return False
        return s.map(ok)
    return pa.Check(_check, element_wise=False, error=f"{name} is not valid JSON")


def _monotonic_nondecreasing(cols: list[str]) -> pa.Check:
    """Row-wise: cols[0] <= cols[1] <= … (percentiles must not cross)."""
    def _check(df: pd.DataFrame) -> pd.Series:
        ok = pd.Series(True, index=df.index)
        for a, b in zip(cols, cols[1:]):
            ok &= df[a] <= df[b]
        return ok
    return pa.Check(_check, error=f"percentiles out of order ({' <= '.join(cols)})")


_TEMP = pa.Column(
    float, nullable=False, coerce=True,
    checks=pa.Check.in_range(TEMP_MIN_C, TEMP_MAX_C,
                             error=f"temperature outside [{TEMP_MIN_C}, {TEMP_MAX_C}] °C"),
)
_STATION_ID_NULLABLE = pa.Column(float, nullable=True, coerce=True)


# ── Per-table pandera schemas ───────────────────────────────────────────────────
# Each builder declares only the per-column CHECKS (a `{column: pa.Column(...)}`
# spec map) and hands them to `_strict_schema`, which supplies the authoritative
# column SET from datapackage.yaml (D-18) and enforces strict=True. strict=True: an
# unexpected column is a schema change and must fail. coerce=True so the schema
# behaves identically whether fed the pipeline's in-memory frames or CSVs re-read
# from disk (which widen ints to float where NaNs exist).

def _schema_stations(station_names: list[str], dp_columns) -> pa.DataFrameSchema:
    specs = {
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "name": pa.Column(str),
        "official_name": pa.Column(str),
        "name_locative": pa.Column(str),
        "station_id": _STATION_ID_NULLABLE,
        "xml_id": pa.Column(str, nullable=True),
        "lat": pa.Column(float, pa.Check.in_range(45.0, 47.0), coerce=True),
        "lon": pa.Column(float, pa.Check.in_range(13.0, 17.0), coerce=True),
        "elevation": pa.Column(int, pa.Check.in_range(0, 3000), coerce=True),
        "elevation_era5_m": pa.Column(int, pa.Check.in_range(0, 3000), coerce=True),
    }
    return _strict_schema("stations", specs, dp_columns, unique=["era5_name"])


def _schema_daily(station_names: list[str], max_year: int, dp_columns) -> pa.DataFrameSchema:
    specs = {
        "station_id": _STATION_ID_NULLABLE,
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "date": pa.Column(str),
        "year": pa.Column(int, pa.Check.in_range(DATA_START_YEAR, max_year), coerce=True),
        "month": pa.Column(int, pa.Check.in_range(1, 12), coerce=True),
        "day": pa.Column(int, pa.Check.in_range(1, 31), coerce=True),
        "temperature_max_2m": _TEMP,
        "temperature_average_2m": _TEMP,
        "temperature_min_2m": _TEMP,
    }
    return _strict_schema(
        "daily", specs, dp_columns,
        checks=pa.Check(
            lambda df: (df["temperature_max_2m"] >= df["temperature_average_2m"])
            & (df["temperature_average_2m"] >= df["temperature_min_2m"]),
            error="temperature ordering violated (max >= average >= min)",
        ),
    )


def _schema_daily_percentiles(max_year: int, dp_columns) -> pa.DataFrameSchema:
    cols = ["p05", "p20", "p40", "p60", "p80", "p95"]
    specs = {
        "date": pa.Column(str),
        "station_id": pa.Column(int, coerce=True),
        **{c: _TEMP for c in cols},
    }
    return _strict_schema("daily_percentiles", specs, dp_columns,
                          checks=_monotonic_nondecreasing(cols))


def _schema_daily_window(station_names: list[str], max_year: int, dp_columns) -> pa.DataFrameSchema:
    cols = ["p5", "p10", "p20", "p50", "p80", "p95"]
    year = pa.Check.in_range(DATA_START_YEAR, max_year)
    specs = {
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "station_id": _STATION_ID_NULLABLE,
        "month": pa.Column(int, pa.Check.in_range(1, 12), coerce=True),
        "day": pa.Column(int, pa.Check.in_range(1, 31), coerce=True),
        **{c: _TEMP for c in cols},
        "n_samples": pa.Column(int, pa.Check.ge(50), coerce=True),
        "year_min": pa.Column(int, year, coerce=True),
        "year_max": pa.Column(int, year, coerce=True),
        "distribution_json": pa.Column(str, _json_parseable("distribution_json")),
    }
    return _strict_schema(
        "daily_window", specs, dp_columns,
        checks=[
            _monotonic_nondecreasing(cols),
            pa.Check(lambda df: df["year_min"] <= df["year_max"],
                     error="year_min > year_max"),
        ],
        unique=["era5_name", "month", "day"],
    )


def _schema_annual_trend(station_names: list[str], max_year: int, dp_columns) -> pa.DataFrameSchema:
    year = pa.Check.in_range(DATA_START_YEAR, max_year)
    specs = {
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "station_id": _STATION_ID_NULLABLE,
        "variable": pa.Column(str, pa.Check.isin(sorted(TREND_VARIABLES))),
        "month": pa.Column(int, pa.Check.in_range(1, 12), coerce=True),
        "day": pa.Column(int, pa.Check.in_range(1, 31), coerce=True),
        "day_label": pa.Column(str),
        "year_min": pa.Column(int, year, coerce=True),
        "year_max": pa.Column(int, year, coerce=True),
        "trend10": pa.Column(float, coerce=True),
        "p_val": pa.Column(float, pa.Check.in_range(0.0, 1.0), coerce=True),
        "tau": pa.Column(float, pa.Check.in_range(-1.0, 1.0), coerce=True),
        "n_years": pa.Column(int, pa.Check.ge(10), coerce=True),
        "proj_end_year": pa.Column(int, coerce=True),
        "slope": pa.Column(float, coerce=True),
        "intercept": pa.Column(float, coerce=True),
        "slope_hi": pa.Column(float, coerce=True),
        "intercept_hi": pa.Column(float, coerce=True),
        "slope_lo": pa.Column(float, coerce=True),
        "intercept_lo": pa.Column(float, coerce=True),
        "scatter_json": pa.Column(str, _json_parseable("scatter_json")),
    }
    return _strict_schema(
        "annual_trend", specs, dp_columns,
        checks=[
            pa.Check(lambda df: df["year_min"] <= df["year_max"],
                     error="year_min > year_max"),
            # n_years must equal the inclusive span of years present in the fit.
            pa.Check(lambda df: df["n_years"] == (df["year_max"] - df["year_min"] + 1),
                     error="n_years inconsistent with year_min/year_max span"),
        ],
        unique=["era5_name", "variable", "month", "day"],
    )


def _schema_season_heatmap(station_names: list[str], max_year: int, dp_columns) -> pa.DataFrameSchema:
    specs = {
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "station_id": _STATION_ID_NULLABLE,
        "x": pa.Column(int, pa.Check.in_range(0, 3), coerce=True),
        "y": pa.Column(int, pa.Check.in_range(DATA_START_YEAR, max_year), coerce=True),
        "season": pa.Column(str, pa.Check.isin(sorted(SEASONS))),
        "avg": _TEMP,
        "percentile": pa.Column(float, pa.Check.in_range(0.0, 100.0), coerce=True),
        "cat": pa.Column(str, pa.Check.isin(list(SEASON_CAT_COLOR))),
        "rank": pa.Column(int, pa.Check.ge(1), coerce=True),
        "total": pa.Column(int, pa.Check.ge(1), coerce=True),
        "color": pa.Column(str, pa.Check.isin(list(SEASON_CAT_COLOR.values()))),
        "n_days": pa.Column(int, pa.Check.ge(30), coerce=True),
    }
    return _strict_schema(
        "season_heatmap", specs, dp_columns,
        checks=[
            pa.Check(lambda df: df["rank"] <= df["total"], error="rank > total"),
            pa.Check(lambda df: df["cat"].map(SEASON_CAT_COLOR) == df["color"],
                     error="cat/color mapping inconsistent"),
        ],
    )


def _schema_tropical(station_names: list[str], dp_columns) -> pa.DataFrameSchema:
    specs = {
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "station_id": _STATION_ID_NULLABLE,
        "kind": pa.Column(str, pa.Check.isin(["days", "nights"])),
        "threshold": pa.Column(int, pa.Check.in_range(15, 35), coerce=True),
        "streak": pa.Column(int, pa.Check.isin([1, 2, 3]), coerce=True),
        "years_json": pa.Column(str, _json_parseable("years_json")),
        "counts_json": pa.Column(str, _json_parseable("counts_json")),
        "nonzero_count": pa.Column(int, pa.Check.ge(0), coerce=True),
        "trend_json": pa.Column(str, _json_parseable("trend_json")),
    }
    return _strict_schema(
        "tropical", specs, dp_columns,
        checks=[
            # thresholds are kind-specific: days 25–35, nights 15–25.
            pa.Check(
                lambda df: ~(df["kind"] == "days")
                | df["threshold"].between(25, 35),
                error="tropical 'days' threshold outside 25–35",
            ),
            pa.Check(
                lambda df: ~(df["kind"] == "nights")
                | df["threshold"].between(15, 25),
                error="tropical 'nights' threshold outside 15–25",
            ),
            pa.Check(
                lambda df: df.apply(
                    lambda r: r["nonzero_count"]
                    == sum(1 for c in json.loads(r["counts_json"]) if c > 0),
                    axis=1,
                ),
                error="nonzero_count disagrees with counts_json",
            ),
        ],
    )


def _schema_spei(max_year: int, dp_columns) -> pa.DataFrameSchema:
    specs = {
        "x": pa.Column(int, pa.Check.in_range(0, 3), coerce=True),
        "y": pa.Column(int, pa.Check.in_range(DATA_START_YEAR, max_year), coerce=True),
        "spei": pa.Column(float, pa.Check.in_range(-3.0, 3.0), coerce=True),
        "balance": pa.Column(float, coerce=True),
        "cat": pa.Column(str, pa.Check.isin(list(SPEI_CAT_COLOR))),
        "rank": pa.Column(int, pa.Check.ge(1), coerce=True),
        "total": pa.Column(int, pa.Check.ge(1), coerce=True),
        "color": pa.Column(str, pa.Check.isin(list(SPEI_CAT_COLOR.values()))),
        "season": pa.Column(str, pa.Check.isin(sorted(SEASONS))),
        "n_days": pa.Column(int, pa.Check.ge(30), coerce=True),
    }
    return _strict_schema(
        "spei", specs, dp_columns,
        checks=[
            pa.Check(lambda df: df["rank"] <= df["total"], error="rank > total"),
            pa.Check(lambda df: df["cat"].map(SPEI_CAT_COLOR) == df["color"],
                     error="cat/color mapping inconsistent"),
        ],
    )


def _schema_spei_station(station_names: list[str], dp_columns) -> pa.DataFrameSchema:
    specs = {
        "era5_name": pa.Column(str, pa.Check.isin(station_names)),
        "station_id": _STATION_ID_NULLABLE,
        "series": pa.Column(str),
        "years_json": pa.Column(str, _json_parseable("years_json")),
        "spei_json": pa.Column(str, _json_parseable("spei_json")),
        "trend_json": pa.Column(str, _json_parseable("trend_json")),
    }
    return _strict_schema("spei_station", specs, dp_columns)


# ── Cross-table / structural checks ─────────────────────────────────────────────
# Things a single-table schema cannot express: continuity across rows, agreement
# between two tables, exact station list. Each returns a list of error strings.

def _check_stations_match_config(stations: pd.DataFrame, config: dict) -> list[str]:
    errs: list[str] = []
    cfg = config["stations"]
    exp_names = [s["name"].replace("_", " ") for s in cfg]
    got_names = list(stations["name"])
    if len(stations) != len(cfg):
        errs.append(f"stations: expected {len(cfg)} rows, got {len(stations)}")
    if got_names != exp_names:
        errs.append(f"stations: name list does not match si.yaml "
                    f"(expected {exp_names}, got {got_names})")
    for field in ("elevation", "elevation_era5_m", "lat", "lon"):
        exp = [s[field] for s in cfg]
        got = list(stations[field])
        if got != exp:
            errs.append(f"stations: {field} does not match si.yaml "
                        f"(expected {exp}, got {got})")
    return errs


def _check_daily_continuity(daily: pd.DataFrame, n_stations: int) -> list[str]:
    errs: list[str] = []
    d = daily.copy()
    d["_d"] = pd.to_datetime(d["date"], format="%Y-%m-%d")
    if d["era5_name"].nunique() != n_stations:
        errs.append(f"daily: expected {n_stations} stations, "
                    f"got {d['era5_name'].nunique()}")
    for name, g in d.groupby("era5_name"):
        dates = g["_d"]
        dups = dates.duplicated().sum()
        if dups:
            errs.append(f"daily[{name}]: {dups} duplicate date(s)")
        expected = (dates.max() - dates.min()).days + 1
        if len(g) != expected:
            errs.append(f"daily[{name}]: {expected - len(g)} missing day(s) "
                        f"between {dates.min().date()} and {dates.max().date()} "
                        f"(have {len(g)} rows, expect {expected})")
    return errs


def _check_doy_count(df: pd.DataFrame, table: str, group: str,
                     expected: int = 365) -> list[str]:
    counts = df.groupby(group).size()
    bad = counts[counts != expected]
    return [f"{table}[{k}]: {v} day-of-year rows, expected {expected}"
            for k, v in bad.items()]


def _check_window_year_bounds(daily: pd.DataFrame,
                              daily_window: pd.DataFrame) -> list[str]:
    """daily_window.year_min/max must equal each station's actual data span."""
    errs: list[str] = []
    yr = pd.to_datetime(daily["date"], format="%Y-%m-%d").dt.year
    span = pd.DataFrame({"era5_name": daily["era5_name"], "y": yr}) \
        .groupby("era5_name")["y"].agg(["min", "max"])
    for name, g in daily_window.groupby("era5_name"):
        if name not in span.index:
            errs.append(f"daily_window[{name}]: station absent from daily")
            continue
        exp_min, exp_max = int(span.loc[name, "min"]), int(span.loc[name, "max"])
        got_min, got_max = int(g["year_min"].iloc[0]), int(g["year_max"].iloc[0])
        if (g["year_min"] != exp_min).any() or (g["year_max"] != exp_max).any():
            errs.append(f"daily_window[{name}]: year bounds {got_min}-{got_max} "
                        f"disagree with daily span {exp_min}-{exp_max}")
    return errs


def _check_percentile_stations_subset(daily_percentiles: pd.DataFrame,
                                      stations: pd.DataFrame) -> list[str]:
    known = set(stations["station_id"].dropna().astype(int))
    got = set(daily_percentiles["station_id"].astype(int))
    unknown = got - known
    return [f"daily_percentiles: station_id(s) not in stations table: {sorted(unknown)}"] \
        if unknown else []


def _check_spei_consistency(spei: pd.DataFrame,
                            spei_station: pd.DataFrame | None) -> list[str]:
    """Tripwire for fabricated / degraded SPEI (D-16, T-5.1 part 4).

    Correct SPEI is ``norm_ppf(fisk_cdf(balance − shift))`` under ONE log-logistic
    fit per group, and both transforms are strictly increasing. Two invariants
    follow, and both hold *by construction* on every valid series (so this passes on
    current data) yet break the moment SPEI is not a real fit of the balance:

      1. Ordering a group's rows by water balance orders SPEI non-decreasingly.
         Violated by SPEI that is scrambled, decoupled from balance, inverted, or
         produced by a different/degenerate distribution per row.
      2. A group spanning many wet-to-dry years cannot collapse to a single SPEI
         value. Violated by a fit that collapsed to a constant or pinned every row
         to a clip boundary.

    Why this exists: `_spei_from_balances` used to FABRICATE `c_par=1.0,
    scale_par=mean` on a Fisk-fit failure and emit SPEI from them silently. Those
    values still clip to [-3,3] with a valid cat/colour/rank, so every per-table
    pandera schema passed them. D-16 removed the fabrication at source (the series is
    now withheld, not invented); this is the second line of defence so that any
    *future* fabrication or degradation fails the image build (validate runs at build
    time, D-9) instead of shipping corrupt drought numbers.

    Scope, stated honestly: it catches SPEI that is decoupled, scrambled, inverted or
    collapsed — the shapes a broken fit or a wiring bug actually produce. It does NOT
    catch an arbitrary monotone-but-miscalibrated curve (the old c=1 fabrication was
    itself monotone); guarding that would need a fuzzy statistical threshold that
    could false-positive on legitimately extreme drought decades, which is why the
    primary defence is removal-at-source, not this check. Withheld series (absent
    rows, or an empty SPEI array) are the honest sentinel and are deliberately NOT
    flagged. Narrow by design — SPEI integrity only, no unrelated assertions.
    """
    errs: list[str] = []
    # (1)+(2) national heatmap: monotone in balance, non-degenerate, per season x.
    for x, g in spei.groupby("x"):
        s = g.sort_values("balance", kind="stable")["spei"].to_numpy()
        if len(s) >= 2 and (np.diff(s) < 0).any():
            errs.append(f"spei[x={x}]: SPEI not monotone in water balance "
                        f"— decoupled/scrambled/fabricated fit")
        if len(s) >= 2 and float(np.ptp(s)) == 0.0:
            errs.append(f"spei[x={x}]: SPEI constant across {len(s)} varying "
                        f"balances — collapsed/degenerate fit")
    # (2) per-station series: years/SPEI arrays equal length; a multi-year SPEI array
    #     must vary. Empty arrays (the withhold sentinel) are intentionally allowed.
    if spei_station is not None:
        for _, r in spei_station.iterrows():
            years = json.loads(r["years_json"])
            spei_arr = json.loads(r["spei_json"])
            tag = f"spei_station[{r['era5_name']}/{r['series']}]"
            if len(years) != len(spei_arr):
                errs.append(f"{tag}: years/SPEI length mismatch "
                            f"({len(years)} vs {len(spei_arr)})")
            if len(spei_arr) >= 2 and len(set(spei_arr)) == 1:
                errs.append(f"{tag}: SPEI constant across {len(spei_arr)} years "
                            f"— collapsed/degenerate fit")
    return errs


# ── Orchestration ───────────────────────────────────────────────────────────────

def validate_tables(tables: dict[str, pd.DataFrame], config: dict | None = None) -> None:
    """Validate every pipeline output table. Raise PipelineValidationError on any
    violation, with a message listing all of them. Returns None on success."""
    global DATA_START_YEAR
    if config is None:
        config = _load_config()
    DATA_START_YEAR = int(str(config.get("data_start_date", "1950"))[:4])
    max_year = datetime.now().year + 1
    station_names = [s["name"] for s in config["stations"]]
    n_stations = len(station_names)

    # The authoritative per-table column set (D-18), read once and threaded into
    # every schema builder below.
    dp_columns = _load_datapackage_columns()

    errors: list[str] = []

    missing = [t for t in TABLE_NAMES if t not in tables]
    if missing:
        errors.append(f"missing table(s): {missing}")

    schemas = {
        "stations": lambda: _schema_stations(station_names, dp_columns),
        "daily": lambda: _schema_daily(station_names, max_year, dp_columns),
        "daily_percentiles": lambda: _schema_daily_percentiles(max_year, dp_columns),
        "daily_window": lambda: _schema_daily_window(station_names, max_year, dp_columns),
        "annual_trend": lambda: _schema_annual_trend(station_names, max_year, dp_columns),
        "season_heatmap": lambda: _schema_season_heatmap(station_names, max_year, dp_columns),
        "tropical": lambda: _schema_tropical(station_names, dp_columns),
        "spei": lambda: _schema_spei(max_year, dp_columns),
        "spei_station": lambda: _schema_spei_station(station_names, dp_columns),
    }

    for name, build in schemas.items():
        df = tables.get(name)
        if df is None:
            continue
        try:
            build().validate(df, lazy=True)
        except SchemaColumnMismatch as e:
            # datapackage.yaml ↔ validate.py spec-map drift: report each offending
            # column and skip pandera for this table (its column set is unresolved).
            errors.extend(e.error_lines())
        except pa.errors.SchemaErrors as e:
            for _, row in e.failure_cases.iterrows():
                errors.append(
                    f"{name}: {row.get('check')} "
                    f"[col={row.get('column')}, value={row.get('failure_case')!r}]"
                )
        except pa.errors.SchemaError as e:
            errors.append(f"{name}: {e}")

    # Cross-table / structural checks (only when the inputs are present).
    if "stations" in tables:
        errors += _check_stations_match_config(tables["stations"], config)
    if "daily" in tables:
        errors += _check_daily_continuity(tables["daily"], n_stations)
    if "daily_window" in tables:
        errors += _check_doy_count(tables["daily_window"], "daily_window", "era5_name")
    if "daily_percentiles" in tables:
        errors += _check_doy_count(tables["daily_percentiles"],
                                   "daily_percentiles", "station_id")
    if "daily" in tables and "daily_window" in tables:
        errors += _check_window_year_bounds(tables["daily"], tables["daily_window"])
    if "daily_percentiles" in tables and "stations" in tables:
        errors += _check_percentile_stations_subset(tables["daily_percentiles"],
                                                    tables["stations"])
    if "spei" in tables:
        errors += _check_spei_consistency(tables["spei"], tables.get("spei_station"))

    if errors:
        raise PipelineValidationError(
            f"{len(errors)} validation error(s):\n  - " + "\n  - ".join(errors)
        )


def _load_committed_tables(tables_dir: Path) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    for name in TABLE_NAMES:
        path = tables_dir / f"climate-si.{name}.csv"
        if not path.exists():
            sys.exit(f"table CSV not found: {path}")
        out[name] = pd.read_csv(path)
    return out


def main() -> int:
    tables_dir = Path(os.environ.get(
        "TABLES_DIR", str(Path(__file__).parent.parent / "data")))
    print(f"Validating pipeline tables in {tables_dir}")
    tables = _load_committed_tables(tables_dir)
    try:
        validate_tables(tables)
    except PipelineValidationError as e:
        print(f"\nFAIL — {e}", file=sys.stderr)
        return 1
    print(f"OK — all {len(TABLE_NAMES)} tables valid "
          f"({', '.join(TABLE_NAMES)}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
