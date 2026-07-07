"""
ERA5 live-data sidecar for podnebnik/website.
Serves /api/live/* for the ali-je-vroce-era5 page.

Extends the MK_ERA5 sidecar with Docker-friendly paths and extra endpoints:
  /api/live/season_heatmap, /api/live/daily_window,
  /api/live/spei_heatmap, /api/live/spei_station_seasonal

Run:
    DATA_DIR=/path/to/era5/data python3 mk_sidecar.py
Serves on 0.0.0.0:5052
"""

import datetime, json, os, sqlite3, threading, warnings, glob
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd
import requests as http_requests
import statsmodels.api as sm
import yaml
from flask import Flask, jsonify, request
from flask_cors import CORS
from scipy import stats
from scipy.stats import theilslopes, gaussian_kde
import pymannkendall as mk_test

warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────

# DATA_DIR: persistent volume with collected CSVs, precomputed SQLite, and cache
DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data/si"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

COUNTRY = os.environ.get("COUNTRY", "si")
_config_candidates = [
    Path(os.environ.get("CONFIG_FILE", "__none__")),
    Path(__file__).parent / f"{COUNTRY}.yaml",
]
for _cfg_path in _config_candidates:
    if _cfg_path.exists():
        with open(_cfg_path) as _f:
            CONFIG = yaml.safe_load(_f)
        break
else:
    raise FileNotFoundError(f"Config file not found for COUNTRY={COUNTRY}")

DB_PATH    = DATA_DIR / "era5-slovenia.db"
_CACHE_DIR = DATA_DIR / "cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)
PORT       = int(os.environ.get("SIDECAR_PORT", 5052))
MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
               "Jul","Aug","Sep","Oct","Nov","Dec"]

