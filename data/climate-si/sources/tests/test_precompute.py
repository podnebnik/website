"""T-3.5 — unit tests for the pipeline logic Phase 4 will change.

Scope is deliberately narrow: window_filter (T-4.5's leap/doy fix), the lapse
correction (T-4.4 removes it for Kredarica) and the baseline period constant
(T-4.2 unified it to 1991-2020, with SPEI carved out at 1950-1980). Each
expectation is hand-computed from the
calendar / the formula, never read back from the code, so a Phase 4 edit that
moves a value fails loudly.
"""

import numpy as np
import pandas as pd
import pytest
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
# window_filter centres a ±half-day circular window on a target day-of-year. Both
# the target doy AND each row's doy are now built on the FIXED non-leap 2001
# calendar (T-4.5), with 29 Feb folded into 28 Feb (doy 59, D-12). Before T-4.5 the
# target was 2001-based while each row's doy came from its own real (leap-aware)
# calendar, so in a leap year they disagreed after 28 Feb — the mismatch these tests
# used to pin, now inverted to the corrected behaviour.


def test_window_leap_target_mar1_matches_mar1_not_feb29():
    # Target = 1 March, half = 0 (only exact-doy rows survive).
    # target_doy = pd.Timestamp(2001, 3, 1).dayofyear = 60.
    #   2003-03-01 -> non-leap doy 60 -> raw 0  -> circ 0 -> KEPT (window_year 2003)
    #   2004-03-01 -> non-leap doy 60 -> raw 0  -> circ 0 -> KEPT (window_year 2004) —
    #                                              the leap year's 1 March now matches
    #   2004-02-29 -> folds to 28 Feb, doy 59 -> raw -1 -> dropped (no longer "1 March")
    #   2003-03-02 -> non-leap doy 61 -> raw 1  -> circ 1 -> dropped
    df = _make_df(["2003-03-01", "2004-03-01", "2004-02-29", "2003-03-02"])
    out = pc.window_filter(df, 3, 1, 0)
    assert _result(out) == {"2003-03-01": 2003, "2004-03-01": 2004}


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


def test_window_feb29_target_pools_with_feb28():
    # pd.Timestamp(2001, 2, 29) is invalid (2001 non-leap) -> the except clause
    # retargets on 28 Feb (doy 59). Under T-4.5 the real 29 Feb rows ALSO fold to
    # doy 59 (D-12), so asking for 29 Feb, half=0, keeps the 28 Feb rows AND the
    # 29 Feb rows — they share one slot.
    #   2003-02-28 -> doy 59            -> raw 0 -> KEPT (window_year 2003)
    #   2004-02-28 -> doy 59            -> raw 0 -> KEPT (window_year 2004)
    #   2004-02-29 -> folds to doy 59   -> raw 0 -> KEPT (window_year 2004)
    df = _make_df(["2003-02-28", "2004-02-28", "2004-02-29"])
    out = pc.window_filter(df, 2, 29, 0)
    assert _result(out) == {"2003-02-28": 2003, "2004-02-28": 2004, "2004-02-29": 2004}


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
        "2000-01-04,20.0,10.0,15.0,-100.0,era5t\n"  # preliminary -> PUBLISHED (D-28 variant A)
    )
    monkeypatch.setattr(pc, "DATA_DIR", tmp_path)

    data = pc.load_all()

    # T-5.42/D-28: era5t is now on the allow-list and PUBLISHED alongside era5, so all
    # four days survive (the old block-list dropped the era5t day).
    assert set(data["date"].dt.strftime("%Y-%m-%d")) == {
        "2000-01-01",
        "2000-01-02",
        "2000-01-03",
        "2000-01-04",
    }

    by_date = data.set_index(data["date"].dt.strftime("%Y-%m-%d"))
    # <col> + elevation_diff_m * 0.0065, hand-computed:
    assert by_date.loc["2000-01-01", "temperature_max_corr"] == approx(10.0)       # 10 + 0
    assert by_date.loc["2000-01-02", "temperature_max_corr"] == approx(11.35)      # 12 - 0.65
    assert by_date.loc["2000-01-03", "temperature_max_corr"] == approx(0.1545)     # 8 - 7.8455 (Kredarica corrected)
    # the era5t row gets the SAME uniform correction as any era5 row.
    assert by_date.loc["2000-01-04", "temperature_max_corr"] == approx(19.35)      # 20 - 0.65 (era5t)
    # min and mean use the same offset.
    assert by_date.loc["2000-01-02", "temperature_min_corr"] == approx(3.35)       # 4 - 0.65
    assert by_date.loc["2000-01-02", "temperature_mean_corr"] == approx(7.35)      # 8 - 0.65


