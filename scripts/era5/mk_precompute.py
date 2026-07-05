"""
Pre-compute ERA5-Land statistics into SQLite for the ERA5 sidecar.

Run after mk_collect.py:
    DATA_DIR=/app/data/si python3 mk_precompute.py

Writes to DATA_DIR/era5-slovenia.db:
  si_<Station>         — raw daily ERA5 data per station
  si_daily_window      — ±7-day window percentile cutoffs + KDE per (station, month, day)
  si_annual_trend      — national Theil-Sen annual trend per calendar (month, day)
"""

import glob, json, os, sys, warnings
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk_test
from scipy.stats import gaussian_kde, theilslopes

warnings.filterwarnings("ignore")

# ── Config ─────────────────────────────────────────────────────────────────────

import yaml
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
    raise FileNotFoundError(f"Config file not found for COUNTRY={COUNTRY}")

DATA_DIR   = Path(os.environ.get("DATA_DIR", "/app/data/si"))
OUT_DIR    = DATA_DIR  # SQLite written directly into DATA_DIR
LAPSE_RATE = 0.0065
TREND_START_YEAR = CONFIG.get("trend_start_year", 1950)
PROJ_END_YEAR    = CONFIG.get("projection_end_year", 2050)
MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
               "Jul","Aug","Sep","Oct","Nov","Dec"]

# ── Load all station CSVs ──────────────────────────────────────────────────────