def _load_locale() -> dict:
    lang = CONFIG.get("default_language", "en")
    for _lp in [
        Path(__file__).parent / "locales" / f"{lang}_default.json",
        Path(__file__).parent / "static" / "locales" / f"{lang}_default.json",
    ]:
        try:
            with open(_lp, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

_LOCALE = _load_locale()

LOC_COORDS = {s["name"]: {"lat": s["lat"], "lon": s["lon"]}
              for s in CONFIG["stations"]}

_TODAY_CATEGORIES = [
    (10,  "freezing", "#3a5a8a"),
    (20,  "cold",     "#6c8fb6"),
    (80,  "nope",     "#e7d9b8"),
    (95,  "hot",      "#c25a2c"),
    (101, "hell",     "#962c1a"),
]

LAPSE_RATE = 0.0065
VARIABLES = {
    "temperature_max":        "Temperature Max (°C)",
    "temperature_min":        "Temperature Min (°C)",
    "temperature_mean":       "Temperature Mean (°C)",
    "precipitation_sum":      "Precipitation (mm)",
    "et0_evapotranspiration": "ET₀ Evapotranspiration (mm)",
}
PALETTE = ["#e07b00","#9b4dca","#c9880a","#d0408a","#20aab0","#b06830"]
MONTH_NAMES_REG = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

_VSTYLE = {
    "precipitation_sum": {
        "pos_rgb":(26,95,200), "neg_rgb":(160,92,32),
        "pos_label":"wetter ↑", "neg_label":"drier ↓", "chg_unit":"mm",
    },
    "et0_evapotranspiration": {
        "pos_rgb":(26,95,200), "neg_rgb":(160,92,32),
        "pos_label":"higher ET₀ ↑", "neg_label":"lower ET₀ ↓", "chg_unit":"mm",
    },
}
_TEMP_STYLE = {
    "pos_rgb":(204,34,34), "neg_rgb":(26,95,200),
    "pos_label":"warming ↑", "neg_label":"cooling ↓", "chg_unit":"°C",
}

def _vstyle(var: str) -> dict:
    return _VSTYLE.get(var, _TEMP_STYLE)

def _sig_label(p: float) -> str:
    if p < 0.001: return "p < 0.001  ★★★"
    if p < 0.01:  return "p < 0.01  ★★"
    if p < 0.05:  return "p < 0.05  ★"
    return "not significant"

def _resolve_col(var: str, corr: str) -> str:
    if corr == "corr" and var in ("temperature_max","temperature_min","temperature_mean"):
        return var + "_corr"
    return var

def _doy_to_md(doy: int) -> tuple[int,int]:
    ref = pd.Timestamp("2001-01-01") + pd.Timedelta(days=int(doy) - 1)
    return ref.month, ref.day

def _window_filter(loc_data: pd.DataFrame, month: int, day: int, half_window: int) -> pd.DataFrame:
    try:    target_doy = pd.Timestamp(2001, month, day).dayofyear
    except: target_doy = pd.Timestamp(2001, month, 28).dayofyear
    row_doy  = loc_data["date"].dt.dayofyear.to_numpy()
    raw_diff = (row_doy - target_doy).astype(int)
    circ_diff = ((raw_diff + 182) % 365) - 182
    out = loc_data[np.abs(circ_diff) <= half_window].copy()
    rd_out = raw_diff[np.abs(circ_diff) <= half_window]
    year_adj = np.where(rd_out > 182, 1, np.where(rd_out < -182, -1, 0))
    out["_window_year"] = out["year"].to_numpy() + year_adj
    return out

def _window_series(loc_data: pd.DataFrame, month: int, day: int, half_window: int, col: str) -> pd.Series:
    sub    = _window_filter(loc_data, month, day, half_window)
    agg_fn = "sum" if col in ("precipitation_sum","et0_evapotranspiration") else "mean"
    return sub.groupby("_window_year")[col].agg(agg_fn).dropna()

# ── Load CSV data ─────────────────────────────────────────────────────────────

def _load_csv(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    df["date"] = pd.to_datetime(df["date"], format="%Y-%m-%d")
    return df

_csv_files = sorted(glob.glob(str(DATA_DIR / "*.csv")))
if _csv_files:
    _frames = [_load_csv(f) for f in _csv_files]
    _data   = pd.concat(_frames, ignore_index=True)
    _data   = _data[_data["date"] <= pd.Timestamp.today()]
    _data["year"]  = _data["date"].dt.year
    _data["month"] = _data["date"].dt.month
    for _c in ("temperature_max","temperature_min","temperature_mean"):
        _data[_c + "_corr"] = _data[_c] + _data["elevation_diff_m"] * LAPSE_RATE
else:
    _data = pd.DataFrame()

_LOCATIONS    = sorted(_data["location"].unique().tolist()) if not _data.empty else []
_CSV_MAX_YEAR = int(_data["date"].max().year) if not _data.empty else datetime.date.today().year

# Per-station lapse-rate correction offset (°C) = elevation_diff_m * LAPSE_RATE
# elevation_diff_m = elevation_era5_m - elevation_station_m (negative for high-altitude stations)
# Applied to every raw temperature_max value read from SQLite or Open-Meteo.
#
# Seeded from the YAML config (always available, even before CSVs are collected), then
# overridden with CSV-derived values when the station data file is loaded.
_STATION_CORR_OFFSET: dict[str, float] = {}
for _s in CONFIG["stations"]:
    _era5_m = _s.get("elevation_era5_m")
    if _era5_m is not None:
        _STATION_CORR_OFFSET[_s["name"]] = (float(_era5_m) - float(_s["elevation"])) * LAPSE_RATE

if not _data.empty and "elevation_diff_m" in _data.columns:
    for _name in _LOCATIONS:
        _sub = _data[_data["location"] == _name]
        if not _sub.empty:
            _STATION_CORR_OFFSET[_name] = float(_sub["elevation_diff_m"].iloc[0]) * LAPSE_RATE

# ── Regression computation ────────────────────────────────────────────────────

_REG_CACHE: dict = {}

def _compute_regression(loc: str, var: str, month: int, day: int,
                        half_window: int, col: str, method: str) -> dict | None:
    key = (loc, var, month, day, half_window, col, method)
    if key in _REG_CACHE:
        return _REG_CACHE[key]
    if _data.empty:
        return None
    ld     = _data[_data["location"] == loc]
    series = _window_series(ld, month, day, half_window, col)
    if len(series) < 5:
        return None

    x_arr    = series.index.to_numpy(float)
    y_arr    = series.values
    baseline = float(series.mean())
    vs       = _vstyle(var)

    anomalies = y_arr - baseline
    max_abs   = max(float(np.abs(anomalies).max()), 1e-6)
    scatter   = []
    for yr, v, a in zip(x_arr, y_arr, anomalies):
        alpha = 0.45 + 0.50 * abs(a) / max_abs
        r, g, b = vs["pos_rgb"] if a >= 0 else vs["neg_rgb"]
        scatter.append({
            "x": int(yr), "y": round(float(v), 3),
            "color": f"rgba({r},{g},{b},{alpha:.2f})",
            "anomaly": round(float(a), 3),
        })

    x_line = np.linspace(x_arr.min(), x_arr.max(), 300)
    is_sum = col in ("precipitation_sum","et0_evapotranspiration")

    if method == "ols":
        slope, intercept, r_ann, p_val, _ = stats.linregress(x_arr, y_arr)
        y_line    = slope * x_line + intercept
        residuals = y_arr - (slope * x_arr + intercept)
        se_res    = np.sqrt(np.sum(residuals**2) / max(len(x_arr) - 2, 1))
        ss_x      = np.sum((x_arr - x_arr.mean())**2)
        t_crit    = stats.t.ppf(0.975, df=max(len(x_arr) - 2, 1))
        se_ln     = se_res * np.sqrt(1/len(x_arr) + (x_line - x_arr.mean())**2 / max(ss_x, 1e-12))
        upper, lower = y_line + t_crit * se_ln, y_line - t_crit * se_ln
        metric, metric_lbl, ar1 = r_ann**2, "R²", None
    else:
        res    = theilslopes(y_arr, x_arr, 0.95)
        slope  = res.slope
        mk_r   = mk_test.yue_wang_modification_test(y_arr)
        p_val, tau = mk_r.p, mk_r.Tau
        x_med, y_med = float(np.median(x_arr)), float(np.median(y_arr))
        ic    = y_med - slope          * x_med
        ic_hi = y_med - res.high_slope * x_med
        ic_lo = y_med - res.low_slope  * x_med
        y_line  = slope          * x_line + ic
        upper   = res.high_slope * x_line + ic_hi
        lower   = res.low_slope  * x_line + ic_lo
        metric, metric_lbl = tau**2, "τ²"
        ar1 = round(float(np.corrcoef(y_arr[:-1], y_arr[1:])[0,1]), 3) if len(y_arr) > 2 else 0.0

    trend10  = float(slope * 10)
    slope_ab = abs(slope)
    chg_unit = vs["chg_unit"]
    yrs_per  = 1.0 / slope_ab if slope_ab > 1e-9 else None
    chg_str  = f"1 {chg_unit} change every {yrs_per:.1f} yrs" if yrs_per else "No trend"
    agg_lbl  = "annual sums" if is_sum else "annual means"
    fit_desc = f"Fitted on {len(x_arr)} {agg_lbl} ({len(x_arr)} years)"
    if ar1 is not None:
        fit_desc += f"  ·  AR(1)={ar1:.2f}"

    result = {
        "loc": loc,
        "year_min": int(x_arr.min()),
        "year_max": int(x_arr.max()),
        "scatter": scatter,
        "line": {
            "x":     x_line.tolist(),
            "y":     [round(v, 4) for v in y_line],
            "upper": [round(v, 4) for v in upper],
            "lower": [round(v, 4) for v in lower],
        },
        "baseline": round(baseline, 4),
        "stats": {
            "method":     "OLS" if method == "ols" else "Theil-Sen+MK(TFPW)",
            "trend10":    round(trend10, 3),
            "metric":     round(float(metric), 4),
            "metric_lbl": metric_lbl,
            "p_val":      round(float(p_val), 5),
            "direction":  vs["pos_label"] if trend10 > 0 else vs["neg_label"],
            "chg_str":    chg_str,
            "fit_desc":   fit_desc,
            "sig_label":  _sig_label(float(p_val)),
            "n_years":    int(len(x_arr)),
            "ar1":        ar1,
        },
    }
    _REG_CACHE[key] = result
    return result

# ── Calendar computation ──────────────────────────────────────────────────────

_CAL_CACHE: dict = {}

def _compute_calendar(loc: str, col: str, var: str, half_window: int, method: str) -> dict:
    key = (loc, col, half_window, method)
    if key in _CAL_CACHE:
        return _CAL_CACHE[key]
    if _data.empty:
        return {}
    ld = _data[_data["location"] == loc]

    rows = []
    for m in range(1, 13):
        for d in range(1, 32):
            try: pd.Timestamp(2001, m, d)
            except: continue
            ser = _window_series(ld, m, d, half_window, col)
            if len(ser) < 5:
                rows.append({"month": m, "day": d, "trend10": None, "p_val": None})
                continue
            x_arr, y_arr = ser.index.to_numpy(float), ser.values
            if method == "ols":
                slope, _, _, p_val, _ = stats.linregress(x_arr, y_arr)
            else:
                res   = theilslopes(y_arr, x_arr, 0.95)
                slope = res.slope
                p_val = mk_test.yue_wang_modification_test(y_arr).p
            rows.append({
                "month": m, "day": d,
                "trend10": round(float(slope * 10), 4),
                "p_val":   round(float(p_val), 5),
            })

    _CAL_CACHE[key] = {"loc": loc, "var": var, "rows": rows}
    return _CAL_CACHE[key]

# ── Hero / trends ─────────────────────────────────────────────────────────────

def _compute_trends(month: int, day: int, var: str,
                    half_window: int, col: str, method: str) -> list[dict]:
    if _data.empty:
        return []
    vs = _vstyle(var)
    out = []
    for loc in _LOCATIONS:
        r = _compute_regression(loc, var, month, day, half_window, col, method)
        if r:
            r2 = {**r, "loc": loc}
            out.append(r2)
    return out

# ── SQLite helper ─────────────────────────────────────────────────────────────

def _db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


_NATIONAL_CUTOFFS_CACHE: dict[tuple, dict] = {}


def _compute_national_cutoffs(month: int, day: int) -> dict | None:
    """National peak distribution: MAX across all stations per date, ±7-day window.

    Mirrors mk_api.py exactly — groups all station data by date and takes the
    daily maximum across stations before computing percentiles and KDE.
    n_samples = n_years × 15 days (≈1 140), not 18 × that.
    """
    key = (month, day)
    if key in _NATIONAL_CUTOFFS_CACHE:
        return _NATIONAL_CUTOFFS_CACHE[key]
    if not DB_PATH.exists():
        return None
    try:
        # Load temperatures for months around the target to cover the ±7-day window.
        months_needed = {((month - 2) % 12) + 1, ((month - 1) % 12) + 1, month % 12 + 1, month}
        with _db_conn() as conn:
            frames = []
            for name, tbl in _STATION_TABLES.items():
                rows = conn.execute(
                    f'SELECT date, temperature_max FROM "{tbl}" WHERE temperature_max IS NOT NULL'
                ).fetchall()
                if rows:
                    offset = _STATION_CORR_OFFSET.get(name, 0.0)
                    df_s = pd.DataFrame(rows, columns=["date", "tmax"])
                    df_s["tmax"] += offset
                    frames.append(df_s)
        if not frames:
            return None

        df = pd.concat(frames, ignore_index=True)
        df["date"] = pd.to_datetime(df["date"])
        df["doy"]  = df["date"].dt.dayofyear

        ref_doy = pd.Timestamp(2001, month, day).dayofyear
        circ    = (df["doy"] - ref_doy + 182) % 365 - 182
        df      = df[np.abs(circ) <= 7]

        # One sample per date = national peak (max across all stations per date)
        daily_max = df.groupby("date")["tmax"].max().dropna()
        samples   = daily_max.to_numpy()
        if len(samples) < 50:
            return None

        pcts = {
            "p5":  round(float(np.percentile(samples,  5)), 2),
            "p10": round(float(np.percentile(samples, 10)), 2),
            "p20": round(float(np.percentile(samples, 20)), 2),
            "p50": round(float(np.percentile(samples, 50)), 2),
            "p80": round(float(np.percentile(samples, 80)), 2),
            "p95": round(float(np.percentile(samples, 95)), 2),
        }
        smin, smax = float(samples.min()), float(samples.max())
        pad    = max((smax - smin) * 0.05, 0.5)
        x_grid = np.linspace(smin - pad, smax + pad, 200)
        try:
            density = gaussian_kde(samples)(x_grid)
        except Exception:
            density = np.zeros_like(x_grid)
        distribution = [[round(float(x), 3), round(float(d), 6)]
                        for x, d in zip(x_grid, density)]

        result: dict = {
            **pcts,
            "n_samples":         int(len(samples)),
            "year_min":          int(df["date"].dt.year.min()),
            "year_max":          datetime.date.today().year,
            "distribution_json": json.dumps(distribution, separators=(",", ":")),
        }
        _NATIONAL_CUTOFFS_CACHE[key] = result
        return result
    except Exception:
        return None


def _get_cutoffs(station: str | None, month: int, day: int) -> dict | None:
    """Fetch percentile cutoffs for (station or national peak, month, day)."""
    if not DB_PATH.exists():
        return None
    if not station:
        return _compute_national_cutoffs(month, day)
    try:
        with _db_conn() as conn:
            row = conn.execute(
                "SELECT * FROM si_daily_window WHERE station=? AND month=? AND day=?",
                (station, month, day),
            ).fetchone()
            return dict(row) if row else None
    except Exception:
        return None

# ── Live Open-Meteo fetch ─────────────────────────────────────────────────────

_RAW_CACHE: dict[str, dict[str, float]] = {}


def _prefetch_range(date_strings: list[str]) -> None:
    """Batch-fetch a list of dates via the archive API, 1 call per station.

    Each station request covers the full date range in one HTTP call instead of
    one call per date — reduces 7×18=126 calls down to 18 for the last7 endpoint.
    Already-cached dates are skipped.
    """
    today_str  = datetime.date.today().isoformat()
    need = [d for d in date_strings if d not in _RAW_CACHE and d != today_str]
    if not need:
        return

    # SQLite fast path — fill what we can
    if DB_PATH.exists():
        try:
            with _db_conn() as conn:
                for d in need[:]:
                    row_map: dict[str, float] = {}
                    for name, tbl in _STATION_TABLES.items():
                        row = conn.execute(
                            f'SELECT temperature_max FROM "{tbl}" WHERE date=?', (d,)
                        ).fetchone()
                        if row and row[0] is not None:
                            row_map[name] = float(row[0]) + _STATION_CORR_OFFSET.get(name, 0.0)
                    if len(row_map) >= len(_STATION_TABLES) // 2:
                        _RAW_CACHE[d] = row_map
                        need.remove(d)
        except Exception:
            pass

    if not need:
        return

    start, end = min(need), max(need)

    def _one_station(name: str, lat: float, lon: float) -> tuple[str, dict[str, float]]:
        try:
            resp = http_requests.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": f"{lat:.4f}", "longitude": f"{lon:.4f}",
                    "daily": "temperature_2m_max",
                    "timezone": CONFIG["timezone"],
                    "start_date": start, "end_date": end,
                },
                timeout=15,
            )
            resp.raise_for_status()
            daily = resp.json().get("daily", {})
            dates = daily.get("time", [])
            temps = daily.get("temperature_2m_max", [])
            return name, {d: float(t) + _STATION_CORR_OFFSET.get(name, 0.0)
                          for d, t in zip(dates, temps) if t is not None}
        except Exception:
            return name, {}

    # 18 parallel calls, one per station, each covering the full range
    station_data: dict[str, dict[str, float]] = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(_one_station, n, c["lat"], c["lon"]): n
                   for n, c in LOC_COORDS.items()}
        for fut in as_completed(futures):
            name, by_date = fut.result()
            station_data[name] = by_date

    # Pivot: date → {station: temp}
    for d in need:
        row_map = {}
        for name, by_date in station_data.items():
            if d in by_date:
                row_map[name] = by_date[d]
        if row_map:
            _RAW_CACHE[d] = row_map


