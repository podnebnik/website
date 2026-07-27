"""
T-5.11 — validate the RAW per-station input CSVs before they reach the build.

The nine Pandera schemas in ``validate.py`` describe the *derived* tables only. A
malformed raw input (a bad dtype, a duplicate or skipped date, an out-of-range
temperature, a wrong ``elevation_diff_m``, an unknown ``source``) therefore passes
every PR gate and only fails at datasette image-build time — after merge, in a job
whose error names a derived table rather than the raw row that caused it.

This module closes that gap. It validates ``data/climate-si/data/raw/<Station>.csv``
against the same physical bounds and station config the derived tables use, so a
broken raw row fails on the PR that introduces it, naming the raw problem. It is a
hard prerequisite for T-5.7d (the weekly refresh Action), which would otherwise land
unvalidated data on a schedule.

It deliberately *reuses* ``validate.py`` rather than duplicating it: the temperature
bounds, the ``PipelineValidationError`` type, the config loader and — most
importantly — the lazy, aggregate-every-violation behaviour (collect every failure
across every station and report them together, never stop at the first). It does not
touch ``validate.py``; the nine derived schemas are unchanged.

Run it:

    uv run --project data/climate-si/sources python \
        data/climate-si/sources/validate_raw.py

It reads every station listed in ``si.yaml`` from ``data/climate-si/data/raw/``
(override the directory with RAW_DIR) and exits 0 if every file is valid, 1 otherwise.

Design notes
------------
* The raw files carry 13 columns — more than the five the ticket enumerated. A strict
  schema must declare all of them: an unexpected or missing column is itself drift.
* Temperature bounds are imported from ``validate.py`` (``TEMP_MIN_C`` / ``TEMP_MAX_C``,
  currently [-50, 45] °C) so raw and derived never disagree — the raw values feed the
  derived tables, so a bound the raw passes but the derived rejects would be a trap.
* ``max >= mean >= min`` is asserted per row: it holds on all 502,956 current raw rows,
  and a violation is a unit/sign/merge bug, not weather.
* ``elevation_diff_m`` must be constant within a file and equal ``elevation_era5_m -
  elevation`` from ``si.yaml`` for that station — the same si.yaml the derived
  ``stations`` table is checked against (``validate._check_stations_match_config``).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import pandera.pandas as pa

# Reuse — do NOT re-derive — the pieces that must agree with the derived-table
# validator. Importing keeps the two from drifting apart.
from validate import (
    PipelineValidationError,
    TEMP_MIN_C,
    TEMP_MAX_C,
    _load_config,
)

# ── Constants ───────────────────────────────────────────────────────────────────

# The two provenance states a raw row can carry: 'era5' (final reanalysis) or 'era5t'
# (preliminary, within ~5 days, revised in place by mk_collect's 15-day refresh
# window). Any other value is corruption. (The frontend's third "forecast" state never
# reaches these files — it is a client-side Open-Meteo fallback, D-11.)
ALLOWED_SOURCES = ["era5", "era5t"]

# Physical, non-negative daily accumulations. Upper bounds are generous headroom over
# the current data (precip max 153.5 mm, et0 max 8.4 mm) — wide enough not to flag real
# weather, tight enough to catch a unit/scale error.
PRECIP_MAX_MM = 500.0
ET0_MAX_MM = 25.0

# The 13 columns every raw station file must carry, in no particular order (pandera
# does not care about order; strict=True cares that the set matches exactly).
RAW_COLUMNS = [
    "location", "latitude", "longitude",
    "elevation_station_m", "elevation_era5_m", "elevation_diff_m",
    "date", "temperature_max", "temperature_min", "temperature_mean",
    "precipitation_sum", "et0_evapotranspiration", "source",
]


# ── Schema ──────────────────────────────────────────────────────────────────────
# strict=True: an unexpected or missing column is a schema change and must fail.
# coerce=True so the schema behaves identically whether fed CSVs re-read from disk or
# in-memory frames (the raw files store elevation_era5_m as e.g. "300.0").

def _temp_col() -> pa.Column:
    return pa.Column(
        float, nullable=False, coerce=True,
        checks=pa.Check.in_range(
            TEMP_MIN_C, TEMP_MAX_C,
            error=f"temperature outside [{TEMP_MIN_C}, {TEMP_MAX_C}] °C"),
    )


def _date_parseable() -> pa.Check:
    def _check(s: pd.Series) -> pd.Series:
        parsed = pd.to_datetime(s, format="%Y-%m-%d", errors="coerce")
        return parsed.notna()
    return pa.Check(_check, element_wise=False,
                    error="date not parseable as YYYY-MM-DD")


def _schema_raw_station() -> pa.DataFrameSchema:
    return pa.DataFrameSchema(
        {
            "location": pa.Column(str, nullable=False),
            "latitude": pa.Column(float, pa.Check.in_range(45.0, 47.0), coerce=True),
            "longitude": pa.Column(float, pa.Check.in_range(13.0, 17.0), coerce=True),
            "elevation_station_m": pa.Column(
                int, pa.Check.in_range(0, 3000), coerce=True),
            "elevation_era5_m": pa.Column(
                float, pa.Check.in_range(0.0, 3000.0), coerce=True),
            "elevation_diff_m": pa.Column(float, nullable=False, coerce=True),
            "date": pa.Column(str, _date_parseable()),
            "temperature_max": _temp_col(),
            "temperature_min": _temp_col(),
            "temperature_mean": _temp_col(),
            "precipitation_sum": pa.Column(
                float, pa.Check.in_range(0.0, PRECIP_MAX_MM), coerce=True),
            "et0_evapotranspiration": pa.Column(
                float, pa.Check.in_range(0.0, ET0_MAX_MM), coerce=True),
            "source": pa.Column(str, pa.Check.isin(ALLOWED_SOURCES)),
        },
        strict=True,
        checks=pa.Check(
            lambda df: (df["temperature_max"] >= df["temperature_mean"])
            & (df["temperature_mean"] >= df["temperature_min"]),
            error="temperature ordering violated (max >= mean >= min)",
        ),
    )


# ── Structural per-file checks ──────────────────────────────────────────────────
# Things a single-row schema cannot express: continuity across rows, a value being
# constant down a column, agreement with si.yaml. Each returns a list of error strings
# so the orchestrator can aggregate them (mirrors validate._check_* behaviour).

def _check_date_continuity(name: str, df: pd.DataFrame) -> list[str]:
    """date must be strictly increasing, unique, and gap-free (consecutive days)."""
    errs: list[str] = []
    d = pd.to_datetime(df["date"], format="%Y-%m-%d", errors="coerce")
    if d.isna().any():
        # unparseable dates are reported by the schema; skip continuity here.
        return errs
    dups = d.duplicated().sum()
    if dups:
        errs.append(f"raw[{name}]: {dups} duplicate date(s)")
    if not d.is_monotonic_increasing:
        errs.append(f"raw[{name}]: dates not monotonic increasing")
    expected = (d.max() - d.min()).days + 1
    if len(d) != expected:
        errs.append(f"raw[{name}]: {expected - len(d)} missing day(s) between "
                    f"{d.min().date()} and {d.max().date()} "
                    f"(have {len(d)} rows, expect {expected})")
    return errs


def _check_elevation(name: str, df: pd.DataFrame,
                     cfg_station: dict) -> list[str]:
    """elevation_diff_m constant within the file and equal to
    elevation_era5_m - elevation from si.yaml for this station."""
    errs: list[str] = []
    diffs = df["elevation_diff_m"].unique()
    if len(diffs) != 1:
        errs.append(f"raw[{name}]: elevation_diff_m not constant "
                    f"(values {sorted(diffs.tolist())})")
        return errs
    got = float(diffs[0])
    expected = float(cfg_station["elevation_era5_m"] - cfg_station["elevation"])
    if abs(got - expected) > 1e-6:
        errs.append(f"raw[{name}]: elevation_diff_m {got} does not match si.yaml "
                    f"(elevation_era5_m {cfg_station['elevation_era5_m']} - "
                    f"elevation {cfg_station['elevation']} = {expected})")
    return errs


def _check_location(name: str, df: pd.DataFrame) -> list[str]:
    """location must be constant and equal the station's si.yaml name."""
    locs = df["location"].unique()
    if len(locs) != 1 or str(locs[0]) != name:
        return [f"raw[{name}]: location column {sorted(map(str, locs))} "
                f"does not match station name {name!r}"]
    return []


