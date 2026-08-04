"""
Generate climate-si.db — a self-contained SQLite for Datasette.

Run after mk_collect.py has populated DATA_DIR with station CSVs:
    DATA_DIR=/app/data/si python3 precompute_datasette.py

Output: DATA_DIR/climate-si.db

Tables written
--------------
stations             — station metadata + Vremenar station_id mapping
daily                — unified daily records per station (station_id, date, temps)
daily_percentiles    — p05/p20/p40/p60/p80/p95 of daily mean per station × day-of-year
daily_window         — KDE distribution + percentile cutoffs per station × day-of-year
annual_trend         — Theil-Sen + Mann-Kendall per station × variable × day-of-year
season_heatmap       — seasonal anomaly ranking per station × year × season
"""

import glob, json, os, sys, warnings
import concurrent.futures as _futures
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk_test
from scipy import stats
from scipy.stats import gaussian_kde, theilslopes
import statsmodels.api as sm
import sqlite3
import yaml

import validate as pipeline_validate
import validate_raw

# T-5.1 Part 3: the global `warnings.filterwarnings("ignore")` was removed. It hid
# every warning the pipeline raised — including real numerical issues (degenerate NB
# fits, divide-by-zero, overflow) that a public data pipeline should not hide. They
# now surface at build time. The NB-GLM ConvergenceWarning/HessianInversionWarning and
# the RuntimeWarnings from the optimizer are deliberately LEFT VISIBLE: they mark the
# tropical fits that genuinely fail and are already degraded to `{}` (see
# `_tropical_trend`, which also logs "tropical NB fit failed").
#
# The single exception below is narrow and benign: statsmodels emits one UserWarning
# per get_prediction() call telling us it used its default log-link — which is exactly
# the correct link for the NegativeBinomial model we fit. It is purely informational
# and fired 793×/run, drowning the warnings that matter. Suppress only that one
# message; never re-add a blanket ignore.
warnings.filterwarnings(
    "ignore",
    message="using default log-link in get_prediction",
    category=UserWarning,
)

# ── Config ─────────────────────────────────────────────────────────────────────

COUNTRY = os.environ.get("COUNTRY", "si")
for _cfg in [
    Path(os.environ.get("CONFIG_FILE", "__none__")),
    Path(__file__).parent / f"{COUNTRY}.yaml",
]:
    if _cfg.exists():
        with open(_cfg) as _f:
            CONFIG = yaml.safe_load(_f)
        break
else:
    raise FileNotFoundError(f"Config file for COUNTRY={COUNTRY} not found")

DATA_DIR         = Path(os.environ.get("DATA_DIR", "/app/data/si"))
DB_PATH          = DATA_DIR / "climate-si.db"
LAPSE_RATE       = 0.0065
TREND_START_YEAR = CONFIG.get("trend_start_year", 1950)
PROJ_END_YEAR    = CONFIG.get("projection_end_year", 2050)
WINDOW_HALF      = 7    # days either side of target DOY for distribution/percentile
TREND_WINDOW     = 7    # days either side for annual trend aggregation (T-4.23: unified
                        # with WINDOW_HALF — ±30 reached into late June/late August, which
                        # is not "this day of year"; METHODOLOGY.md documents ±7 throughout)
# Exploratory-only half-widths for the SEPARATE annual_trend_windows table (T-4.26a,
# Option C). ±7 is the published window and lives ONLY in annual_trend — it is NOT
# duplicated here (a second stored copy of a published number is D-18's drift hazard).
# These three windows feed no reader in this ticket; the toolbar control is T-4.26b.
EXPLORATION_WINDOWS = (3, 15, 45)
# Anomaly reference period (D-3): 1991-2020, the single baseline for season
# categories and every anomaly/label on the page. NOT used by SPEI (see below) or
# by the absolute tropical thresholds, which are baseline-independent.
BASELINE_START   = CONFIG["baseline"]["start"]
BASELINE_END     = CONFIG["baseline"]["end"]
# SPEI calibration window (D-3 carve-out): the drought-index log-logistic fit runs
# over a separate, longer historical window, deliberately NOT the 1991-2020 anomaly
# baseline — a recent normal would measure drought against an already-drier baseline.
# Frozen at 1950-1980; keep it decoupled from BASELINE_START/END.
SPEI_BASELINE_START = CONFIG["spei_baseline"]["start"]
SPEI_BASELINE_END   = CONFIG["spei_baseline"]["end"]

MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
               "Jul","Aug","Sep","Oct","Nov","Dec"]

# Mapping: ERA5 station name (CSV stem) → Vremenar/ARSO integer station_id.
# Stations not listed here get station_id = NULL (ERA5 history only, no live view).
ERA5_TO_STATION_ID: dict[str, int] = {
    "Ljubljana":     1495,
    "Maribor":       1491,
    "Celje":         1025,
    "Novo_Mesto":    1447,
    "Murska_Sobota": 1444,
    "Nova_Gorica":   1402,
    "Postojna":      1455,
    "Kocevje":       1426,
    "Kredarica":     1430,
}

# Station metadata from ARSO/Vremenar for the mapped stations.
# Keys are ERA5 station names; values override/supplement what we compute from CSV.
STATION_META: dict[str, dict] = {
    "Ljubljana":     {"official_name": "Ljubljana Bežigrad",  "name_locative": "v Ljubljani",         "xml_id": "LJUBL-ANA_BEZIGRAD"},
    "Maribor":       {"official_name": "Maribor Vrbanski plato","name_locative": "v Mariboru",         "xml_id": "MARIBOR_VRBAN-PLA"},
    "Celje":         {"official_name": "Celje Medlog",         "name_locative": "v Celju",             "xml_id": "CELJE_MEDLOG"},
    "Novo_Mesto":    {"official_name": "Novo mesto",           "name_locative": "v Novem mestu",       "xml_id": "NOVO-MES"},
    "Murska_Sobota": {"official_name": "Rakičan",              "name_locative": "v Murski Soboti",     "xml_id": "MURSK-SOB"},
    "Nova_Gorica":   {"official_name": "Bilje",                "name_locative": "v Novi Gorici",       "xml_id": "NOVA-GOR_BILJE"},
    "Postojna":      {"official_name": "Postojna",             "name_locative": "v Postojni",          "xml_id": "POSTOJNA"},
    "Kocevje":       {"official_name": "Kočevje",              "name_locative": "v Kočevju",           "xml_id": "KOCEVJE"},
    "Kredarica":     {"official_name": "Kredarica",            "name_locative": "na Kredarici",        "xml_id": "KREDA-ICA"},
    # ERA5-only stations (no live Vremenar view)
    "Kranj":         {"official_name": "Kranj",                "name_locative": "v Kranju",            "xml_id": None},
    "Koper":         {"official_name": "Koper",                "name_locative": "v Kopru",             "xml_id": None},
    "Ptuj":          {"official_name": "Ptuj",                 "name_locative": "v Ptuju",             "xml_id": None},
    "Velenje":       {"official_name": "Velenje",              "name_locative": "v Velenju",           "xml_id": None},
    "Trbovlje":      {"official_name": "Trbovlje",             "name_locative": "v Trbovljah",         "xml_id": None},
    "Tolmin":        {"official_name": "Tolmin",               "name_locative": "v Tolminu",           "xml_id": None},
    "Ilirska_Bistrica": {"official_name": "Ilirska Bistrica",  "name_locative": "v Ilirski Bistrici",  "xml_id": None},
    "Domzale":       {"official_name": "Domžale",              "name_locative": "v Domžalah",          "xml_id": None},
    "Ratece":        {"official_name": "Rateče",               "name_locative": "v Ratečah",           "xml_id": None},
}