def _fetch_om(date_str: str) -> dict[str, float]:
    if date_str in _RAW_CACHE:
        return _RAW_CACHE[date_str]

    today_str = datetime.date.today().isoformat()

    # Fast path: pre-collected SQLite data for any historical date
    if date_str < today_str and DB_PATH.exists():
        try:
            sqlite_result: dict[str, float] = {}
            with _db_conn() as conn:
                for name, tbl in _STATION_TABLES.items():
                    row = conn.execute(
                        f'SELECT temperature_max FROM "{tbl}" WHERE date=?', (date_str,)
                    ).fetchone()
                    if row and row[0] is not None:
                        sqlite_result[name] = float(row[0]) + _STATION_CORR_OFFSET.get(name, 0.0)
            if len(sqlite_result) >= len(_STATION_TABLES) // 2:
                _RAW_CACHE[date_str] = sqlite_result
                return sqlite_result
        except Exception:
            pass

    if date_str == today_str:
        url, extra = "https://api.open-meteo.com/v1/forecast", {"forecast_days": 1}
    else:
        url, extra = "https://archive-api.open-meteo.com/v1/archive", {
            "start_date": date_str, "end_date": date_str
        }

    def _one(name: str, lat: float, lon: float) -> tuple[str, float | None]:
        try:
            resp = http_requests.get(url, params={
                "latitude": f"{lat:.4f}", "longitude": f"{lon:.4f}",
                "daily": "temperature_2m_max",
                "timezone": CONFIG["timezone"], **extra,
            }, timeout=10)
            resp.raise_for_status()
            arr = resp.json().get("daily", {}).get("temperature_2m_max", [])
            return name, float(arr[0]) if arr and arr[0] is not None else None
        except Exception:
            return name, None

    result: dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(_one, n, c["lat"], c["lon"]): n
                   for n, c in LOC_COORDS.items()}
        for fut in as_completed(futures):
            name, val = fut.result()
            if val is not None:
                result[name] = val + _STATION_CORR_OFFSET.get(name, 0.0)

    if result:
        _RAW_CACHE[date_str] = result
    return result

# ── Category helper ───────────────────────────────────────────────────────────

def _categorize(pct: float) -> tuple[str, str]:
    for cutoff, key, color in _TODAY_CATEGORIES:
        if pct < cutoff:
            return key, color
    last = _TODAY_CATEGORIES[-1]
    return last[1], last[2]

# ── Same-date rank ────────────────────────────────────────────────────────────

# Map station name → SQLite table name
_STATION_TABLES = {s["name"]: f"si_{s['name'].lower()}" for s in CONFIG["stations"]}


def _compute_rank(loc: str | None, month: int, day: int,
                  date_str: str, today_temp: float) -> dict | None:
    """Return rank_info dict if today lands in top/bottom 5, else None."""
    if not DB_PATH.exists():
        return None
    try:
        with _db_conn() as conn:
            if loc and loc in _STATION_TABLES:
                table = _STATION_TABLES[loc]
                rows = conn.execute(
                    f'SELECT date, temperature_max FROM "{table}" '
                    "WHERE strftime('%m', date)=? AND strftime('%d', date)=? "
                    "AND date != ?",
                    (f"{month:02d}", f"{day:02d}", date_str),
                ).fetchall()
                # One row per year for a single station
                offset = _STATION_CORR_OFFSET.get(loc, 0.0)
                by_date = {r["date"]: r["temperature_max"] + offset
                           for r in rows if r["temperature_max"] is not None}
            else:
                # National: corrected max across all station tables per calendar date
                date_to_temps: dict[str, list[float]] = {}
                for name, tbl in _STATION_TABLES.items():
                    offset = _STATION_CORR_OFFSET.get(name, 0.0)
                    rows = conn.execute(
                        f'SELECT date, temperature_max FROM "{tbl}" '
                        f"WHERE strftime('%m', date)=? AND strftime('%d', date)=? AND date != ?",
                        (f"{month:02d}", f"{day:02d}", date_str),
                    ).fetchall()
                    for r in rows:
                        if r["temperature_max"] is not None:
                            date_to_temps.setdefault(r["date"], []).append(
                                r["temperature_max"] + offset
                            )
                by_date = {d: max(temps) for d, temps in date_to_temps.items()}

        if len(by_date) < 10:
            return None

        vals = sorted(by_date.items(), key=lambda kv: kv[1], reverse=True)
        rank_total = len(vals) + 1
        rank_hot  = sum(1 for _, v in vals if v > today_temp) + 1
        rank_cold = sum(1 for _, v in vals if v < today_temp) + 1

        direction = None
        if rank_hot  <= 5: direction = "hot"
        elif rank_cold <= 5: direction = "cold"
        if not direction:
            return None

        ascending = direction == "cold"
        top4 = sorted(vals, key=lambda kv: kv[1], reverse=not ascending)[:4]
        top5_list = [{"year": int(d[:4]), "date": d, "temp": round(float(v), 1)}
                     for d, v in top4]
        top5_list.append({"year": int(date_str[:4]), "date": date_str,
                           "temp": round(float(today_temp), 1), "is_today": True})
        top5_list.sort(key=lambda x: x["temp"], reverse=(direction == "hot"))

        rank = rank_hot if direction == "hot" else rank_cold
        return {"rank": rank, "total": rank_total, "direction": direction, "top5": top5_list}
    except Exception:
        return None