# ── Orchestration ───────────────────────────────────────────────────────────────

def validate_raw_stations(frames: dict[str, pd.DataFrame],
                          config: dict | None = None) -> None:
    """Validate every raw per-station frame. Raise PipelineValidationError on any
    violation, with a message listing all of them across all stations. Returns None
    on success. ``frames`` maps si.yaml station name -> raw DataFrame."""
    if config is None:
        config = _load_config()
    cfg_by_name = {s["name"]: s for s in config["stations"]}
    expected = set(cfg_by_name)
    got = set(frames)

    errors: list[str] = []

    missing = sorted(expected - got)
    if missing:
        errors.append(f"missing raw station file(s): {missing}")
    extra = sorted(got - expected)
    if extra:
        errors.append(f"raw station file(s) not in si.yaml: {extra}")

    schema = _schema_raw_station()
    for name in sorted(expected & got):
        df = frames[name]
        try:
            schema.validate(df, lazy=True)
        except pa.errors.SchemaErrors as e:
            for _, row in e.failure_cases.iterrows():
                errors.append(
                    f"raw[{name}]: {row.get('check')} "
                    f"[col={row.get('column')}, value={row.get('failure_case')!r}]")
        except pa.errors.SchemaError as e:
            errors.append(f"raw[{name}]: {e}")
        # Structural checks run regardless of schema outcome so a file's problems are
        # all reported at once (aggregate, don't stop at the first).
        errors += _check_date_continuity(name, df)
        errors += _check_elevation(name, df, cfg_by_name[name])
        errors += _check_location(name, df)

    if errors:
        raise PipelineValidationError(
            f"{len(errors)} raw validation error(s):\n  - " + "\n  - ".join(errors))


def _load_raw_frames(raw_dir: Path, config: dict) -> dict[str, pd.DataFrame]:
    """Read every si.yaml station's raw CSV from raw_dir. A station whose file is
    absent is reported as a missing-file error rather than crashing the load."""
    frames: dict[str, pd.DataFrame] = {}
    for s in config["stations"]:
        path = raw_dir / f"{s['name']}.csv"
        if path.exists():
            frames[s["name"]] = pd.read_csv(path)
    return frames


def main() -> int:
    config = _load_config()
    raw_dir = Path(os.environ.get(
        "RAW_DIR", str(Path(__file__).parent.parent / "data" / "raw")))
    print(f"Validating raw station inputs in {raw_dir}")
    frames = _load_raw_frames(raw_dir, config)
    try:
        validate_raw_stations(frames, config)
    except PipelineValidationError as e:
        print(f"\nFAIL — {e}", file=sys.stderr)
        return 1
    print(f"OK — all {len(frames)} raw station file(s) valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