def _load_csv(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    df["date"] = pd.to_datetime(df["date"], format="%Y-%m-%d")
    if "source" not in df.columns:
        df["source"] = "era5"
    return df

def load_all() -> pd.DataFrame:
    dfs = [_load_csv(f) for f in sorted(glob.glob(str(DATA_DIR / "*.csv")))]
    data = pd.concat(dfs, ignore_index=True)
    data = data[data["date"] <= pd.Timestamp.today()]
    # Exclude ERA5T (preliminary) rows from statistical tables — they will be
    # silently upgraded to final ERA5 on the next collection run.
    data = data[data["source"] != "era5t"]
    data["year"]  = data["date"].dt.year
    data["month"] = data["date"].dt.month
    for c in ["temperature_max", "temperature_min", "temperature_mean"]:
        data[c + "_corr"] = data[c] + data["elevation_diff_m"] * LAPSE_RATE
    return data

# ── Leap-year helper ──────────────────────────────────────────────────────────

def _is_leap(y: int) -> bool:
    return (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)

# ── Window filter (mirrors mk_api.py) ─────────────────────────────────────────

def window_filter(loc_data: pd.DataFrame, month: int, day: int, half_window: int) -> pd.DataFrame:
    try:
        target_doy = pd.Timestamp(2001, month, day).dayofyear
    except ValueError:
        target_doy = pd.Timestamp(2001, month, 28).dayofyear
    row_doy   = loc_data["date"].dt.dayofyear.to_numpy()
    raw_diff  = (row_doy - target_doy).astype(int)
    circ_diff = ((raw_diff + 182) % 365) - 182
    in_win    = np.abs(circ_diff) <= half_window
    out       = loc_data[in_win].copy()
    rd_out    = raw_diff[in_win]
    year_adj  = np.where(rd_out >  182, 1, np.where(rd_out < -182, -1, 0))
    out["_window_year"] = out["year"].to_numpy() + year_adj
    return out

def window_series(loc_data: pd.DataFrame, month: int, day: int,
                  half_window: int, col: str) -> pd.Series:
    sub    = window_filter(loc_data, month, day, half_window)
    agg_fn = "sum" if col in ["precipitation_sum", "et0_evapotranspiration"] else "mean"
    return sub.groupby("_window_year")[col].agg(agg_fn).dropna()

# ── 1. Daily window stats ──────────────────────────────────────────────────────

def _compute_daily_window_row(station: str, loc_data: pd.DataFrame,
                               month: int, day: int) -> dict | None:
    """Percentile cutoffs + KDE for one (station, month, day) with ±7-day window."""
    window    = window_filter(loc_data, month, day, 7)
    daily_max = window.groupby("date")["temperature_max_corr"].max().dropna()
    samples   = daily_max.to_numpy()
    if len(samples) < 50:
        return None

    cutoffs = {
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

    return {
        "station":           station,
        "month":             month,
        "day":               day,
        "p5":                cutoffs["p5"],
        "p10":               cutoffs["p10"],
        "p20":               cutoffs["p20"],
        "p50":               cutoffs["p50"],
        "p80":               cutoffs["p80"],
        "p95":               cutoffs["p95"],
        "n_samples":         int(len(samples)),
        "year_min":          int(loc_data["year"].min()),
        "year_max":          int(loc_data["year"].max()),
        "distribution_json": json.dumps(distribution, separators=(",", ":")),
    }


def compute_daily_window(data: pd.DataFrame) -> pd.DataFrame:
    rows = []
    stations = sorted(data["location"].unique())
    total = len(stations) * 365
    done  = 0
    for station in stations:
        loc_data = data[data["location"] == station]
        for month in range(1, 13):
            for day in range(1, 32):
                try:
                    pd.Timestamp(2001, month, day)
                except ValueError:
                    continue
                row = _compute_daily_window_row(station, loc_data, month, day)
                if row:
                    rows.append(row)
                done += 1
                if done % 100 == 0:
                    pct = done / total * 100
                    print(f"  daily_window {done}/{total} ({pct:.0f}%)", end="\r", flush=True)
    print()
    return pd.DataFrame(rows)

# ── 2. National annual trend ───────────────────────────────────────────────────

def _compute_annual_trend_row(data: pd.DataFrame, month: int, day: int) -> dict | None:
    """National Theil-Sen trend for one (month, day).  Mirrors compute_annual_trend."""
    window     = window_filter(data, month, day, 30)
    daily_mean = (
        window.groupby(["_window_year", "date"])["temperature_max"]
        .mean()
        .reset_index(name="tmax")
    )
    annual_raw = (
        daily_mean.groupby("_window_year")["tmax"]
        .apply(lambda x: np.percentile(x.dropna(), 90) if len(x.dropna()) >= 50 else np.nan)
        .dropna()
    )
    annual = annual_raw[annual_raw.index >= TREND_START_YEAR]
    if len(annual) < 10:
        return None

    x_arr = annual.index.to_numpy(float)
    y_arr = annual.values
    first_yr, last_yr = int(x_arr.min()), int(x_arr.max())

    res    = theilslopes(y_arr, x_arr, 0.95)
    slope  = res.slope
    x_med  = float(np.median(x_arr))
    y_med  = float(np.median(y_arr))
    ic     = y_med - slope          * x_med
    ic_hi  = y_med - res.high_slope * x_med
    ic_lo  = y_med - res.low_slope  * x_med
    mk_r   = mk_test.yue_wang_modification_test(y_arr)

    x_hist = np.linspace(x_arr.min(), x_arr.max(), 300)
    y_hist = slope          * x_hist + ic
    u_hist = res.high_slope * x_hist + ic_hi
    l_hist = res.low_slope  * x_hist + ic_lo

    x_fc = np.linspace(last_yr, PROJ_END_YEAR, 200)
    y_fc = slope          * x_fc + ic
    u_fc = res.high_slope * x_fc + ic_hi
    l_fc = res.low_slope  * x_fc + ic_lo

    scatter = [{"x": int(yr), "y": round(float(v), 2)} for yr, v in zip(x_arr, y_arr)]
    dlabel  = f"{MONTH_NAMES[month - 1]} {day}"

    return {
        "month":        month,
        "day":          day,
        "day_label":    dlabel,
        "year_min":     first_yr,
        "year_max":     last_yr,
        "trend10":      round(float(slope * 10), 3),
        "p_val":        round(float(mk_r.p), 5),
        "tau":          round(float(mk_r.Tau), 3),
        "n_years":      int(len(x_arr)),
        "scatter_json": json.dumps(scatter, separators=(",", ":")),
        "hist_x_json":      json.dumps([round(v, 2) for v in x_hist.tolist()], separators=(",", ":")),
        "hist_y_json":      json.dumps([round(v, 3) for v in y_hist.tolist()], separators=(",", ":")),
        "hist_upper_json":  json.dumps([round(v, 3) for v in u_hist.tolist()], separators=(",", ":")),
        "hist_lower_json":  json.dumps([round(v, 3) for v in l_hist.tolist()], separators=(",", ":")),
        "proj_x_json":      json.dumps([round(v, 2) for v in x_fc.tolist()],  separators=(",", ":")),
        "proj_y_json":      json.dumps([round(v, 3) for v in y_fc.tolist()],  separators=(",", ":")),
        "proj_upper_json":  json.dumps([round(v, 3) for v in u_fc.tolist()],  separators=(",", ":")),
        "proj_lower_json":  json.dumps([round(v, 3) for v in l_fc.tolist()],  separators=(",", ":")),
    }


def compute_annual_trends(data: pd.DataFrame) -> pd.DataFrame:
    rows = []
    total = 365
    done  = 0
    for month in range(1, 13):
        for day in range(1, 32):
            try:
                pd.Timestamp(2001, month, day)
            except ValueError:
                continue
            row = _compute_annual_trend_row(data, month, day)
            if row:
                rows.append(row)
            done += 1
            if done % 10 == 0:
                print(f"  annual_trend {done}/{total} ({done/total*100:.0f}%)", end="\r", flush=True)
    print()
    return pd.DataFrame(rows)

# ── 3. Season heatmap ─────────────────────────────────────────────────────────

def compute_season_heatmap(data: pd.DataFrame) -> pd.DataFrame:
    """National daily-max mean per (year, season), ranked vs 1950–1980 baseline."""
    BASELINE_START = CONFIG["baseline"]["start"]
    BASELINE_END   = CONFIG["baseline"]["end"]

    daily_nat = (
        data.groupby("date")["temperature_max"]
        .max()
        .reset_index(name="tmax")
    )
    daily_nat["year"]  = daily_nat["date"].dt.year
    daily_nat["month"] = daily_nat["date"].dt.month

    last_era5 = daily_nat["date"].max()
    year_min  = int(daily_nat["year"].min())
    year_max  = int(daily_nat["year"].max())

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
            records.append({
                "year":   yr,
                "xi":     s_xi,
                "season": s_name,
                "avg":    round(float(chunk["tmax"].mean()), 2),
                "n_days": len(chunk),
            })

    if not records:
        return pd.DataFrame()

    rec_df = pd.DataFrame(records)

    def _pct_cat(pct):
        if   pct < 10: return "cold"
        elif pct < 20: return "cool"
        elif pct < 80: return "normal"
        elif pct < 95: return "hot"
        else:          return "extreme"

    def _pct_color(pct):
        return {"cold":"#3a5a8a","cool":"#6c8fb6","normal":"#e7d9b8",
                "hot":"#c25a2c","extreme":"#962c1a"}[_pct_cat(pct)]

    out_rows = []
    for xi in range(4):
        sub = rec_df[rec_df["xi"] == xi].copy()
        if sub.empty:
            continue
        all_avgs      = sub["avg"].values
        total         = len(all_avgs)
        baseline_sub  = sub[(sub["year"] >= BASELINE_START) & (sub["year"] <= BASELINE_END)]
        baseline_avgs = baseline_sub["avg"].values
        sorted_desc   = np.sort(all_avgs)[::-1]

        for _, row in sub.iterrows():
            if len(baseline_avgs) > 0:
                pct = float((baseline_avgs < row["avg"]).mean() * 100)
            else:
                pct = float((all_avgs < row["avg"]).mean() * 100)
            rank = int(np.searchsorted(-sorted_desc, -row["avg"])) + 1
            cat  = _pct_cat(pct)
            out_rows.append({
                "x":          int(row["xi"]),
                "y":          int(row["year"]),
                "season":     row["season"],
                "avg":        row["avg"],
                "percentile": round(pct, 1),
                "cat":        cat,
                "rank":       rank,
                "total":      total,
                "color":      _pct_color(pct),
                "n_days":     int(row["n_days"]),
            })

    return pd.DataFrame(out_rows)

# ── 4. Write raw station tables to SQLite ─────────────────────────────────────

def write_station_tables(conn) -> list[str]:
    written = []
    for src in sorted(glob.glob(str(DATA_DIR / "*.csv"))):
        name  = Path(src).stem        # e.g. "Ljubljana"
        tbl   = f"si_{name.lower()}"
        df    = pd.read_csv(src)
        df.to_sql(tbl, conn, if_exists="replace", index=False)
        written.append(tbl)
        print(f"  wrote {len(df):,} rows → {tbl}")
    return written

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    import sqlite3
    db_path = OUT_DIR / "era5-slovenia.db"
    print(f"Writing to {db_path}")

    print("Loading ERA5 station data…")
    data = load_all()
    print(f"  {len(data):,} rows, {data['location'].nunique()} stations, "
          f"{data['year'].min()}–{data['year'].max()}")

    conn = sqlite3.connect(db_path)

    print("\n[1/4] Writing raw station tables to SQLite…")
    write_station_tables(conn)

    print("\n[2/4] Computing daily window stats (±7 day, per station × day)…")
    dw = compute_daily_window(data)
    dw.to_sql("si_daily_window", conn, if_exists="replace", index=False)
    print(f"  wrote {len(dw):,} rows → si_daily_window")

    print("\n[3/4] Computing national annual trend (per calendar day)…")
    at = compute_annual_trends(data)
    at.to_sql("si_annual_trend", conn, if_exists="replace", index=False)
    print(f"  wrote {len(at):,} rows → si_annual_trend")

    print("\n[4/4] Computing season heatmap…")
    sh = compute_season_heatmap(data)
    sh.to_sql("si_season_heatmap", conn, if_exists="replace", index=False)
    print(f"  wrote {len(sh):,} rows → si_season_heatmap")

    conn.close()
    print(f"\nDone. SQLite written to {db_path}")

if __name__ == "__main__":
    main()