# ── Core computation ──────────────────────────────────────────────────────────

def _today_status(date_str: str, loc: str | None, *, include_rank: bool = True) -> dict:
    target = datetime.date.fromisoformat(date_str)
    today  = datetime.date.today()
    if target > today:
        return {"available": False}

    month, day = target.month, target.day
    dlabel     = f"{MONTH_NAMES[month - 1]} {day}"

    # Fetch live temperature
    temps = _fetch_om(date_str)
    if not temps:
        return {"available": False}
    if loc:
        if loc not in temps:
            # Batch fetch may have cached a partial result (SQLite threshold met
            # before all stations had data).  Try a direct single-station fetch.
            coords = LOC_COORDS.get(loc)
            if not coords:
                return {"available": False}
            try:
                today_str = datetime.date.today().isoformat()
                if date_str == today_str:
                    om_url   = "https://api.open-meteo.com/v1/forecast"
                    om_extra = {"forecast_days": 1}
                else:
                    om_url   = "https://archive-api.open-meteo.com/v1/archive"
                    om_extra = {"start_date": date_str, "end_date": date_str}
                resp = http_requests.get(om_url, params={
                    "latitude":  f"{coords['lat']:.4f}",
                    "longitude": f"{coords['lon']:.4f}",
                    "daily":     "temperature_2m_max",
                    "timezone":  CONFIG["timezone"],
                    **om_extra,
                }, timeout=10)
                resp.raise_for_status()
                arr = resp.json().get("daily", {}).get("temperature_2m_max", [])
                if arr and arr[0] is not None:
                    temps = {loc: float(arr[0]) + _STATION_CORR_OFFSET.get(loc, 0.0)}
                else:
                    return {"available": False}
            except Exception:
                return {"available": False}
        today_temp = temps[loc]
    else:
        today_temp = max(temps.values())

    # Pre-computed cutoffs from SQLite
    cutoffs = _get_cutoffs(loc, month, day)
    if cutoffs is None:
        return {"available": False}

    # Rank today_temp against cutoffs
    p5,  p10 = cutoffs["p5"],  cutoffs["p10"]
    p20, p50 = cutoffs["p20"], cutoffs["p50"]
    p80, p95 = cutoffs["p80"], cutoffs["p95"]

    # Linear interpolation to estimate percentile
    boundaries = [(0, p5), (5, p5), (10, p10), (20, p20),
                  (50, p50), (80, p80), (95, p95), (100, p95 + (p95 - p80))]
    pct: float = 0.0
    for i in range(len(boundaries) - 1):
        pct_lo, t_lo = boundaries[i]
        pct_hi, t_hi = boundaries[i + 1]
        if t_lo <= today_temp <= t_hi:
            span = t_hi - t_lo
            pct  = pct_lo + (pct_hi - pct_lo) * ((today_temp - t_lo) / span if span else 0)
            break
    else:
        if today_temp >= p95:
            pct = 95.0 + 5.0 * min((today_temp - p95) / max(p95 - p80, 0.1), 1.0)
        else:
            pct = 0.0
    pct = round(float(np.clip(pct, 0, 100)), 1)

    cat_key, color = _categorize(pct)

    dist_raw = cutoffs.get("distribution_json")
    distribution = json.loads(dist_raw) if dist_raw else []

    rank_info = _compute_rank(loc, month, day, date_str, today_temp) if include_rank else None

    era5t_cutoff = today - datetime.timedelta(days=7)

    return {
        "available":      True,
        "date":           date_str,
        "today_temp":     round(float(today_temp), 1),
        "percentile":     pct,
        "category_key":   cat_key,
        "color":          color,
        "n_samples":      int(cutoffs.get("n_samples") or 0),
        "year_min":       int(cutoffs.get("year_min") or 0),
        "year_max":       int(cutoffs.get("year_max") or 0),
        "distribution":   distribution,
        "cutoffs":        {"p5": p5, "p10": p10, "p20": p20,
                           "p50": p50, "p80": p80, "p95": p95},
        "day_label":      dlabel,
        "month_num":      month,
        "day_num":        day,
        "rank_info":      rank_info,
        "loc":            loc,
        "is_preliminary": target >= era5t_cutoff,
    }

# ── Flask app ─────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)


@app.route("/api/live/today_status")
def api_today_status():
    date_str = request.args.get("date", datetime.date.today().isoformat())
    loc      = request.args.get("loc") or None
    return jsonify(_today_status(date_str, loc))


@app.route("/api/live/today_status/last7")
def api_today_last7():
    loc = request.args.get("loc") or None
    end = datetime.date.fromisoformat(
        request.args.get("date", datetime.date.today().isoformat())
    )
    date_strings = [(end - datetime.timedelta(days=offset)).isoformat()
                    for offset in range(6, -1, -1)]

    # Batch-prefetch all dates in one round of archive API calls (18 calls, not 126)
    _prefetch_range(date_strings)

    # Pre-warm national cutoffs cache sequentially to avoid 7 concurrent SQLite
    # full-table-scan collisions (each unique day-of-year scans all 18 tables).
    if not loc:
        for d in date_strings:
            dt = datetime.date.fromisoformat(d)
            _compute_national_cutoffs(dt.month, dt.day)

    # Now each _today_status call hits only the in-memory cache
    with ThreadPoolExecutor(max_workers=7) as pool:
        results = list(pool.map(lambda d: _today_status(d, loc, include_rank=False), date_strings))

    days = [
        {"date":         r["date"],
         "day_label":    r["day_label"],
         "today_temp":   r["today_temp"],
         "percentile":   r["percentile"],
         "category_key": r["category_key"],
         "color":        r["color"]}
        for r in results if r.get("available")
    ]
    return jsonify({"available": bool(days), "days": days})


@app.route("/api/live/meta")
def api_meta():
    return jsonify({
        "country":          CONFIG["code"],
        "name":             CONFIG["name"],
        "default_location": CONFIG["default_location"],
        "languages":        CONFIG["languages"],
        "default_language": CONFIG["default_language"],
        "features":         CONFIG["features"],
        "map":              CONFIG["map"],
        "branding":         CONFIG["branding"],
        "stations": [
            {"name": s["name"], "lat": s["lat"], "lon": s["lon"],
             "elevation": s["elevation"]}
            for s in CONFIG["stations"]
        ],
        "strings": {
            "explain_reg": _LOCALE.get("hero", {}).get("explain_reg", ""),
            "explain_cal": _LOCALE.get("hero", {}).get("explain_cal", ""),
        },
    })


@app.route("/health")
def health():
    return "ok"


# ── Per-station annual trend (on-the-fly, lapse-corrected) ───────────────────

_ANNUAL_TREND_CACHE: dict = {}
_TREND_START = CONFIG.get("trend_start_year", 1950)
_PROJ_END    = CONFIG.get("projection_end_year", 2050)


