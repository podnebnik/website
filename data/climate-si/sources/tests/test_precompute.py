"""T-3.5 — unit tests for the pipeline logic Phase 4 will change.

Scope is deliberately narrow: window_filter (T-4.5's leap/doy fix), the lapse
correction (T-4.4 removes it for Kredarica) and the baseline period constant
(T-4.2 unifies it to 1991-2020). Each expectation is hand-computed from the
calendar / the formula, never read back from the code, so a Phase 4 edit that
moves a value fails loudly.
"""

import pandas as pd
from pytest import approx

import precompute_datasette as pc


def _make_df(dates):
    """A minimal loc_data frame for window_filter: a datetime `date` + `year`."""
    d = pd.to_datetime(pd.Series(dates), format="%Y-%m-%d")
    return pd.DataFrame({"date": d, "year": d.dt.year})


def _result(out):
    """{yyyy-mm-dd: _window_year} for the rows window_filter kept."""
    return {
        d.strftime("%Y-%m-%d"): int(y)
        for d, y in zip(out["date"], out["_window_year"])
    }


# ── window_filter ────────────────────────────────────────────────────────────
#
# window_filter centres a ±half-day circular window on a target day-of-year, but
# the target doy is computed on the FIXED non-leap year 2001 while each row's doy
# comes from its own real calendar. In a leap year those disagree after 28 Feb —
# the mod-365 vs non-leap-2001 mismatch these tests pin. T-4.5 will fix it.


def test_window_leap_mismatch_matches_feb29_not_mar1():
    # Target = 1 March, half = 0 (only exact-doy rows survive).
    # target_doy = pd.Timestamp(2001, 3, 1).dayofyear = 60.
    #   2003-03-01 doy 60  -> raw 0  -> circ 0   -> KEPT  (window_year 2003)
    #   2004-03-01 doy 61  -> raw 1  -> circ 1   -> dropped (leap shifts it off)
    #   2004-02-29 doy 60  -> raw 0  -> circ 0   -> KEPT  (window_year 2004) — the
    #                                               leap day matches "1 March"
    #   2003-03-02 doy 61  -> raw 1  -> circ 1   -> dropped
    df = _make_df(["2003-03-01", "2004-03-01", "2004-02-29", "2003-03-02"])
    out = pc.window_filter(df, 3, 1, 0)
    assert _result(out) == {"2003-03-01": 2003, "2004-02-29": 2004}


def test_window_wraps_forward_across_year_start():
    # Target = 1 Jan (doy 1), half = 7.
    #   2010-12-29 doy 363 -> raw 362 -> circ -3 -> KEPT, raw>182 -> window_year +1 = 2011
    #   2011-01-01 doy 1   -> raw 0   -> circ 0  -> KEPT, window_year 2011
    #   2011-01-08 doy 8   -> raw 7   -> circ 7  -> KEPT (edge of window), window_year 2011
    #   2011-07-01 doy 182 -> raw 181 -> circ 181 -> dropped (mid-year)
    df = _make_df(["2010-12-29", "2011-01-01", "2011-01-08", "2011-07-01"])
    out = pc.window_filter(df, 1, 1, 7)
    assert _result(out) == {
        "2010-12-29": 2011,
        "2011-01-01": 2011,
        "2011-01-08": 2011,
    }


def test_window_wraps_backward_across_year_end():
    # Target = 31 Dec (doy 365), half = 7.
    #   2010-12-31 doy 365 -> raw 0    -> circ 0 -> KEPT, window_year 2010
    #   2011-01-02 doy 2   -> raw -363 -> circ 2 -> KEPT, raw<-182 -> window_year -1 = 2010
    df = _make_df(["2010-12-31", "2011-01-02"])
    out = pc.window_filter(df, 12, 31, 7)
    assert _result(out) == {"2010-12-31": 2010, "2011-01-02": 2010}


def test_window_feb29_target_falls_back_to_feb28():
    # pd.Timestamp(2001, 2, 29) is invalid (2001 non-leap) -> the except clause
    # retargets on 28 Feb (doy 59). So asking for 29 Feb, half=0, actually keeps
    # the 28 Feb rows and NOT the real 29 Feb.
    #   2003-02-28 doy 59 -> raw 0 -> KEPT (window_year 2003)
    #   2004-02-28 doy 59 -> raw 0 -> KEPT (window_year 2004)
    #   2004-02-29 doy 60 -> raw 1 -> dropped
    df = _make_df(["2003-02-28", "2004-02-28", "2004-02-29"])
    out = pc.window_filter(df, 2, 29, 0)
    assert _result(out) == {"2003-02-28": 2003, "2004-02-28": 2004}


# ── lapse correction ─────────────────────────────────────────────────────────
#
# load_all adds `<col>_corr = <col> + elevation_diff_m * LAPSE_RATE` for max/min/
# mean — a uniform 6.5 °C/km applied to EVERY station, Kredarica included. D-5 /
# T-4.4 will stop correcting Kredarica (present it at its ERA5 grid cell instead).
# These pin the current uniform correction and the 0.0065 constant.


def test_lapse_correction_is_uniform_and_covers_kredarica(tmp_path, monkeypatch):
    csv = tmp_path / "Test.csv"
    csv.write_text(
        "date,temperature_max,temperature_min,temperature_mean,elevation_diff_m,source\n"
        "2000-01-01,10.0,2.0,6.0,0.0,era5\n"      # no offset -> unchanged
        "2000-01-02,12.0,4.0,8.0,-100.0,era5\n"   # -100 m -> -0.65 °C
        "2000-01-03,8.0,0.0,4.0,-1207.0,era5\n"   # Kredarica-like (grid 1307 m, stn 2514 m) -> -7.8455 °C
        "2000-01-04,20.0,10.0,15.0,-100.0,era5t\n"  # preliminary -> dropped by load_all
    )
    monkeypatch.setattr(pc, "DATA_DIR", tmp_path)

    data = pc.load_all()

    # era5t rows are excluded (source filter), leaving the three era5 days.
    assert set(data["date"].dt.strftime("%Y-%m-%d")) == {
        "2000-01-01",
        "2000-01-02",
        "2000-01-03",
    }

    by_date = data.set_index(data["date"].dt.strftime("%Y-%m-%d"))
    # <col> + elevation_diff_m * 0.0065, hand-computed:
    assert by_date.loc["2000-01-01", "temperature_max_corr"] == approx(10.0)       # 10 + 0
    assert by_date.loc["2000-01-02", "temperature_max_corr"] == approx(11.35)      # 12 - 0.65
    assert by_date.loc["2000-01-03", "temperature_max_corr"] == approx(0.1545)     # 8 - 7.8455 (Kredarica corrected)
    # min and mean use the same offset.
    assert by_date.loc["2000-01-02", "temperature_min_corr"] == approx(3.35)       # 4 - 0.65
    assert by_date.loc["2000-01-02", "temperature_mean_corr"] == approx(7.35)      # 8 - 0.65


def test_lapse_rate_constant():
    assert pc.LAPSE_RATE == 0.0065


# ── baseline period constant ─────────────────────────────────────────────────
#
# BASELINE_START/END are read from si.yaml (currently 1950-1980). D-3 mandates a
# single 1991-2020 baseline everywhere; T-4.2 will make that change. Pinning the
# CURRENT values so that unification trips this test and re-baselines consciously
# rather than silently moving every anomaly.


def test_baseline_period_is_current_pre_t4_2_value():
    assert pc.BASELINE_START == 1950
    assert pc.BASELINE_END == 1980