# ── Station-metadata completeness guard (T-5.7e) ────────────────────────────────
# si.yaml is the single source for the station LIST and its geographic fields
# (name/lat/lon/elevation/elevation_era5_m — enforced against the built table by
# validate._check_stations_match_config). The four ARSO/Vremenar identity columns
# (official_name, name_locative, station_id, xml_id) live in the two dicts above by
# design (D-9 split: registry identity is pipeline metadata, not country geo config).
# That leaves one silent-drift path: `build_stations` falls back to display-name
# defaults / NULL when a si.yaml station is missing from STATION_META, so a station
# added to si.yaml without a metadata entry would ship a fabricated official_name /
# name_locative with no error. This guard closes that path — it runs during the
# image-build precompute (via build_stations) and raises BEFORE any table is written.

def assert_station_metadata_complete() -> None:
    """Every si.yaml station must have an explicit STATION_META entry (no silent
    display-name fallback); every ERA5_TO_STATION_ID key must be a known station
    (ERA5-only stations legitimately carry no station_id, so subset — not equality)."""
    names = {loc["name"] for loc in CONFIG["stations"]}
    meta_keys = set(STATION_META)
    missing_meta = names - meta_keys
    orphan_meta  = meta_keys - names
    if missing_meta:
        raise ValueError(
            f"STATION_META is missing entries for si.yaml station(s): "
            f"{sorted(missing_meta)} — add official_name/name_locative/xml_id in "
            f"precompute_datasette.py rather than letting build_stations fabricate them."
        )
    if orphan_meta:
        raise ValueError(
            f"STATION_META has entries for unknown station(s) not in si.yaml: "
            f"{sorted(orphan_meta)} — remove them or restore the station in si.yaml."
        )
    orphan_ids = set(ERA5_TO_STATION_ID) - names
    if orphan_ids:
        raise ValueError(
            f"ERA5_TO_STATION_ID maps unknown station(s) not in si.yaml: "
            f"{sorted(orphan_ids)}."
        )

# ── Data loading ───────────────────────────────────────────────────────────────

def load_all() -> pd.DataFrame:
    dfs = []
    for f in sorted(glob.glob(str(DATA_DIR / "*.csv"))):
        df = pd.read_csv(f)
        df["date"] = pd.to_datetime(df["date"], format="%Y-%m-%d")
        if "source" not in df.columns:
            df["source"] = "era5"
        dfs.append(df)
    if not dfs:
        sys.exit(f"No CSV files found in {DATA_DIR}")
    data = pd.concat(dfs, ignore_index=True)
    data = data[data["date"] <= pd.Timestamp.today()]
    # T-5.42/D-28 — ALLOW-LIST, not block-list. Accept only the provenance values that
    # validate_raw already sanctions and FAIL LOUDLY on anything else, instead of the old
    # `source != "era5t"` block-list that let ANY unrecognised value — a renamed variant, a
    # typo, a live 'forecast' — flow silently into every derived table (percentiles, trends,
    # tropical counts, SPEI). Sharing validate_raw.ALLOWED_SOURCES keeps the raw guard and
    # this publish guard from drifting; a new source must be added there deliberately (the
    # same committed expectation as D-18's datapackage and T-6.6b's ensure-label).
    # D-28 (variant A): 'era5t' (preliminary reanalysis, revised in place) IS published
    # alongside 'era5' (final), so the served `daily` end tracks the raw record (~6 days
    # newer) instead of trailing it — the ~6 days the forecast fallback used to fill.
    allowed_sources = set(validate_raw.ALLOWED_SOURCES)
    unknown_sources = sorted(set(data["source"].unique()) - allowed_sources)
    if unknown_sources:
        sys.exit(
            f"precompute load_all: unrecognised source value(s) {unknown_sources} in the "
            f"raw CSVs — allowed sources are {sorted(allowed_sources)}. A new source must "
            f"be added to validate_raw.ALLOWED_SOURCES deliberately; it is not published "
            f"silently (T-5.42/D-28)."
        )
    data["year"]  = data["date"].dt.year
    data["month"] = data["date"].dt.month
    # Fixed-lapse elevation correction, applied UNIFORMLY to every station
    # incl. Kredarica (D-5 reversed 2026-07-24 — the correction is kept, not
    # removed). LAPSE_RATE (6.5 °C/km) is the single source for the rate; do
    # not special-case any station here.
    for col in ("temperature_max", "temperature_min", "temperature_mean"):
        data[f"{col}_corr"] = data[col] + data["elevation_diff_m"] * LAPSE_RATE
    return data

def _is_leap(y: int) -> bool:
    return (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)

# ── Window filter ──────────────────────────────────────────────────────────────

# Cumulative days before each month on the FIXED non-leap year — the same table
# monthDayToDoy uses in api.ts. Used to give every row a non-leap day-of-year so it
# shares the target_doy's 2001 calendar.
_CUM_DAYS = np.array([0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334])

def window_filter(loc_data: pd.DataFrame, month: int, day: int, half: int) -> pd.DataFrame:
    try:
        target_doy = pd.Timestamp(2001, month, day).dayofyear
    except ValueError:
        target_doy = pd.Timestamp(2001, month, 28).dayofyear
    # T-4.5: build each row's doy on the SAME non-leap 2001 calendar as target_doy,
    # not from the row's real (leap-aware) calendar. Previously `dt.dayofyear` gave a
    # leap year's 1 March doy 61 while target 1 March was 60, so with half=0 the target
    # matched that year's 29 Feb (real doy 60) instead of its 1 March. D-12: 29 Feb
    # folds into 28 Feb (doy 59), pooling into the Feb 28 window rather than a distinct
    # bin — matching target_doy's own Feb-29 fallback above.
    row_month = loc_data["date"].dt.month.to_numpy()
    row_day   = np.where((loc_data["date"].dt.day.to_numpy() == 29) & (row_month == 2),
                         28, loc_data["date"].dt.day.to_numpy())
    row_doy   = _CUM_DAYS[row_month - 1] + row_day
    raw_diff  = (row_doy - target_doy).astype(int)
    circ_diff = ((raw_diff + 182) % 365) - 182
    mask      = np.abs(circ_diff) <= half
    out       = loc_data[mask].copy()
    year_adj  = np.where(raw_diff[mask] >  182, 1,
                np.where(raw_diff[mask] < -182, -1, 0))
    out["_window_year"] = out["year"].to_numpy() + year_adj
    return out

# ── 1. stations table ──────────────────────────────────────────────────────────

def build_stations(data: pd.DataFrame) -> pd.DataFrame:
    assert_station_metadata_complete()   # T-5.7e: no silent metadata fallback
    rows = []
    for loc_cfg in CONFIG["stations"]:
        name = loc_cfg["name"]
        sid  = ERA5_TO_STATION_ID.get(name)
        meta = STATION_META.get(name, {})
        display = name.replace("_", " ")
        rows.append({
            "era5_name":     name,
            "name":          display,
            "official_name": meta.get("official_name", display),
            "name_locative": meta.get("name_locative", f"v {display}"),
            "station_id":    sid,
            "xml_id":        meta.get("xml_id"),
            "lat":           loc_cfg["lat"],
            "lon":           loc_cfg["lon"],
            "elevation":     loc_cfg["elevation"],
            "elevation_era5_m": loc_cfg.get("elevation_era5_m"),
        })
    return pd.DataFrame(rows)

# ── 2. daily table ─────────────────────────────────────────────────────────────