def _compute_station_annual_trend(loc: str, month: int, day: int) -> dict | None:
    key = (loc, month, day)
    if key in _ANNUAL_TREND_CACHE:
        return _ANNUAL_TREND_CACHE[key]

    ld = _data[_data["location"] == loc] if not _data.empty else pd.DataFrame()

    # SQLite fallback when station CSV is not loaded (e.g., not yet collected on this server)
    if ld.empty and DB_PATH.exists() and loc in _STATION_TABLES:
        try:
            with _db_conn() as conn:
                rows = conn.execute(
                    f'SELECT date, temperature_max FROM "{_STATION_TABLES[loc]}" '
                    "WHERE temperature_max IS NOT NULL"
                ).fetchall()
            if rows:
                df_sql = pd.DataFrame(rows, columns=["date", "temperature_max"])
                df_sql["date"] = pd.to_datetime(df_sql["date"])
                df_sql["year"]  = df_sql["date"].dt.year
                df_sql["month"] = df_sql["date"].dt.month
                df_sql["temperature_max_corr"] = (
                    df_sql["temperature_max"] + _STATION_CORR_OFFSET.get(loc, 0.0)
                )
                ld = df_sql
        except Exception:
            pass

    if ld.empty:
        return None

    window = _window_filter(ld, month, day, 30)
    annual_raw = (
        window.groupby("_window_year")["temperature_max_corr"]
        .apply(lambda x: float(np.percentile(x.dropna(), 90)) if len(x.dropna()) >= 5 else np.nan)
        .dropna()
    )
    annual = annual_raw[annual_raw.index >= _TREND_START]
    if len(annual) < 10:
        return None

    x_arr = annual.index.to_numpy(float)
    y_arr = annual.values
    first_yr, last_yr = int(x_arr.min()), int(x_arr.max())

    res   = theilslopes(y_arr, x_arr, 0.95)
    slope = res.slope
    x_med, y_med = float(np.median(x_arr)), float(np.median(y_arr))
    ic    = y_med - slope          * x_med
    ic_hi = y_med - res.high_slope * x_med
    ic_lo = y_med - res.low_slope  * x_med
    mk_r  = mk_test.yue_wang_modification_test(y_arr)

    x_hist = np.linspace(x_arr.min(), x_arr.max(), 300)
    y_hist = slope * x_hist + ic
    u_hist = res.high_slope * x_hist + ic_hi
    l_hist = res.low_slope  * x_hist + ic_lo

    x_fc = np.linspace(last_yr, _PROJ_END, 200)
    y_fc = slope * x_fc + ic
    u_fc = res.high_slope * x_fc + ic_hi
    l_fc = res.low_slope  * x_fc + ic_lo

    scatter = [{"x": int(yr), "y": round(float(v), 2)} for yr, v in zip(x_arr, y_arr)]
    dlabel  = f"{MONTH_NAMES[month - 1]} {day}"

    result = {
        "month":       month,
        "day":         day,
        "day_label":   dlabel,
        "year_min":    first_yr,
        "year_max":    last_yr,
        "trend10":     round(float(slope * 10), 3),
        "p_val":       round(float(mk_r.p), 5),
        "tau":         round(float(mk_r.Tau), 3),
        "n_years":     int(len(x_arr)),
        "scatter_json":    json.dumps(scatter, separators=(",", ":")),
        "hist_x_json":     json.dumps([round(v, 2) for v in x_hist.tolist()], separators=(",", ":")),
        "hist_y_json":     json.dumps([round(v, 3) for v in y_hist.tolist()], separators=(",", ":")),
        "hist_upper_json": json.dumps([round(v, 3) for v in u_hist.tolist()], separators=(",", ":")),
        "hist_lower_json": json.dumps([round(v, 3) for v in l_hist.tolist()], separators=(",", ":")),
        "proj_x_json":     json.dumps([round(v, 2) for v in x_fc.tolist()],  separators=(",", ":")),
        "proj_y_json":     json.dumps([round(v, 3) for v in y_fc.tolist()],  separators=(",", ":")),
        "proj_upper_json": json.dumps([round(v, 3) for v in u_fc.tolist()],  separators=(",", ":")),
        "proj_lower_json": json.dumps([round(v, 3) for v in l_fc.tolist()],  separators=(",", ":")),
    }
    _ANNUAL_TREND_CACHE[key] = result
    return result


@app.route("/api/live/annual_trend")
def api_annual_trend():
    month = int(request.args.get("month", 1))
    day   = int(request.args.get("day",   1))
    loc   = request.args.get("loc") or None

    if loc:
        row = _compute_station_annual_trend(loc, month, day)
        if not row:
            return jsonify({"error": "no data"}), 404
        return jsonify([row])

    # National: serve from precomputed SQLite table
    if not DB_PATH.exists():
        return jsonify({"error": "db not ready"}), 503
    try:
        with _db_conn() as conn:
            row = conn.execute(
                "SELECT * FROM si_annual_trend WHERE month=? AND day=?",
                (month, day),
            ).fetchone()
        return jsonify([dict(row)] if row else [])
    except Exception:
        return jsonify({"error": "internal server error"}), 500


@app.route("/api/live/regression")
def api_regression():
    locs   = request.args.getlist("loc") or [CONFIG["default_location"]]
    var    = request.args.get("var",    "temperature_max")
    doy    = int(request.args.get("doy",    184))
    window = int(request.args.get("window",  30))
    corr   = request.args.get("corr",   "raw")
    method = request.args.get("method", "theilsen")

    month, day = _doy_to_md(doy)
    col    = _resolve_col(var, corr)
    ylabel = VARIABLES.get(var, var)
    unit   = ylabel.split("(")[-1].rstrip(")") if "(" in ylabel else ""
    ref    = pd.Timestamp("2001-01-01") + pd.Timedelta(days=doy - 1)
    date_label = f"{ref.day} {MONTH_NAMES_REG[ref.month - 1]}  ±{window} d"

    results = []
    for i, loc in enumerate(locs[:8]):
        try:
            res = _compute_regression(loc, var, month, day, window, col, method)
            if res:
                res = {**res, "color": PALETTE[i % len(PALETTE)]}
                results.append(res)
        except Exception:
            pass

    return jsonify({
        "results":    results,
        "date_label": date_label,
        "ylabel":     ylabel,
        "unit":       unit,
    })


@app.route("/api/live/calendar")
def api_calendar():
    loc    = request.args.get("loc",    CONFIG["default_location"])
    var    = request.args.get("var",    "temperature_max")
    window = int(request.args.get("window",  30))
    corr   = request.args.get("corr",   "raw")
    method = request.args.get("method", "theilsen")
    col    = _resolve_col(var, corr)
    ylabel = VARIABLES.get(var, var)
    unit   = ylabel.split("(")[-1].rstrip(")") if "(" in ylabel else ""
    result = _compute_calendar(loc, col, var, window, method)
    return jsonify({**result, "unit": unit,
                   "method_label": "OLS · R²" if method == "ols" else "Theil-Sen · TFPW MK · τ"})


@app.route("/api/live/trends")
def api_trends():
    doy    = int(request.args.get("doy",    184))
    var    = request.args.get("var",    "temperature_max")
    window = int(request.args.get("window",  30))
    corr   = request.args.get("corr",   "raw")
    method = request.args.get("method", "theilsen")
    month, day = _doy_to_md(doy)
    col    = _resolve_col(var, corr)
    results = _compute_trends(month, day, var, window, col, method)
    return jsonify({"results": results, "locations": _LOCATIONS})


@app.route("/api/live/variables")
def api_variables():
    return jsonify({
        "variables": VARIABLES,
        "locations": _LOCATIONS,
    })


# ── Additional endpoints for podnebnik/website ───────────────────────────────

_COMPUTED_CACHE: dict = {}


def _is_leap(y: int) -> bool:
    return (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)


