"""T-5.11 — the raw-input validator must pass on valid per-station frames and fail
loudly on a corrupted one, so a future edit that weakens a check into a no-op goes red.

Mirrors test_validate.py: build a structurally valid set of raw frames in code, keyed
to the real si.yaml station list, then mutate one field per negative case. The frames
carry dummy but physically-plausible values — validate_raw checks shape, bounds,
date continuity and si.yaml agreement, not that the numbers are correct.
"""

import pandas as pd
import pytest

import validate as v
import validate_raw as vr

# A short continuous daily span shared by every station frame. Length only has to be
# gap-free; 10 days keeps the frames small.
_START, _END = "2000-01-01", "2000-01-10"


def _build_valid_frames(config: dict) -> dict[str, pd.DataFrame]:
    dates = pd.date_range(_START, _END).strftime("%Y-%m-%d")
    frames: dict[str, pd.DataFrame] = {}
    for s in config["stations"]:
        n = len(dates)
        diff = float(s["elevation_era5_m"] - s["elevation"])
        frames[s["name"]] = pd.DataFrame({
            "location": s["name"],
            "latitude": float(s["lat"]),
            "longitude": float(s["lon"]),
            "elevation_station_m": int(s["elevation"]),
            "elevation_era5_m": float(s["elevation_era5_m"]),
            "elevation_diff_m": diff,
            "date": dates,
            "temperature_max": [10.0] * n,
            "temperature_min": [0.0] * n,
            "temperature_mean": [5.0] * n,
            "precipitation_sum": [1.0] * n,
            "et0_evapotranspiration": [1.0] * n,
            "source": ["era5"] * (n - 1) + ["era5t"],
        })
    return frames


@pytest.fixture(scope="module")
def config() -> dict:
    return v._load_config()


@pytest.fixture(scope="module")
def frames(config) -> dict[str, pd.DataFrame]:
    return _build_valid_frames(config)


def _one(frames: dict[str, pd.DataFrame]) -> str:
    """A representative station name present in the frames."""
    return next(iter(frames))


def _expect_error(frames, snippet):
    with pytest.raises(v.PipelineValidationError) as ei:
        vr.validate_raw_stations(frames)
    assert snippet in str(ei.value), str(ei.value)


def test_valid_frames_pass(frames):
    # Raises PipelineValidationError on any violation; passing == returns None.
    vr.validate_raw_stations(dict(frames))


def test_temperature_out_of_bounds(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d.loc[0, "temperature_max"] = 99.9
    f[name] = d
    _expect_error(f, "temperature outside")


def test_temperature_ordering(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d.loc[0, "temperature_min"] = d.loc[0, "temperature_max"] + 5
    f[name] = d
    _expect_error(f, "temperature ordering violated")


def test_duplicate_date(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d.loc[1, "date"] = d.loc[0, "date"]  # duplicate the first date
    f[name] = d
    _expect_error(f, "duplicate date")


def test_date_gap(frames):
    f = dict(frames)
    name = _one(f)
    f[name] = frames[name].drop(index=5).reset_index(drop=True)
    _expect_error(f, "missing day")


def test_elevation_diff_wrong(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d["elevation_diff_m"] = d["elevation_diff_m"] + 100.0
    f[name] = d
    _expect_error(f, "does not match si.yaml")


def test_elevation_diff_not_constant(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d.loc[0, "elevation_diff_m"] = d.loc[0, "elevation_diff_m"] + 1.0
    f[name] = d
    _expect_error(f, "not constant")


def test_bad_source(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d.loc[0, "source"] = "forecast"
    f[name] = d
    _expect_error(f, "isin")


def test_unexpected_column_is_drift(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d["surprise"] = 1
    f[name] = d
    _expect_error(f, "column")


def test_missing_column_is_drift(frames):
    f = dict(frames)
    name = _one(f)
    f[name] = frames[name].drop(columns=["source"])
    _expect_error(f, "column")


def test_location_mismatch(frames):
    f = dict(frames)
    name = _one(f)
    d = frames[name].copy()
    d["location"] = "Elsewhere"
    f[name] = d
    _expect_error(f, "does not match station name")


def test_missing_station_file(frames):
    f = dict(frames)
    name = _one(f)
    del f[name]
    _expect_error(f, "missing raw station file")


def test_extra_station_file(frames):
    f = dict(frames)
    f["Atlantis"] = next(iter(frames.values())).copy()
    _expect_error(f, "not in si.yaml")


def test_negatives_aggregate(frames):
    # Two independent violations must both appear — the validator does not stop at
    # the first (validate.py's aggregate behaviour, reused here).
    f = dict(frames)
    names = list(f)
    a, b = names[0], names[1]
    da = frames[a].copy()
    da.loc[0, "temperature_max"] = 99.9
    f[a] = da
    db = frames[b].copy()
    db.loc[0, "source"] = "nope"
    f[b] = db
    with pytest.raises(v.PipelineValidationError) as ei:
        vr.validate_raw_stations(f)
    msg = str(ei.value)
    assert f"raw[{a}]" in msg and f"raw[{b}]" in msg, msg