def build_daily(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    sid_map = stations_df.set_index("era5_name")["station_id"].to_dict()
    cols = {
        "station_id":           data["location"].map(sid_map),
        "era5_name":            data["location"],
        "date":                 data["date"].dt.strftime("%Y-%m-%d"),
        "year":                 data["year"],
        "month":                data["month"],
        "day":                  data["date"].dt.day,
        "temperature_max_2m":   data["temperature_max_corr"].round(3),
        "temperature_average_2m": data["temperature_mean_corr"].round(3),
        "temperature_min_2m":   data["temperature_min_corr"].round(3),
    }
    return pd.DataFrame(cols)

# ── 3. daily_percentiles table (for live "is it hot?" view) ───────────────────

def build_daily_percentiles(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    """
    For each (station × day-of-year): p05/p20/p40/p60/p80/p95 of daily mean temp.
    Date stored as canonical 2025-MM-DD (matching stage-data.podnebnik.org convention).
    Only stations with a Vremenar station_id are included (live view only).
    """
    sid_map = stations_df.set_index("era5_name")["station_id"].dropna().to_dict()
    rows = []
    total = len(sid_map) * 365
    done  = 0
    for era5_name, station_id in sid_map.items():
        loc = data[data["location"] == era5_name]
        if loc.empty:
            continue
        for month in range(1, 13):
            for day in range(1, 32):
                try:
                    pd.Timestamp(2001, month, day)
                except ValueError:
                    continue
                w = window_filter(loc, month, day, WINDOW_HALF)
                yearly_mean = w.groupby("_window_year")["temperature_mean_corr"].mean().dropna()
                samples = yearly_mean.values
                if len(samples) < 20:
                    done += 1
                    continue
                mm = str(month).zfill(2)
                dd = str(day).zfill(2)
                rows.append({
                    "date":       f"2025-{mm}-{dd}",
                    "station_id": int(station_id),
                    "p05": round(float(np.percentile(samples,  5)), 2),
                    "p20": round(float(np.percentile(samples, 20)), 2),
                    "p40": round(float(np.percentile(samples, 40)), 2),
                    "p60": round(float(np.percentile(samples, 60)), 2),
                    "p80": round(float(np.percentile(samples, 80)), 2),
                    "p95": round(float(np.percentile(samples, 95)), 2),
                })
                done += 1
        if done % 200 == 0:
            print(f"  daily_percentiles {done}/{total} ({done/total*100:.0f}%)", end="\r", flush=True)
    print()
    return pd.DataFrame(rows)

# ── 4. daily_window table (KDE distribution for ERA5 chart) ───────────────────

def build_daily_window(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    """
    ±7-day window: KDE distribution + percentile cutoffs of daily max temp.
    Includes all 18 stations (uses era5_name as key since no station_id needed).
    """
    sid_map = stations_df.set_index("era5_name")["station_id"].to_dict()
    rows    = []
    stations = sorted(data["location"].unique())
    total    = len(stations) * 365
    done     = 0
    for era5_name in stations:
        loc = data[data["location"] == era5_name]
        for month in range(1, 13):
            for day in range(1, 32):
                try:
                    pd.Timestamp(2001, month, day)
                except ValueError:
                    continue
                w        = window_filter(loc, month, day, WINDOW_HALF)
                daily_mx = w.groupby("date")["temperature_max_corr"].max().dropna()
                samples  = daily_mx.to_numpy()
                if len(samples) < 50:
                    done += 1
                    continue
                smin, smax = float(samples.min()), float(samples.max())
                pad    = max((smax - smin) * 0.05, 0.5)
                x_grid = np.linspace(smin - pad, smax + pad, 200)
                try:
                    density = gaussian_kde(samples)(x_grid)
                except Exception:
                    density = np.zeros_like(x_grid)
                dist = [[round(float(x), 3), round(float(d), 6)]
                        for x, d in zip(x_grid, density)]
                rows.append({
                    "era5_name":       era5_name,
                    "station_id":      sid_map.get(era5_name),
                    "month":           month,
                    "day":             day,
                    "p5":              round(float(np.percentile(samples,  5)), 2),
                    "p10":             round(float(np.percentile(samples, 10)), 2),
                    "p20":             round(float(np.percentile(samples, 20)), 2),
                    "p50":             round(float(np.percentile(samples, 50)), 2),
                    "p80":             round(float(np.percentile(samples, 80)), 2),
                    "p95":             round(float(np.percentile(samples, 95)), 2),
                    "n_samples":       int(len(samples)),
                    "year_min":        int(loc["year"].min()),
                    "year_max":        int(loc["year"].max()),
                    "distribution_json": json.dumps(dist, separators=(",", ":")),
                })
                done += 1
                if done % 200 == 0:
                    print(f"  daily_window {done}/{total} ({done/total*100:.0f}%)", end="\r", flush=True)
    print()
    return pd.DataFrame(rows)

# ── 5. annual_trend table (per station × variable × DOY) ──────────────────────

VARIABLES = {
    "temperature_mean": "temperature_mean_corr",
    "temperature_max":  "temperature_max_corr",
    "temperature_min":  "temperature_min_corr",
    "precipitation_sum":        "precipitation_sum",
    "et0_evapotranspiration":   "et0_evapotranspiration",
}
# Precip/ET0 accumulate over the window (sum); temperatures average (mean).
SUM_VARIABLES = {"precipitation_sum", "et0_evapotranspiration"}

def _annual_trend_row(era5_name: str, station_id, loc_data: pd.DataFrame,
                      month: int, day: int, variable: str, col: str,
                      half: int = TREND_WINDOW) -> dict | None:
    # `half` defaults to TREND_WINDOW so the published annual_trend build (build_annual_trend
    # below) is byte-identical; build_annual_trend_windows passes the exploratory half-widths.
    # The module-global TREND_WINDOW is never mutated — the window is a plain argument.
    w       = window_filter(loc_data, month, day, half)
    agg_fn  = "sum" if variable in SUM_VARIABLES else "mean"
    annual  = (
        w.groupby("_window_year")[col].agg(agg_fn).dropna()
         .loc[lambda s: s.index >= TREND_START_YEAR]
    )
    if len(annual) < 10:
        return None

    x_arr    = annual.index.to_numpy(float)
    y_arr    = annual.values
    first_yr = int(x_arr.min())
    last_yr  = int(x_arr.max())

    res   = theilslopes(y_arr, x_arr, 0.95)
    slope = res.slope
    x_med = float(np.median(x_arr))
    y_med = float(np.median(y_arr))
    ic    = y_med - slope          * x_med
    ic_hi = y_med - res.high_slope * x_med
    ic_lo = y_med - res.low_slope  * x_med
    mk_r  = mk_test.yue_wang_modification_test(y_arr)

    scatter = [{"x": int(yr), "y": round(float(v), 2)} for yr, v in zip(x_arr, y_arr)]
    # Slim schema: the hist/proj fitted lines and CI bands are all straight lines
    # (y = slope·x + intercept), so we store the 3 line parameter-pairs instead of
    # materialising 300+200-point arrays.  The frontend reconstructs the lines over
    # [year_min, year_max] (historical) and [year_max, proj_end_year] (projection).
    # This is byte-for-byte visually identical to the old *_json arrays.
    return {
        "era5_name":   era5_name,
        "station_id":  station_id,
        "variable":    variable,
        "month":       month,
        "day":         day,
        "day_label":   f"{MONTH_NAMES[month-1]} {day}",
        "year_min":    first_yr,
        "year_max":    last_yr,
        "trend10":     round(float(slope * 10), 3),
        "p_val":       round(float(mk_r.p), 5),
        "tau":         round(float(mk_r.Tau), 3),
        "n_years":     int(len(x_arr)),
        "proj_end_year":  int(PROJ_END_YEAR),
        # central Theil-Sen line
        "slope":          round(float(slope),         6),
        "intercept":      round(float(ic),            4),
        # upper CI line
        "slope_hi":       round(float(res.high_slope), 6),
        "intercept_hi":   round(float(ic_hi),         4),
        # lower CI line
        "slope_lo":       round(float(res.low_slope),  6),
        "intercept_lo":   round(float(ic_lo),         4),
        "scatter_json":   json.dumps(scatter, separators=(",", ":")),
    }


# ── T-4.27: the two annual-trend tables dominate the generate-db job ─────────────
# Profiled (T-4.27 step 1): annual_trend + annual_trend_windows are 91.6% of a 774 s
# precompute (173 s + 536 s), every row an independent Theil-Sen fit + Yue-Wang MK
# test. They are embarrassingly parallel across (window half, station), so the two
# builders below fan those units out to a process pool. Everything that decides a row's
# VALUE — window_filter, the aggregation, theilslopes, the MK test, the rounding — is
# byte-for-byte the serial code (_annual_trend_task calls the same _annual_trend_row);
# parallelism only interleaves INDEPENDENT rows, so no per-row float summation order
# moves. Rows are reassembled in INPUT (serial-emission) order, so pd.DataFrame(rows) →
# to_csv is byte-identical to the serial build. Proven at build time by a full-run
# assert_frame_equal and the T-5.17 hash manifest (T-4.27 gate). Chunk unit is
# (window, station), NOT per row: 18/54 fat tasks, so scheduling and pickling overhead
# are negligible and a worker holds one station's ~28k rows, not 131k result rows.

# Worker-side globals, populated once per worker by the pool initializer. `data` is
# passed THROUGH the initializer (pickled from the parent), never re-read from disk in
# the worker: under the default 'spawn' start method a worker re-imports this module
# fresh and would NOT see a monkeypatched DATA_DIR (the reference-manifest test does
# exactly that), so the parent's in-memory frame is the only correct source.
_POOL_DATA = None
_POOL_SID_MAP = None
_POOL_ADD_WINDOW_COL = False


def _pool_init(data, sid_map, add_window_col):
    global _POOL_DATA, _POOL_SID_MAP, _POOL_ADD_WINDOW_COL
    _POOL_DATA = data
    _POOL_SID_MAP = sid_map
    _POOL_ADD_WINDOW_COL = add_window_col


def _annual_trend_task(args):
    """Compute every fitted row for ONE (window half, station), in the exact
    variable→month→day order the serial loop emits. Returns (task_index, rows) so the
    parent reassembles by INPUT index, never completion order — the guarantee that the
    parallel CSV is byte-identical to the serial one (T-4.27)."""
    task_index, half, era5_name = args
    loc = _POOL_DATA[_POOL_DATA["location"] == era5_name]
    station_id = _POOL_SID_MAP.get(era5_name)
    rows = []
    for variable, col in VARIABLES.items():
        for month in range(1, 13):
            for day in range(1, 32):
                try:
                    pd.Timestamp(2001, month, day)
                except ValueError:
                    continue
                row = _annual_trend_row(era5_name, station_id, loc, month, day,
                                        variable, col, half=half)
                if row:
                    if _POOL_ADD_WINDOW_COL:
                        row["window"] = half
                    rows.append(row)
    return task_index, rows


def _resolve_worker_count(n_tasks: int) -> int:
    """Worker count. `PRECOMPUTE_WORKERS` (env) wins if set — the Dockerfile can pin it;
    otherwise os.cpu_count(), capped at the task count (no idle workers) and floored at 1.
    A value of 1 routes to the serial loop — the guaranteed-identical fallback, and the
    behaviour on a single-core box or an unknown cpu_count()."""
    env = os.environ.get("PRECOMPUTE_WORKERS")
    if env is not None:
        try:
            n = int(env)
        except ValueError:
            n = 1
    else:
        n = os.cpu_count() or 1
    return max(1, min(n, n_tasks))


def _annual_trend_serial(data, stations_df, windows, add_window_col, label):
    """The reference build: a single-threaded loop. Kept as its own function so it is
    both the fallback (below) and the oracle the parallel path is proven identical to."""
    sid_map = stations_df.set_index("era5_name")["station_id"].to_dict()
    rows    = []
    station_names = sorted(data["location"].unique())
    total = len(station_names) * len(VARIABLES) * 365 * len(windows)
    done  = 0
    for half in windows:
        for era5_name in station_names:
            loc      = data[data["location"] == era5_name]
            station_id = sid_map.get(era5_name)
            for variable, col in VARIABLES.items():
                for month in range(1, 13):
                    for day in range(1, 32):
                        try:
                            pd.Timestamp(2001, month, day)
                        except ValueError:
                            continue
                        row = _annual_trend_row(era5_name, station_id, loc, month, day,
                                                variable, col, half=half)
                        if row:
                            if add_window_col:
                                row["window"] = half
                            rows.append(row)
                        done += 1
                        if done % 500 == 0:
                            print(f"  {label} {done}/{total} ({done/total*100:.0f}%)",
                                  end="\r", flush=True)
    print()
    return pd.DataFrame(rows)


def _annual_trend_parallel(data, stations_df, windows, add_window_col, label):
    sid_map = stations_df.set_index("era5_name")["station_id"].to_dict()
    station_names = sorted(data["location"].unique())
    # Tasks in the EXACT serial emission order: outer window, inner sorted station. The
    # explicit task_index makes the input order independent of pool scheduling.
    tasks = []
    for half in windows:
        for era5_name in station_names:
            tasks.append((len(tasks), half, era5_name))
    n_workers = _resolve_worker_count(len(tasks))
    if n_workers <= 1:
        return _annual_trend_serial(data, stations_df, windows, add_window_col, label)
    # Belt-and-suspenders BLAS pinning: 'spawn' workers import numpy fresh and read the
    # thread-count env at import, so single-thread BLAS must be in the environment BEFORE
    # the pool is created (children inherit os.environ). The Dockerfile already exports
    # these; setdefault covers a bare local run without changing them where they are set.
    # Without it, N workers each spinning a full BLAS pool would oversubscribe the cores —
    # slower than serial and, on some builds, numerically different. (The fits touch BLAS
    # barely — tiny ~76-point arrays — but the pin is correct regardless.)
    for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
               "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
        os.environ.setdefault(_v, "1")
    print(f"  {label}: {len(tasks)} (window,station) tasks over {n_workers} workers…",
          flush=True)
    results = {}
    with _futures.ProcessPoolExecutor(
        max_workers=n_workers,
        initializer=_pool_init,
        initargs=(data, sid_map, add_window_col),
    ) as ex:
        for task_index, task_rows in ex.map(_annual_trend_task, tasks):
            results[task_index] = task_rows
            print(f"  {label} {len(results)}/{len(tasks)} tasks", end="\r", flush=True)
    print()
    all_rows = []
    for i in range(len(tasks)):
        all_rows.extend(results[i])
    return pd.DataFrame(all_rows)


def _build_annual_trend_tables(data, stations_df, windows, add_window_col, label):
    """Parallel driver with a LOUD serial fallback. If the pool cannot start or a worker
    dies (BrokenProcessPool, a raised worker exception), log to stderr and rebuild the
    WHOLE table serially — the partial `results` dict is discarded, never returned. A
    silently truncated table would pass validate.py and ship missing fits (T-4.27)."""
    try:
        return _annual_trend_parallel(data, stations_df, windows, add_window_col, label)
    except Exception as e:  # noqa: BLE001 — any pool/worker failure must degrade to serial
        print(f"\n  !! {label}: process pool failed "
              f"({type(e).__name__}: {e}); falling back to SERIAL build",
              file=sys.stderr, flush=True)
        return _annual_trend_serial(data, stations_df, windows, add_window_col, label)


def build_annual_trend(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    return _build_annual_trend_tables(
        data, stations_df, [TREND_WINDOW], add_window_col=False, label="annual_trend")


def build_annual_trend_windows(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    """Exploratory sibling of annual_trend holding ONLY the non-default half-widths
    (EXPLORATION_WINDOWS = 3/15/45). Identical fit code (_annual_trend_row → window_filter
    + theilslopes + yue_wang_modification_test), so every exploratory number is comparable
    to the published ±7 one — the sole difference is the window half-width and the extra
    `window` column. ±7 is NOT emitted here; it keeps its single home in annual_trend
    (T-4.26a, Option C). No frontend reader queries this table yet — that is T-4.26b."""
    return _build_annual_trend_tables(
        data, stations_df, list(EXPLORATION_WINDOWS), add_window_col=True,
        label="annual_trend_windows")

# ── 6. season_heatmap table (per station × year × season) ─────────────────────

SEASONS = [
    ("Winter", 0, None, 2,  lambda y: pd.Timestamp(y, 2, 29 if _is_leap(y) else 28)),
    ("Spring", 1, 3,    5,  lambda y: pd.Timestamp(y, 5, 31)),
    ("Summer", 2, 6,    8,  lambda y: pd.Timestamp(y, 8, 31)),
    ("Autumn", 3, 9,    11, lambda y: pd.Timestamp(y, 11, 30)),
]

def _pct_cat(pct):
    if   pct < 10: return "cold"
    elif pct < 20: return "cool"
    elif pct < 80: return "normal"
    elif pct < 95: return "hot"
    else:          return "extreme"

_CAT_COLOR = {"cold":"#3a5a8a","cool":"#6c8fb6","normal":"#e7d9b8",
              "hot":"#c25a2c","extreme":"#962c1a"}


def _season_heatmap_for_station(era5_name: str, station_id, loc_data: pd.DataFrame) -> list[dict]:
    daily = (
        loc_data.groupby("date")["temperature_max_corr"]
        .mean()
        .reset_index(name="tmax")
    )
    daily["year"]  = daily["date"].dt.year
    daily["month"] = daily["date"].dt.month
    last_date = daily["date"].max()
    year_min  = int(daily["year"].min())
    year_max  = int(daily["year"].max())

    records = []
    for yr in range(year_min, year_max + 1):
        for s_name, s_xi, s_start, s_end_m, end_fn in SEASONS:
            if end_fn(yr) > last_date:
                continue
            if s_name == "Winter":
                chunk = daily[
                    ((daily["year"] == yr - 1) & (daily["month"] == 12)) |
                    ((daily["year"] == yr)     & (daily["month"].isin([1, 2])))
                ]
            else:
                chunk = daily[
                    (daily["year"] == yr) &
                    (daily["month"] >= s_start) &
                    (daily["month"] <= s_end_m)
                ]
            if len(chunk) < 30:
                continue
            records.append({"year": yr, "xi": s_xi, "season": s_name,
                             "avg": round(float(chunk["tmax"].mean()), 2),
                             "n_days": len(chunk)})

    if not records:
        return []

    rec_df = pd.DataFrame(records)
    out    = []
    for xi in range(4):
        sub = rec_df[rec_df["xi"] == xi].copy()
        if sub.empty:
            continue
        all_avgs     = sub["avg"].values
        total        = len(all_avgs)
        baseline_sub = sub[(sub["year"] >= BASELINE_START) & (sub["year"] <= BASELINE_END)]
        base_avgs    = baseline_sub["avg"].values if not baseline_sub.empty else all_avgs
        sorted_desc  = np.sort(all_avgs)[::-1]
        for _, row in sub.iterrows():
            pct  = float((base_avgs < row["avg"]).mean() * 100)
            rank = int(np.searchsorted(-sorted_desc, -row["avg"])) + 1
            cat  = _pct_cat(pct)
            out.append({
                "era5_name":  era5_name,
                "station_id": station_id,
                "x":          int(row["xi"]),
                "y":          int(row["year"]),
                "season":     row["season"],
                "avg":        row["avg"],
                "percentile": round(pct, 1),
                "cat":        cat,
                "rank":       rank,
                "total":      total,
                "color":      _CAT_COLOR[cat],
                "n_days":     int(row["n_days"]),
            })
    return out


def build_season_heatmap(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    sid_map = stations_df.set_index("era5_name")["station_id"].to_dict()
    rows    = []
    for era5_name in sorted(data["location"].unique()):
        loc = data[data["location"] == era5_name]
        rows.extend(_season_heatmap_for_station(era5_name, sid_map.get(era5_name), loc))
        print(f"  season_heatmap: done {era5_name}", flush=True)
    return pd.DataFrame(rows)

# ── Main ───────────────────────────────────────────────────────────────────────

# ── 7. tropical table (days/nights per station × threshold × streak) ──────────
# Ports the sidecar's _compute_tropical: elevation-corrected counts/year with a
# consecutive-run filter + a Negative-Binomial GLM trend. Precomputed over a grid
# so the UI's threshold/min-run sliders read straight from the datasette.

TROPICAL_GRID = {
    # kind: (corrected column, thresholds, streaks)
    "days":   ("temperature_max_corr", list(range(25, 36)), [1, 2, 3]),
    "nights": ("temperature_min_corr", list(range(15, 26)), [1, 2, 3]),
}

def _streak_filter(arr: np.ndarray, streak: int) -> np.ndarray:
    """Zero out True runs shorter than `streak` consecutive qualifying days."""
    out = arr.copy()
    n, i = len(arr), 0
    while i < n:
        if arr[i]:
            j = i
            while j < n and arr[j]:
                j += 1
            if j - i < streak:
                out[i:j] = False
            i = j
        else:
            i += 1
    return out

def _fit_is_trustworthy(fitted) -> bool:
    """The tropical NB fit's OWN verdict on itself: it converged AND its parameter
    covariance is finite and positive-definite (T-4.24's withhold criterion).

    Factored into a shared helper on purpose (T-5.25). It has TWO independent call
    sites: the gate inside `_tropical_trend` (which returns {} when the verdict is
    False) and the value carried out in `_tropical_trend`'s return, which
    `build_tropical` re-reads to enforce "no untrustworthy fit is ever published".
    Because the returned verdict is an independent read of the fit — not a flag the
    gate sets — deleting the gate's early-return does NOT silence the tripwire: a
    non-converged fit then flows through, the return still carries verdict=False, and
    build_tropical raises. That is what makes the tripwire an invariant rather than a
    restatement of the gate. (A refactor could still defeat it by editing BOTH call
    sites; that is the irreducible limit, shared with the D-16 SPEI tripwire.)"""
    if not bool(fitted.mle_retvals.get("converged", False)):
        return False
    cov = np.asarray(fitted.cov_params(), dtype=float)
    if not bool(np.all(np.isfinite(cov))):
        return False
    cov_sym = 0.5 * (cov + cov.T)
    return bool(np.all(np.linalg.eigvalsh(cov_sym) > 0.0))


def _tropical_trend(fit_years, fit_counts, years) -> tuple[dict, bool]:
    """Return (trend, fit_ok). `trend` is {} on any withhold; `fit_ok` is the fit's
    trustworthiness verdict (see _fit_is_trustworthy), carried out so build_tropical
    can assert the withhold actually fired. `fit_ok` is True on the no-fit paths
    (insufficient data — an honest, deterministic withhold) and False only when a fit
    the optimiser could not stand behind was produced. The only combination
    build_tropical forbids is a NON-EMPTY trend with fit_ok False (T-5.25)."""
    nonzero = sum(1 for c in fit_counts if c > 0)
    if len(fit_years) < 10 or nonzero < 10:
        return {}, True
    try:
        years_arr = np.array(fit_years, dtype=float)
        year_mean = float(years_arr[0])
        X_c    = sm.add_constant(years_arr - year_mean)
        fitted = sm.NegativeBinomial(fit_counts, X_c).fit(disp=False, maxiter=200)

        # T-4.24: withhold on an UNTRUSTWORTHY fit, using the optimiser's own
        # diagnostics — the convergence flag and whether the parameter covariance
        # is finite and positive-definite. This is NOT a p-value threshold and NOT
        # a perturbation test: the criterion is strictly "the optimiser did not
        # produce a fit we can stand behind", judged by the fit itself.
        #   Why this matters: for a handful of over-dispersed, near-flat count
        # series the NB2 log-likelihood is almost flat in the slope, so BFGS does
        # not converge and the Hessian is near-singular. Such a fit still yields
        # numbers, but its p-value is meaningless — it swings across its whole
        # range (0.0001 ↔ 0.9999) under a perturbation ten orders of magnitude
        # below measurement precision, and that p drives a reader-facing
        # significance verdict and whether a 2050 projection renders. So two builds
        # of one commit could show a reader a different climate claim. We decline to
        # publish a number we cannot stand behind — the same principle as D-16's
        # SPEI withhold, applied to a second estimator. Reproducibility is pinned
        # separately (BLAS/OpenMP threads fixed in the generate-db build), but that
        # only makes the fit reproducible, not trustworthy; this gate is the real
        # fix. A more robust estimator is the open follow-up (T-4.24 backlog note),
        # not a v1 change.
        #   NB: covariance singularity often surfaces instead as an exception in
        # get_prediction() below (a LinAlgError caught by the except); this explicit
        # check catches the arches/paths where the inverse comes back non-finite or
        # non-PD without raising. Both routes end in the same {} withhold.
        if not _fit_is_trustworthy(fitted):
            reason = "did not converge" if not fitted.mle_retvals.get("converged", False) else "non-PD covariance"
            print(f"  tropical NB fit withheld ({reason})", file=sys.stderr)
            return {}, False

        x_dense = np.linspace(years[0], years[-1], len(years))
        X_dense = sm.add_constant(x_dense - year_mean)
        pred_df = fitted.get_prediction(X_dense).summary_frame(alpha=0.05)

        mid_year = float(np.median(fit_years))
        mid_mu   = float(np.exp(fitted.params[0] + fitted.params[1] * (mid_year - year_mean)))
        dpd      = round(mid_mu * (float(np.exp(fitted.params[1] * 10)) - 1), 1)
        alpha_v  = round(float(fitted.params[-1]), 3)

        mu_dense = pred_df["predicted"].values
        se_pred  = np.sqrt(mu_dense + mu_dense ** 2 * alpha_v)
        pi_low   = np.maximum(0.0, mu_dense - 1.96 * se_pred)
        pi_high  = mu_dense + 1.96 * se_pred

        trend = {
            "model_used":      "nb",
            "rate_per_year":   round(max(-50.0, min(50.0, float(np.exp(fitted.params[1]) - 1) * 100)), 2),
            "days_per_decade": dpd,
            "p_value":         round(max(0.0001, min(0.9999, float(fitted.pvalues[1]))), 3),
            "alpha":           alpha_v,
            "aic":             round(float(fitted.aic), 1),
            "fit_year_max":    int(fit_years[-1]),
            "x_line":          [round(float(x), 2) for x in x_dense],
            "y_line":          pred_df["predicted"].round(2).tolist(),
            "ci_low":          pred_df["ci_lower"].round(2).tolist(),
            "ci_high":         pred_df["ci_upper"].round(2).tolist(),
            "pi_low":          pi_low.round(2).tolist(),
            "pi_high":         pi_high.round(2).tolist(),
        }
        yl, cl, ch = trend["y_line"], trend["ci_low"], trend["ci_high"]
        if not (all(np.isfinite(v) and v >= 0 for v in yl)
                and all(np.isfinite(v) for v in cl) and all(np.isfinite(v) for v in ch)
                and all(cl[i] <= ch[i] for i in range(len(cl)))):
            return {}, True
        # Re-read the fit's verdict here (a SECOND, independent call to the shared
        # helper) rather than returning a literal True: this is the tripwire hook
        # (T-5.25). In normal flow the gate above already guaranteed the verdict is
        # True; but if that gate is ever deleted, this return still carries the real
        # verdict (False for a non-converged fit) and build_tropical raises.
        return trend, _fit_is_trustworthy(fitted)
    except Exception as e:
        print(f"  tropical NB fit failed ({e})", file=sys.stderr)
        return {}, False

def build_tropical(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    sid_map = dict(zip(stations_df["era5_name"], stations_df["station_id"]))
    max_year = int(data["year"].max())
    rows = []
    for era5_name, loc in data.groupby("location"):
        loc = loc.sort_values("date")
        yr_lo, yr_hi = int(loc["year"].min()), int(loc["year"].max())
        full_years = list(range(yr_lo, yr_hi + 1))
        for kind, (col, thresholds, streaks) in TROPICAL_GRID.items():
            vals = loc[col].to_numpy()
            yrs  = loc["year"].to_numpy()
            for threshold in thresholds:
                # Strict `>` is deliberate, not incidental (T-4.9). It follows the
                # ETCCDI / ECA&D climate-index convention (summer days = TX > 25 °C,
                # tropical nights = TN > 20 °C), so a day exactly on the threshold is
                # NOT counted. Some national services (e.g. DWD Tropennacht) use `≥`;
                # this project endorses `>`. The frontend carries no independent count
                # comparison — it reads these precomputed counts — and every UI label
                # already phrases the boundary as "nad"/"preseže" (above/exceeds),
                # i.e. `>`, so Python and TS agree. Do not change to `≥` without a
                # DECISIONS.md entry: it moves published counts on boundary days and
                # inverts all six of those labels.
                base_qual = vals > threshold
                for streak in streaks:
                    qual = _streak_filter(base_qual, streak) if streak > 1 else base_qual
                    ann = (pd.Series(qual).groupby(yrs).sum()
                           .reindex(full_years, fill_value=0))
                    years  = [int(y) for y in ann.index]
                    counts = [int(v) for v in ann.values]
                    fit    = [(y, c) for y, c in zip(years, counts) if y != max_year]
                    trend, fit_ok = _tropical_trend(
                        [y for y, _ in fit], [c for _, c in fit], years)
                    # T-5.25 tripwire: assert the T-4.24 withhold actually fired.
                    # A non-empty trend that the fit itself does NOT vouch for means
                    # the withhold-at-source has silently stopped working — the exact
                    # failure that once published eleven false 2050 projections.
                    # Abort the build (validate runs before to_sql, so nothing ships)
                    # rather than republish a false significance claim.
                    if trend and not fit_ok:
                        raise pipeline_validate.PipelineValidationError(
                            f"tropical trend published from an UNTRUSTWORTHY fit: "
                            f"station={era5_name} kind={kind} threshold={threshold} "
                            f"streak={streak}. The NB GLM did not converge (or its "
                            f"parameter covariance was non-finite / non-positive-"
                            f"definite), yet a trend_json — including a 2050 "
                            f"projection and a significance verdict — was emitted. "
                            f"A non-converged tropical fit once published ELEVEN "
                            f"false 2050 projections, ten with p clamped to 0.0001 "
                            f"(T-4.24); this invariant exists so that never ships "
                            f"again. The correct fix is to WITHHOLD this trend "
                            f"(return an empty dict from _tropical_trend, as its "
                            f"convergence gate does) — NOT to relax or delete this "
                            f"check (T-5.25)."
                        )
                    rows.append({
                        "era5_name":     era5_name,
                        "station_id":    sid_map.get(era5_name),
                        "kind":          kind,
                        "threshold":     threshold,
                        "streak":        streak,
                        "years_json":    json.dumps(years),
                        "counts_json":   json.dumps(counts),
                        "nonzero_count": sum(1 for c in counts if c > 0),
                        "trend_json":    json.dumps(trend),
                    })
        print(f"  tropical: done {era5_name}", flush=True)
    return pd.DataFrame(rows)


# ── 8. SPEI drought index (national heatmap + per-station seasonal/monthly) ────
# Standardised Precipitation-Evapotranspiration Index: seasonal/monthly water
# balance (precip − ET0), fitted to a log-logistic distribution over the SPEI
# calibration window (SPEI_BASELINE_START/END = 1950–1980, D-3 carve-out — NOT the
# 1991–2020 anomaly baseline) and mapped to a normal deviate. Ported from the sidecar.

def _spei_cat(spei):
    if   spei < -1.5: return "extreme_dry"
    elif spei < -1.0: return "dry"
    elif spei <  1.0: return "normal"
    elif spei <  1.5: return "wet"
    else:             return "extreme_wet"

def _spei_color(spei):
    return {"extreme_dry": "#8b3a0f", "dry": "#c2713a", "normal": "#e7e0d0",
            "wet": "#4a80b0", "extreme_wet": "#1e4d78"}[_spei_cat(spei)]

def _spei_from_balances(all_vals, baseline_vals):
    """SPEI for all_vals, log-logistic fitted on baseline_vals (>=5 else all).

    Returns None if the Fisk fit fails — the series is WITHHELD, not fabricated
    (D-16). This mirrors _tropical_trend's failure path (log to stderr, return the
    sentinel, let the caller drop the series): a failed fit yields "no data", never
    invented distribution parameters. The previous code fabricated c_par=1.0,
    scale_par=mean and emitted SPEI from them silently, which would corrupt every
    SPEI value/category/colour/rank/trend on the drought heatmap and per-station
    charts while passing validate.py (fabricated values still clip to [-3,3]). It
    fires 0x on current data (all 292 series fit); the change defuses a landmine.
    """
    b_vals = baseline_vals if len(baseline_vals) >= 5 else all_vals
    b_vals = np.asarray(b_vals, dtype=float)
    gamma_shift = float(b_vals.min()) - 1e-6
    try:
        c_par, _, scale_par = stats.fisk.fit(b_vals - gamma_shift, floc=0)
    except Exception as e:
        print(f"  SPEI Fisk fit failed ({e}) — withholding series", file=sys.stderr)
        return None
    out = []
    for bal in all_vals:
        sv = max(float(bal) - gamma_shift, 1e-9)
        p  = float(np.clip(stats.fisk.cdf(sv, c_par, loc=0, scale=scale_par), 1e-6, 1 - 1e-6))
        out.append(float(np.clip(stats.norm.ppf(p), -3.0, 3.0)))
    return out

def _spei_trend(spei_vals, years):
    if len(spei_vals) < 10:
        return {}
    try:
        ts     = theilslopes(spei_vals, years)
        mk_res = mk_test.original_test(np.array(spei_vals))
        return {"slope_per_decade": round(float(ts.slope) * 10, 3),
                "p_value": round(float(mk_res.p), 3), "mk_trend": mk_res.trend,
                "intercept": round(float(ts.intercept), 3)}
    except Exception:
        return {}

def build_spei_heatmap(data: pd.DataFrame) -> pd.DataFrame:
    last_era5 = data["date"].max()
    daily_p   = data.groupby("date")["precipitation_sum"].mean()
    daily_et0 = data.groupby("date")["et0_evapotranspiration"].mean()
    daily_bal = (daily_p - daily_et0).reset_index()
    daily_bal.columns = ["date", "balance"]
    daily_bal["year"]  = daily_bal["date"].dt.year
    daily_bal["month"] = daily_bal["date"].dt.month
    year_min = int(daily_bal["year"].min()); year_max = int(daily_bal["year"].max())

    SEASONS = [("Winter", 0, None, 2,  lambda y: pd.Timestamp(y, 2, 29 if _is_leap(y) else 28)),
               ("Spring", 1, 3,    5,  lambda y: pd.Timestamp(y, 5, 31)),
               ("Summer", 2, 6,    8,  lambda y: pd.Timestamp(y, 8, 31)),
               ("Autumn", 3, 9,    11, lambda y: pd.Timestamp(y, 11, 30))]
    records = []
    for yr in range(year_min, year_max + 1):
        for s_name, s_xi, s_start, s_end_m, end_fn in SEASONS:
            if end_fn(yr) > last_era5:
                continue
            if s_name == "Winter":
                chunk = daily_bal[((daily_bal["year"] == yr - 1) & (daily_bal["month"] == 12)) |
                                  ((daily_bal["year"] == yr) & (daily_bal["month"].isin([1, 2])))]
            else:
                chunk = daily_bal[(daily_bal["year"] == yr) & (daily_bal["month"] >= s_start) & (daily_bal["month"] <= s_end_m)]
            if len(chunk) < 30:
                continue
            records.append({"year": yr, "xi": s_xi, "season": s_name,
                            "balance": round(float(chunk["balance"].sum()), 1), "n_days": len(chunk)})
    if not records:
        return pd.DataFrame()
    rec_df = pd.DataFrame(records)

    rows = []
    for xi in range(4):
        sub = rec_df[rec_df["xi"] == xi].copy()
        if sub.empty:
            continue
        all_vals = sub["balance"].values
        n_total  = len(all_vals)
        b_sub    = sub[(sub["year"] >= SPEI_BASELINE_START) & (sub["year"] <= SPEI_BASELINE_END)]
        speis    = _spei_from_balances(all_vals, b_sub["balance"].values)
        if speis is None:   # Fisk fit failed → withhold this season (D-16), don't fabricate
            continue
        sorted_asc = np.sort(all_vals)
        for (_, row), spei_val in zip(sub.iterrows(), speis):
            rank = int(np.searchsorted(sorted_asc, row["balance"])) + 1
            rows.append({"x": int(row["xi"]), "y": int(row["year"]),
                         "spei": round(spei_val, 2), "balance": row["balance"],
                         "cat": _spei_cat(spei_val), "rank": rank, "total": n_total,
                         "color": _spei_color(spei_val), "season": row["season"],
                         "n_days": int(row["n_days"])})
    return pd.DataFrame(rows)

def build_spei_station(data: pd.DataFrame, stations_df: pd.DataFrame) -> pd.DataFrame:
    sid_map = dict(zip(stations_df["era5_name"], stations_df["station_id"]))
    last_era5 = data["date"].max()
    year_min = int(data["year"].min()); year_max = int(data["year"].max())
    SEASONS = [("Winter", None, 2,  lambda y: pd.Timestamp(y, 2, 29 if _is_leap(y) else 28)),
               ("Spring", 3,    5,  lambda y: pd.Timestamp(y, 5, 31)),
               ("Summer", 6,    8,  lambda y: pd.Timestamp(y, 8, 31)),
               ("Autumn", 9,    11, lambda y: pd.Timestamp(y, 11, 30))]
    MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    out_rows = []
    for station, sd in data.groupby("location"):
        sd = sd.copy()
        sd["balance"] = sd["precipitation_sum"] - sd["et0_evapotranspiration"]
        series = {}
        # SPEI-3 seasonal
        for s_name, s_start, s_end_m, end_fn in SEASONS:
            recs = []
            for yr in range(year_min, year_max + 1):
                if end_fn(yr) > last_era5:
                    continue
                if s_name == "Winter":
                    chunk = sd[((sd["year"] == yr - 1) & (sd["month"] == 12)) | ((sd["year"] == yr) & (sd["month"].isin([1, 2])))]
                else:
                    chunk = sd[(sd["year"] == yr) & (sd["month"] >= s_start) & (sd["month"] <= s_end_m)]
                if len(chunk) < 30:
                    continue
                recs.append({"year": yr, "balance": float(chunk["balance"].sum())})
            if len(recs) < 10:
                continue
            rd = pd.DataFrame(recs)
            b  = rd[(rd["year"] >= SPEI_BASELINE_START) & (rd["year"] <= SPEI_BASELINE_END)]
            raw = _spei_from_balances(rd["balance"].values, b["balance"].values)
            if raw is None:   # Fisk fit failed → withhold this seasonal series (D-16)
                continue
            speis = [round(v, 2) for v in raw]
            years = [int(y) for y in rd["year"].tolist()]
            series[s_name] = {"years": years, "spei": speis, "trend": _spei_trend(speis, years)}
        # Annual = mean of seasonal SPEI per year
        by_year = {}
        for s in series.values():
            for yr, sp in zip(s["years"], s["spei"]):
                by_year.setdefault(yr, []).append(sp)
        ann_years = sorted(yr for yr, v in by_year.items() if len(v) >= 2)
        ann_spei  = [round(float(np.mean(by_year[yr])), 2) for yr in ann_years]
        series["Annual"] = {"years": ann_years, "spei": ann_spei, "trend": _spei_trend(ann_spei, ann_years)}
        # SPEI-30 monthly
        for m_idx, m_name in enumerate(MONTHS, start=1):
            recs = []
            for yr in range(year_min, year_max + 1):
                m_end = pd.Timestamp(yr, 12, 31) if m_idx == 12 else pd.Timestamp(yr, m_idx + 1, 1) - pd.Timedelta(days=1)
                if m_end > last_era5:
                    continue
                chunk = sd[(sd["year"] == yr) & (sd["month"] == m_idx)]
                if len(chunk) < 20:
                    continue
                recs.append({"year": yr, "balance": float(chunk["balance"].sum())})
            if len(recs) < 10:
                continue
            rd = pd.DataFrame(recs)
            b  = rd[(rd["year"] >= SPEI_BASELINE_START) & (rd["year"] <= SPEI_BASELINE_END)]
            raw = _spei_from_balances(rd["balance"].values, b["balance"].values)
            if raw is None:   # Fisk fit failed → withhold this monthly series (D-16)
                continue
            speis = [round(v, 2) for v in raw]
            years = [int(y) for y in rd["year"].tolist()]
            series[m_name] = {"years": years, "spei": speis, "trend": _spei_trend(speis, years)}

        for skey, s in series.items():
            out_rows.append({"era5_name": station, "station_id": sid_map.get(station),
                             "series": skey, "years_json": json.dumps(s["years"]),
                             "spei_json": json.dumps(s["spei"]), "trend_json": json.dumps(s["trend"])})
        print(f"  spei_station: done {station}", flush=True)
    return pd.DataFrame(out_rows)


def build_all_tables(data):
    """Build all nine derived tables in memory from loaded station data.

    The single build sequence, shared by main() (which then validates + writes to
    SQLite) and tests/test_reference_manifest.py (which hashes the output over a
    frozen fixture, T-5.43). No I/O and no validation — callers own those. Keeping
    one sequence means the reference-manifest gate exercises exactly the builders
    that ship, not a copy that could drift.
    """
    print("\n[1/10] Building stations table…")
    stations_df = build_stations(data)
    print(f"  {len(stations_df)} stations "
          f"({stations_df['station_id'].notna().sum()} with Vremenar ID)")

    print("\n[2/10] Building daily table…")
    daily_df = build_daily(data, stations_df)

    print("\n[3/10] Computing daily_percentiles (per station × DOY, mean temp)…")
    perc_df = build_daily_percentiles(data, stations_df)

    print("\n[4/10] Computing daily_window (per station × DOY, KDE of max temp)…")
    dw_df = build_daily_window(data, stations_df)

    print("\n[5/10] Computing annual_trend (per station × variable × DOY)…")
    at_df = build_annual_trend(data, stations_df)

    print("\n[6/10] Computing annual_trend_windows (exploratory ±3/±15/±45)…")
    atw_df = build_annual_trend_windows(data, stations_df)

    print("\n[7/10] Computing season_heatmap (per station × year × season)…")
    sh_df = build_season_heatmap(data, stations_df)

    print("\n[8/10] Computing tropical (days/nights × threshold × streak, NB GLM)…")
    tr_df = build_tropical(data, stations_df)

    print("\n[9/10] Computing spei (national seasonal drought heatmap)…")
    spei_df = build_spei_heatmap(data)

    print("\n[10/10] Computing spei_station (per-station SPEI-3/SPEI-30 trends)…")
    ss_df = build_spei_station(data, stations_df)

    return {
        "stations": stations_df,
        "daily": daily_df,
        "daily_percentiles": perc_df,
        "daily_window": dw_df,
        "annual_trend": at_df,
        "annual_trend_windows": atw_df,
        "season_heatmap": sh_df,
        "tropical": tr_df,
        "spei": spei_df,
        "spei_station": ss_df,
    }


def main():
    print(f"Writing to {DB_PATH}")

    print("\nLoading ERA5 station CSVs…")
    data = load_all()
    print(f"  {len(data):,} rows · {data['location'].nunique()} stations · "
          f"{data['year'].min()}–{data['year'].max()}")

    # Build every table in memory first. Nothing is written to the database until
    # validation (T-3.6) has passed, so a broken regeneration cannot publish a
    # subtly-wrong table quietly — it aborts non-zero before the first to_sql.
    tables = build_all_tables(data)

    # ── Validate before publishing (T-3.6) ─────────────────────────────────────
    print("\nValidating output tables…")
    pipeline_validate.validate_tables(tables, CONFIG)
    print("  all tables valid")

    conn = sqlite3.connect(DB_PATH)
    for name, df in tables.items():
        df.to_sql(name, conn, if_exists="replace", index=False)
        print(f"  wrote {len(df):,} rows → {name}")

    # Create indexes for common query patterns
    print("\nCreating indexes…")
    cur = conn.cursor()
    cur.execute("CREATE INDEX IF NOT EXISTS idx_daily_station ON daily(era5_name, date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_daily_sid ON daily(station_id, date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_perc_sid_date ON daily_percentiles(station_id, date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_dw_station_md ON daily_window(era5_name, month, day)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_at_station_md ON annual_trend(era5_name, variable, month, day)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_atw_station_md ON annual_trend_windows(era5_name, variable, month, day, window)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sh_station ON season_heatmap(era5_name, y)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_trop ON tropical(era5_name, kind, threshold, streak)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_spei_xy ON spei(x, y)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_spei_station ON spei_station(era5_name, series)")
    conn.commit()
    conn.close()

    import os
    size_mb = os.path.getsize(DB_PATH) / 1e6
    print(f"\nDone. {DB_PATH} ({size_mb:.0f} MB)")


if __name__ == "__main__":
    main()