def _fs_cache_load(path: Path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _fs_cache_save(path: Path, data) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception:
        pass


@app.route("/api/live/daily_window")
def api_daily_window():
    """Serve si_daily_window rows from the precomputed SQLite."""
    station = request.args.get("station", "Ljubljana")
    try:
        month = int(request.args.get("month", 1))
        day   = int(request.args.get("day",   1))
    except (TypeError, ValueError):
        return jsonify([]), 400
    if not DB_PATH.exists():
        return jsonify([]), 503
    try:
        with _db_conn() as conn:
            row = conn.execute(
                "SELECT * FROM si_daily_window WHERE station=? AND month=? AND day=?",
                (station, month, day),
            ).fetchone()
        if not row:
            return jsonify([])
        return jsonify([dict(row)])
    except Exception:
        return jsonify({"error": "Internal server error"}), 500


def _compute_season_heatmap() -> dict:
    BASELINE_START = CONFIG["baseline"]["start"]
    BASELINE_END   = CONFIG["baseline"]["end"]
    cache_key = "season_heatmap"
    if cache_key in _COMPUTED_CACHE:
        return _COMPUTED_CACHE[cache_key]
    if _data.empty:
        return {"available": False}

    last_era5 = _data["date"].max()
    fs_path   = _CACHE_DIR / f"season_heatmap_{last_era5.date().isoformat()}.json"
    cached    = _fs_cache_load(fs_path)
    if cached is not None:
        _COMPUTED_CACHE[cache_key] = cached
        return cached

    daily_nat = (
        _data.groupby("date")["temperature_max"]
        .max()
        .reset_index(name="tmax")
    )
    daily_nat["year"]  = daily_nat["date"].dt.year
    daily_nat["month"] = daily_nat["date"].dt.month

    year_min = int(daily_nat["year"].min())
    year_max = int(daily_nat["year"].max())

    SEASONS = [
        ("Winter", 0, None, 2,  lambda y: pd.Timestamp(y, 2, 29 if _is_leap(y) else 28)),
        ("Spring", 1, 3,    5,  lambda y: pd.Timestamp(y, 5, 31)),
        ("Summer", 2, 6,    8,  lambda y: pd.Timestamp(y, 8, 31)),
        ("Autumn", 3, 9,    11, lambda y: pd.Timestamp(y, 11, 30)),
    ]

    records = []
    for yr in range(year_min, year_max + 1):
        for s_name, s_xi, s_start, s_end_m, end_fn in SEASONS:
            season_end = end_fn(yr)
            if season_end > last_era5:
                continue
            if s_name == "Winter":
                chunk = daily_nat[
                    ((daily_nat["year"] == yr - 1) & (daily_nat["month"] == 12)) |
                    ((daily_nat["year"] == yr)     & (daily_nat["month"].isin([1, 2])))
                ]
            else:
                chunk = daily_nat[
                    (daily_nat["year"] == yr) &
                    (daily_nat["month"] >= s_start) &
                    (daily_nat["month"] <= s_end_m)
                ]
            if len(chunk) < 30:
                continue
            records.append({"year": yr, "xi": s_xi, "season": s_name,
                            "avg": round(float(chunk["tmax"].mean()), 2),
                            "n_days": len(chunk)})

    if not records:
        result = {"available": False}
        _COMPUTED_CACHE[cache_key] = result
        return result

    rec_df = pd.DataFrame(records)

    def _pct_cat(pct):
        if   pct < 10: return "cold"
        elif pct < 20: return "cool"
        elif pct < 80: return "normal"
        elif pct < 95: return "hot"
        else:          return "extreme"

    def _pct_color(pct):
        return {"cold": "#3a5a8a", "cool": "#6c8fb6", "normal": "#e7d9b8",
                "hot": "#c25a2c", "extreme": "#962c1a"}[_pct_cat(pct)]

    out = []
    for xi in range(4):
        sub = rec_df[rec_df["xi"] == xi].copy()
        if sub.empty:
            continue
        all_avgs    = sub["avg"].values
        total       = len(all_avgs)
        baseline_sub = sub[(sub["year"] >= BASELINE_START) & (sub["year"] <= BASELINE_END)]
        baseline_avgs = baseline_sub["avg"].values
        sorted_desc = np.sort(all_avgs)[::-1]
        for _, row in sub.iterrows():
            pct = float((baseline_avgs < row["avg"]).mean() * 100) if len(baseline_avgs) > 0 \
                  else float((all_avgs < row["avg"]).mean() * 100)
            rank = int(np.searchsorted(-sorted_desc, -row["avg"])) + 1
            cat  = _pct_cat(pct)
            out.append({"x": int(row["xi"]), "y": int(row["year"]),
                        "avg": row["avg"], "percentile": round(pct, 1),
                        "cat": cat, "rank": rank, "total": total,
                        "color": _pct_color(pct), "season": row["season"],
                        "n_days": int(row["n_days"])})

    result = {"available": True, "data": out,
              "year_min": year_min, "year_max": year_max,
              "seasons": ["Winter", "Spring", "Summer", "Autumn"],
              "era5_last": last_era5.date().isoformat(),
              "baseline": f"{BASELINE_START}–{BASELINE_END}",
              "baseline_start": BASELINE_START, "baseline_end": BASELINE_END}
    _COMPUTED_CACHE[cache_key] = result
    _fs_cache_save(fs_path, result)
    return result


@app.route("/api/live/season_heatmap")
def api_season_heatmap():
    return jsonify(_compute_season_heatmap())


def _compute_spei_heatmap() -> dict:
    BASELINE_START = CONFIG["baseline"]["start"]
    BASELINE_END   = CONFIG["baseline"]["end"]
    cache_key = "spei_heatmap"
    if cache_key in _COMPUTED_CACHE:
        return _COMPUTED_CACHE[cache_key]
    if _data.empty:
        return {"available": False}

    last_era5 = _data["date"].max()
    fs_path   = _CACHE_DIR / f"spei_heatmap_{last_era5.date().isoformat()}.json"
    cached    = _fs_cache_load(fs_path)
    if cached is not None:
        _COMPUTED_CACHE[cache_key] = cached
        return cached

    daily_p   = _data.groupby("date")["precipitation_sum"].mean()
    daily_et0 = _data.groupby("date")["et0_evapotranspiration"].mean()
    daily_bal = (daily_p - daily_et0).reset_index()
    daily_bal.columns = ["date", "balance"]
    daily_bal["year"]  = daily_bal["date"].dt.year
    daily_bal["month"] = daily_bal["date"].dt.month

    year_min = int(daily_bal["year"].min())
    year_max = int(daily_bal["year"].max())

    SEASONS = [
        ("Winter", 0, None, 2,  lambda y: pd.Timestamp(y, 2, 29 if _is_leap(y) else 28)),
        ("Spring", 1, 3,    5,  lambda y: pd.Timestamp(y, 5, 31)),
        ("Summer", 2, 6,    8,  lambda y: pd.Timestamp(y, 8, 31)),
        ("Autumn", 3, 9,    11, lambda y: pd.Timestamp(y, 11, 30)),
    ]

    records = []
    for yr in range(year_min, year_max + 1):
        for s_name, s_xi, s_start, s_end_m, end_fn in SEASONS:
            if end_fn(yr) > last_era5:
                continue
            if s_name == "Winter":
                chunk = daily_bal[
                    ((daily_bal["year"] == yr - 1) & (daily_bal["month"] == 12)) |
                    ((daily_bal["year"] == yr)     & (daily_bal["month"].isin([1, 2])))
                ]
            else:
                chunk = daily_bal[
                    (daily_bal["year"] == yr) &
                    (daily_bal["month"] >= s_start) &
                    (daily_bal["month"] <= s_end_m)
                ]
            if len(chunk) < 30:
                continue
            records.append({"year": yr, "xi": s_xi, "season": s_name,
                            "balance": round(float(chunk["balance"].sum()), 1),
                            "n_days": len(chunk)})

    if not records:
        result = {"available": False}
        _COMPUTED_CACHE[cache_key] = result
        return result

    rec_df = pd.DataFrame(records)

    def _spei_cat(spei):
        if   spei < -1.5: return "extreme_dry"
        elif spei < -1.0: return "dry"
        elif spei <  1.0: return "normal"
        elif spei <  1.5: return "wet"
        else:             return "extreme_wet"

    def _spei_color(spei):
        return {"extreme_dry": "#8b3a0f", "dry": "#c2713a", "normal": "#e7e0d0",
                "wet": "#4a80b0", "extreme_wet": "#1e4d78"}[_spei_cat(spei)]

    out = []
    for xi in range(4):
        sub = rec_df[rec_df["xi"] == xi].copy()
        if sub.empty:
            continue
        all_vals     = sub["balance"].values
        n_total      = len(all_vals)
        baseline_sub = sub[(sub["year"] >= BASELINE_START) & (sub["year"] <= BASELINE_END)]
        b_vals       = baseline_sub["balance"].values if len(baseline_sub) >= 5 else all_vals

        gamma_shift = float(b_vals.min()) - 1e-6
        b_shifted   = b_vals - gamma_shift
        try:
            c_par, _, scale_par = stats.fisk.fit(b_shifted, floc=0)
        except Exception:
            c_par, scale_par = 1.0, float(b_shifted.mean())

        sorted_asc = np.sort(all_vals)
        for _, row in sub.iterrows():
            sv = max(float(row["balance"]) - gamma_shift, 1e-9)
            p  = float(np.clip(stats.fisk.cdf(sv, c_par, loc=0, scale=scale_par), 1e-6, 1 - 1e-6))
            spei_val = float(np.clip(stats.norm.ppf(p), -3.0, 3.0))
            rank = int(np.searchsorted(sorted_asc, row["balance"])) + 1
            cat  = _spei_cat(spei_val)
            out.append({"x": int(row["xi"]), "y": int(row["year"]),
                        "spei": round(spei_val, 2), "balance": row["balance"],
                        "cat": cat, "rank": rank, "total": n_total,
                        "color": _spei_color(spei_val), "season": row["season"],
                        "n_days": int(row["n_days"])})

    result = {"available": True, "data": out,
              "year_min": year_min, "year_max": year_max,
              "seasons": ["Winter", "Spring", "Summer", "Autumn"],
              "era5_last": last_era5.date().isoformat(),
              "baseline": f"{BASELINE_START}–{BASELINE_END}",
              "baseline_start": BASELINE_START, "baseline_end": BASELINE_END}
    _COMPUTED_CACHE[cache_key] = result
    _fs_cache_save(fs_path, result)
    return result


@app.route("/api/live/spei_heatmap")
def api_spei_heatmap():
    if not CONFIG.get("features", {}).get("spei_heatmap", True):
        return "", 204
    return jsonify(_compute_spei_heatmap())


def _compute_spei_station_seasonal() -> dict:
    BASELINE_START = CONFIG["baseline"]["start"]
    BASELINE_END   = CONFIG["baseline"]["end"]
    cache_key = "spei_station_seasonal"
    if cache_key in _COMPUTED_CACHE:
        return _COMPUTED_CACHE[cache_key]
    if _data.empty:
        return {"available": False}

    last_era5 = _data["date"].max()
    fs_path   = _CACHE_DIR / f"spei_station_seasonal_{last_era5.date().isoformat()}.json"
    cached    = _fs_cache_load(fs_path)
    if cached is not None:
        _COMPUTED_CACHE[cache_key] = cached
        return cached

    year_min = int(_data["year"].min())
    year_max = int(_data["year"].max())

    SEASONS = [
        ("Winter", None, 2,  lambda y: pd.Timestamp(y, 2, 29 if _is_leap(y) else 28)),
        ("Spring", 3,    5,  lambda y: pd.Timestamp(y, 5, 31)),
        ("Summer", 6,    8,  lambda y: pd.Timestamp(y, 8, 31)),
        ("Autumn", 9,    11, lambda y: pd.Timestamp(y, 11, 30)),
    ]
    MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
                         "Jul","Aug","Sep","Oct","Nov","Dec"]

    stations = sorted(_data["location"].unique())
    result_stations = {}

    for station in stations:
        sd = _data[_data["location"] == station].copy()
        sd["balance"] = sd["precipitation_sum"] - sd["et0_evapotranspiration"]
        season_series = {}

        for s_name, s_start, s_end_m, end_fn in SEASONS:
            records = []
            for yr in range(year_min, year_max + 1):
                if end_fn(yr) > last_era5:
                    continue
                if s_name == "Winter":
                    chunk = sd[
                        ((sd["year"] == yr - 1) & (sd["month"] == 12)) |
                        ((sd["year"] == yr)     & (sd["month"].isin([1, 2])))
                    ]
                else:
                    chunk = sd[
                        (sd["year"] == yr) &
                        (sd["month"] >= s_start) &
                        (sd["month"] <= s_end_m)
                    ]
                if len(chunk) < 30:
                    continue
                records.append({"year": yr, "balance": float(chunk["balance"].sum())})

            if len(records) < 10:
                continue

            rec_df      = pd.DataFrame(records)
            baseline_df = rec_df[(rec_df["year"] >= BASELINE_START) & (rec_df["year"] <= BASELINE_END)]
            b_vals      = baseline_df["balance"].values if len(baseline_df) >= 5 else rec_df["balance"].values

            gamma_shift = float(b_vals.min()) - 1e-6
            try:
                c_par, _, scale_par = stats.fisk.fit(b_vals - gamma_shift, floc=0)
            except Exception:
                c_par, scale_par = 1.0, max(float((b_vals - gamma_shift).mean()), 1e-6)

            spei_vals = []
            for bal in rec_df["balance"].values:
                sv = max(float(bal) - gamma_shift, 1e-9)
                p  = float(np.clip(stats.fisk.cdf(sv, c_par, loc=0, scale=scale_par), 1e-6, 1 - 1e-6))
                spei_vals.append(round(float(np.clip(stats.norm.ppf(p), -3.0, 3.0)), 2))

            years = [int(y) for y in rec_df["year"].tolist()]
            trend = {}
            if len(spei_vals) >= 10:
                try:
                    ts     = theilslopes(spei_vals, years)
                    mk_res = mk_test.original_test(np.array(spei_vals))
                    trend  = {"slope_per_decade": round(float(ts.slope) * 10, 3),
                              "p_value": round(float(mk_res.p), 3),
                              "mk_trend": mk_res.trend,
                              "intercept": round(float(ts.intercept), 3)}
                except Exception:
                    pass
            season_series[s_name] = {"years": years, "spei": spei_vals, "trend": trend}

        # Annual = mean of seasonal SPEI per year
        by_year = {}
        for s in season_series.values():
            for yr, sp in zip(s["years"], s["spei"]):
                by_year.setdefault(yr, []).append(sp)
        ann_years = sorted(yr for yr, vals in by_year.items() if len(vals) >= 2)
        ann_spei  = [round(float(np.mean(by_year[yr])), 2) for yr in ann_years]
        ann_trend = {}
        if len(ann_spei) >= 10:
            try:
                ts     = theilslopes(ann_spei, ann_years)
                mk_res = mk_test.original_test(np.array(ann_spei))
                ann_trend = {"slope_per_decade": round(float(ts.slope) * 10, 3),
                             "p_value": round(float(mk_res.p), 3),
                             "mk_trend": mk_res.trend,
                             "intercept": round(float(ts.intercept), 3)}
            except Exception:
                pass
        season_series["Annual"] = {"years": ann_years, "spei": ann_spei, "trend": ann_trend}

        # SPEI-30: monthly (calendar month water balance)
        for m_idx, m_name in enumerate(MONTH_NAMES_SHORT, start=1):
            records = []
            for yr in range(year_min, year_max + 1):
                m_end = pd.Timestamp(yr, 12, 31) if m_idx == 12 \
                        else pd.Timestamp(yr, m_idx + 1, 1) - pd.Timedelta(days=1)
                if m_end > last_era5:
                    continue
                chunk = sd[(sd["year"] == yr) & (sd["month"] == m_idx)]
                if len(chunk) < 20:
                    continue
                records.append({"year": yr, "balance": float(chunk["balance"].sum())})
            if len(records) < 10:
                continue
            rec_df      = pd.DataFrame(records)
            baseline_df = rec_df[(rec_df["year"] >= BASELINE_START) & (rec_df["year"] <= BASELINE_END)]
            b_vals      = baseline_df["balance"].values if len(baseline_df) >= 5 else rec_df["balance"].values
            gamma_shift = float(b_vals.min()) - 1e-6
            try:
                c_par, _, scale_par = stats.fisk.fit(b_vals - gamma_shift, floc=0)
            except Exception:
                c_par, scale_par = 1.0, max(float((b_vals - gamma_shift).mean()), 1e-6)
            spei_vals = []
            for bal in rec_df["balance"].values:
                sv = max(float(bal) - gamma_shift, 1e-9)
                p  = float(np.clip(stats.fisk.cdf(sv, c_par, loc=0, scale=scale_par), 1e-6, 1 - 1e-6))
                spei_vals.append(round(float(np.clip(stats.norm.ppf(p), -3.0, 3.0)), 2))
            years = [int(y) for y in rec_df["year"].tolist()]
            trend = {}
            if len(spei_vals) >= 10:
                try:
                    ts     = theilslopes(spei_vals, years)
                    mk_res = mk_test.original_test(np.array(spei_vals))
                    trend  = {"slope_per_decade": round(float(ts.slope) * 10, 3),
                              "p_value": round(float(mk_res.p), 3),
                              "mk_trend": mk_res.trend,
                              "intercept": round(float(ts.intercept), 3)}
                except Exception:
                    pass
            season_series[m_name] = {"years": years, "spei": spei_vals, "trend": trend}

        result_stations[station] = season_series

    result = {"available": True, "stations": result_stations,
              "era5_last": last_era5.date().isoformat(),
              "baseline": f"{BASELINE_START}–{BASELINE_END}",
              "year_min": year_min, "year_max": year_max}
    _COMPUTED_CACHE[cache_key] = result
    _fs_cache_save(fs_path, result)
    return result