def test_load_all_rejects_unknown_source(tmp_path, monkeypatch):
    # T-5.42: the source filter is an ALLOW-LIST — an unrecognised provenance value must
    # FAIL LOUDLY (SystemExit in load_all) rather than flow silently into the derived
    # tables, as the old `source != "era5t"` block-list would have let it.
    csv = tmp_path / "Test.csv"
    csv.write_text(
        "date,temperature_max,temperature_min,temperature_mean,elevation_diff_m,source\n"
        "2000-01-01,10.0,2.0,6.0,0.0,era5\n"
        "2000-01-02,12.0,4.0,8.0,0.0,forecast\n"   # not on the allow-list
    )
    monkeypatch.setattr(pc, "DATA_DIR", tmp_path)

    with pytest.raises(SystemExit) as exc:
        pc.load_all()
    assert "forecast" in str(exc.value)


def test_lapse_rate_constant():
    assert pc.LAPSE_RATE == 0.0065


# ── baseline period constant ─────────────────────────────────────────────────
#
# BASELINE_START/END are read from si.yaml. D-3 mandates a single 1991-2020 anomaly
# baseline everywhere; T-4.2 made that change. Pinning the unified value so any
# future drift back to another window trips this test and re-baselines consciously
# rather than silently moving every anomaly.


def test_baseline_period_is_unified_1991_2020():
    assert pc.BASELINE_START == 1991
    assert pc.BASELINE_END == 2020


# ── SPEI calibration carve-out (D-3) ─────────────────────────────────────────
#
# The SPEI drought index deliberately does NOT use the 1991-2020 anomaly baseline:
# calibrating a drought index on a recent, already-drier normal understates recent
# droughts. Its window is decoupled (SPEI_BASELINE_START/END) and frozen at
# 1950-1980. Pinning it so a future re-coupling to BASELINE_START/END trips loudly.


def test_spei_baseline_is_decoupled_and_frozen_1950_1980():
    assert pc.SPEI_BASELINE_START == 1950
    assert pc.SPEI_BASELINE_END == 1980
    # The carve-out is meaningless if the two windows are ever pointed at the same
    # thing — that would silently drag SPEI onto the anomaly baseline.
    assert (pc.SPEI_BASELINE_START, pc.SPEI_BASELINE_END) != (pc.BASELINE_START, pc.BASELINE_END)


# ── SPEI fit failure withholds, never fabricates (D-16, T-5.1 part 4) ─────────
#
# _spei_from_balances used to invent c_par=1.0, scale_par=mean on a Fisk-fit
# failure and emit SPEI from those fabricated parameters silently. D-16 replaced
# that with the tropical failure pattern (_tropical_trend): log to stderr + return
# a sentinel, so the caller WITHHOLDS the series rather than shipping fabricated
# drought numbers. The failure fires 0x on real data, so these force it directly.


def test_spei_fit_failure_returns_sentinel_not_fabricated(monkeypatch, capsys):
    # Force stats.fisk.fit to raise — the fabrication branch this replaces would
    # have returned a full list of SPEI values from invented parameters.
    def _boom(*args, **kwargs):
        raise RuntimeError("forced Fisk fit failure")

    monkeypatch.setattr(pc.stats.fisk, "fit", _boom)
    all_vals = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0])
    baseline = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])

    result = pc._spei_from_balances(all_vals, baseline)

    assert result is None, "fit failure must withhold (None), not fabricate a series"
    err = capsys.readouterr().err
    assert "Fisk fit failed" in err and "withholding" in err


def test_spei_fit_success_returns_monotone_values(monkeypatch):
    # Sanity for the happy path: a real fit yields one SPEI per balance, and SPEI is
    # a monotone transform of balance (ascending input -> non-decreasing output).
    all_vals = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0])
    baseline = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])

    result = pc._spei_from_balances(all_vals, baseline)

    assert result is not None
    assert len(result) == len(all_vals)
    assert all(result[i] <= result[i + 1] + 1e-9 for i in range(len(result) - 1))


# ── Tropical NB trend withholds an UNTRUSTWORTHY fit (T-4.24) ─────────────────
#
# The fit is withheld — trend_json = {} — not only on too-little data (<10 non-zero
# years) or an exception, but now also when the optimiser's OWN diagnostics say the
# fit is not trustworthy: it did not converge, or its parameter covariance is not
# finite/positive-definite. The criterion is deliberately NOT a p-value threshold
# and NOT a perturbation test. These tests force each branch with a stubbed fit so
# the gate is exercised without depending on a specific ill-conditioned series.


class _StubFit:
    def __init__(self, converged, cov):
        self.mle_retvals = {"converged": converged}
        self._cov = np.asarray(cov, dtype=float)

    def cov_params(self):
        return self._cov


class _StubModel:
    def __init__(self, converged, cov):
        self._converged, self._cov = converged, cov

    def fit(self, *a, **k):
        return _StubFit(self._converged, self._cov)


def _sufficient_series():
    # Passes the <10-years / <10-nonzero insufficiency gate so the fit path runs.
    years = list(range(2000, 2021))          # 21 years
    counts = [c + 1 for c in range(21)]      # all non-zero, ascending
    return years, counts


def test_tropical_trend_withholds_when_not_converged(monkeypatch, capsys):
    years, counts = _sufficient_series()
    monkeypatch.setattr(
        pc.sm, "NegativeBinomial",
        lambda endog, exog: _StubModel(converged=False, cov=np.eye(3)),
    )
    result = pc._tropical_trend(years[:-1], counts[:-1], years)
    assert result == {}, "a non-converged fit must be withheld, not published"
    err = capsys.readouterr().err
    assert "tropical NB fit withheld" in err and "did not converge" in err


def test_tropical_trend_withholds_on_nonfinite_covariance(monkeypatch, capsys):
    years, counts = _sufficient_series()
    bad = np.eye(3); bad[0, 0] = np.nan
    monkeypatch.setattr(
        pc.sm, "NegativeBinomial",
        lambda endog, exog: _StubModel(converged=True, cov=bad),
    )
    result = pc._tropical_trend(years[:-1], counts[:-1], years)
    assert result == {}, "a non-finite covariance must be withheld"
    assert "non-PD covariance" in capsys.readouterr().err


def test_tropical_trend_withholds_on_non_pd_covariance(monkeypatch, capsys):
    years, counts = _sufficient_series()
    non_pd = np.array([[1.0, 0.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, 1.0]])  # neg eigenvalue
    monkeypatch.setattr(
        pc.sm, "NegativeBinomial",
        lambda endog, exog: _StubModel(converged=True, cov=non_pd),
    )
    result = pc._tropical_trend(years[:-1], counts[:-1], years)
    assert result == {}, "a non-positive-definite covariance must be withheld"
    assert "non-PD covariance" in capsys.readouterr().err


def test_tropical_trend_withholds_insufficient_data():
    # <10 non-zero years -> withheld BEFORE any fit (the genuine-insufficiency path,
    # unchanged by T-4.24). No stub: it must never reach the optimiser.
    years = list(range(2000, 2021))
    counts = [0] * 16 + [1, 2, 3, 4, 5]      # only 5 non-zero
    assert pc._tropical_trend(years[:-1], counts[:-1], years) == {}


def test_tropical_trend_success_returns_nb_model():
    # Happy path: a realistic over-dispersed rising count series (the shape a real
    # warming station shows) converges and publishes a trend. Hardcoded (no RNG) so
    # the test is deterministic; a perfectly smooth series is degenerate for NB2
    # (alpha -> 0) and would not converge — exactly the kind the gate now withholds.
    years = list(range(1980, 2021))
    counts = [4, 4, 5, 0, 5, 2, 7, 3, 8, 2, 7, 8, 3, 3, 7, 5, 5, 4, 13, 6, 6,
              17, 8, 8, 4, 2, 15, 16, 18, 6, 13, 9, 12, 9, 10, 7, 9, 15, 13, 17, 31]
    result = pc._tropical_trend(years[:-1], counts[:-1], years)
    assert result.get("model_used") == "nb"
    assert "p_value" in result and "rate_per_year" in result