@app.route("/api/live/spei_station_seasonal")
def api_spei_station_seasonal():
    if not CONFIG.get("features", {}).get("drought_trend_chart", True):
        return "", 204
    return jsonify(_compute_spei_station_seasonal())


# ── Tropical days / nights ────────────────────────────────────────────────────

_TROPICAL_CACHE: dict = {}


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


def _compute_tropical(col: str, threshold: float, streak: int) -> dict | None:
    key = (col, threshold, streak)
    if key in _TROPICAL_CACHE:
        return _TROPICAL_CACHE[key]
    if _data.empty:
        return None

    corr_col = col + "_corr" if col in ("temperature_max", "temperature_min", "temperature_mean") else col

    stations_out: dict = {}
    era5_last = ""

    for loc in _LOCATIONS:
        ld = _data[_data["location"] == loc].sort_values("date").copy()
        if ld.empty:
            continue
        if not era5_last:
            era5_last = ld["date"].max().strftime("%Y-%m-%d")

        qualifies = (ld[corr_col] > threshold).to_numpy()
        if streak > 1:
            qualifies = _streak_filter(qualifies, streak)
        ld = ld.assign(_qualifies=qualifies)

        annual = (
            ld[ld["_qualifies"]]
            .groupby("year")
            .size()
            .reindex(range(int(ld["year"].min()), int(ld["year"].max()) + 1), fill_value=0)
        )
        years  = annual.index.tolist()
        counts = [int(v) for v in annual.values]

        # Exclude current (possibly incomplete) year from NB fit
        fit_mask   = [i for i, y in enumerate(years) if y != _CSV_MAX_YEAR]
        fit_years  = [years[i]  for i in fit_mask]
        fit_counts = [counts[i] for i in fit_mask]

        nonzero_count = sum(1 for c in fit_counts if c > 0)
        trend: dict = {}

        if len(fit_years) >= 10 and nonzero_count >= 10:
            try:
                years_arr = np.array(fit_years, dtype=float)
                year_mean = float(years_arr[0])
                X_c       = sm.add_constant(years_arr - year_mean)
                fitted    = sm.NegativeBinomial(fit_counts, X_c).fit(disp=False, maxiter=200)

                x_dense = np.linspace(years[0], years[-1], len(years))
                X_dense = sm.add_constant(x_dense - year_mean)
                pred    = fitted.get_prediction(X_dense)
                pred_df = pred.summary_frame(alpha=0.05)

                mid_year        = float(np.median(fit_years))
                mid_mu          = float(np.exp(fitted.params[0] + fitted.params[1] * (mid_year - year_mean)))
                days_per_decade = round(mid_mu * (float(np.exp(fitted.params[1] * 10)) - 1), 1)
                alpha_val       = round(float(fitted.params[-1]), 3)

                mu_dense = pred_df["predicted"].values
                se_pred  = np.sqrt(mu_dense + mu_dense ** 2 * alpha_val)
                pi_low   = np.maximum(0.0, mu_dense - 1.96 * se_pred)
                pi_high  = mu_dense + 1.96 * se_pred

                trend = {
                    "model_used":      "nb",
                    "rate_per_year":   round(max(-50.0, min(50.0, float(np.exp(fitted.params[1]) - 1) * 100)), 2),
                    "days_per_decade": days_per_decade,
                    "p_value":         round(max(0.0001, min(0.9999, float(fitted.pvalues[1]))), 3),
                    "alpha":           alpha_val,
                    "aic":             round(float(fitted.aic), 1),
                    "fit_year_max":    int(fit_years[-1]),
                    "x_line":          [round(float(x), 2) for x in x_dense],
                    "y_line":          pred_df["predicted"].round(2).tolist(),
                    "ci_low":          pred_df["ci_lower"].round(2).tolist(),
                    "ci_high":         pred_df["ci_upper"].round(2).tolist(),
                    "pi_low":          pi_low.round(2).tolist(),
                    "pi_high":         pi_high.round(2).tolist(),
                }

                yl = trend["y_line"]; cl = trend["ci_low"]; ch = trend["ci_high"]
                if not (
                    all(np.isfinite(v) and v >= 0 for v in yl) and
                    all(np.isfinite(v)             for v in cl) and
                    all(np.isfinite(v)             for v in ch) and
                    all(cl[i] <= ch[i] for i in range(len(cl)))
                ):
                    trend = {}

            except Exception as e:
                import sys
                print(f"[tropical] NB fit failed for {loc} ({col},{threshold},{streak}): {e}", file=sys.stderr)

        stations_out[loc] = {
            "years":         years,
            "counts":        counts,
            "nonzero_count": nonzero_count,
            "trend":         trend,
        }

    if not stations_out:
        return None

    result = {"stations": stations_out, "era5_last": era5_last}
    _TROPICAL_CACHE[key] = result
    return result


@app.route("/api/live/tropical_days")
def api_tropical_days():
    if not CONFIG.get("features", {}).get("tropical_days_chart", True):
        return "", 204
    try:
        threshold = float(request.args.get("threshold", 30))
        streak    = max(1, int(request.args.get("streak", 1)))
    except (ValueError, TypeError):
        return jsonify({"error": "invalid params"}), 400
    result = _compute_tropical("temperature_max", threshold, streak)
    if result is None:
        return jsonify({"error": "no data"}), 503
    return jsonify(result)


@app.route("/api/live/tropical_nights")
def api_tropical_nights():
    if not CONFIG.get("features", {}).get("tropical_nights_chart", True):
        return "", 204
    try:
        threshold = float(request.args.get("threshold", 20))
        streak    = max(1, int(request.args.get("streak", 1)))
    except (ValueError, TypeError):
        return jsonify({"error": "invalid params"}), 400
    result = _compute_tropical("temperature_min", threshold, streak)
    if result is None:
        return jsonify({"error": "no data"}), 503
    return jsonify(result)


def _prewarm() -> None:
    """Pre-warm in-memory caches on startup (runs in a background daemon thread).

    Mirrors the _prewarm() in mk_api.py. Runs after a short delay so Flask has
    finished binding before heavy SQLite reads start.
    """
    import time
    time.sleep(5)

    today = datetime.date.today()
    # National cutoffs for today ± 1 day (covers different timezones and midnight edge)
    for delta in (-1, 0, 1):
        d = today + datetime.timedelta(days=delta)
        try:
            _compute_national_cutoffs(d.month, d.day)
        except Exception:
            pass

    # Pre-fetch today's live Open-Meteo data and compute today_status
    try:
        _today_status(today.isoformat(), None)
    except Exception:
        pass

    # Pre-warm the last-7-days range (prefetch archive + compute cutoffs)
    try:
        date_strings = [
            (today - datetime.timedelta(days=i)).isoformat()
            for i in range(6, -1, -1)
        ]
        _prefetch_range(date_strings)
        for ds in date_strings:
            dt = datetime.date.fromisoformat(ds)
            _compute_national_cutoffs(dt.month, dt.day)
    except Exception:
        pass


threading.Thread(target=_prewarm, daemon=True).start()

if __name__ == "__main__":
    host = os.environ.get("SIDECAR_HOST", "0.0.0.0")
    print(f"ERA5 sidecar listening on http://{host}:{PORT}")
    app.run(host=host, port=PORT, debug=False)
