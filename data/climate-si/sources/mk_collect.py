"""
Fetch historical ERA5-Land climate data from Open-Meteo for all stations
defined in si.yaml (next to this script).
Saves one CSV per station into DATA_DIR (env var, default /app/data/si).

Supports differential updates: automatically detects the latest date in existing
files and fetches only new data from that point forward. Use --force-refresh to
rebuild all files from START_DATE.

Install dependencies:
    pip install openmeteo-requests requests-cache retry-requests pandas pyyaml
"""

import openmeteo_requests
import requests_cache
import pandas as pd
from retry_requests import retry
import os
import time
import urllib3
import argparse
import glob
import yaml
from pathlib import Path
from datetime import datetime, timedelta

# ── Configuration ────────────────────────────────────────────────────────────

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

# ── CLI Arguments ────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(
    description=f"Fetch ERA5-Land climate data from Open-Meteo for {CONFIG['name']} locations."
)
parser.add_argument(
    "--force-refresh",
    action="store_true",
    help="Force complete re-fetch of all data from START_DATE (ignores existing files)",
)
parser.add_argument(
    "--verbose",
    action="store_true",
    help="Enable verbose output for debugging",
)
args = parser.parse_args()

START_DATE = str(CONFIG["data_start_date"])
# ERA5-Land reanalysis from Open-Meteo has a ~5-day lag; for the most recent days
# the archive API returns ERA5T (near-real-time).  We collect everything through
# yesterday and mark the trailing window as preliminary.  Each collection run
# re-fetches the last REFRESH_WINDOW days so preliminary rows get silently
# upgraded to final ERA5 once the reanalysis catches up.
ERA5_PRELIM_DAYS = 7   # rows within this window are tagged source="era5t"
REFRESH_WINDOW   = 15  # always re-fetch last N days to pick up ERA5T→ERA5 upgrades
END_DATE = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
OUTPUT_DIR = os.environ.get("DATA_DIR", "/app/data/si")

# ── Derive required variables from enabled features ───────────────────────────
# Temperature: needed by regression_chart, trend_calendar, station_map,
#              hero_cards, today_section, season_heat_heatmap
# Precipitation + ET₀: needed only by spei_heatmap and drought_trend_chart
_TEMP_FEATURES       = {'regression_chart', 'trend_calendar', 'station_map',
                        'hero_cards', 'today_section', 'season_heat_heatmap'}
_PRECIP_ET0_FEATURES = {'spei_heatmap', 'drought_trend_chart'}
_feat = CONFIG.get('features', {})

DAILY_VARIABLES = []
if any(_feat.get(f, False) for f in _TEMP_FEATURES):
    DAILY_VARIABLES += ["temperature_2m_max", "temperature_2m_min", "temperature_2m_mean"]
if any(_feat.get(f, False) for f in _PRECIP_ET0_FEATURES):
    DAILY_VARIABLES += ["precipitation_sum", "et0_fao_evapotranspiration"]

if not DAILY_VARIABLES:
    import sys as _sys
    _sys.exit("No variables to collect — all data-requiring features are disabled in config.")

LOCATIONS = CONFIG["stations"]

# ── Setup Open-Meteo client with cache + retry ────────────────────────────────

cache_session = requests_cache.CachedSession(".openmeteo_cache", expire_after=-1)
retry_session = retry(cache_session, retries=3, backoff_factor=2)
openmeteo = openmeteo_requests.Client(session=retry_session)

os.makedirs(OUTPUT_DIR, exist_ok=True)  # creates data/<COUNTRY>/ if needed

# Precompute strict date bounds as date objects
start_date = pd.to_datetime(START_DATE).date()
end_date   = pd.to_datetime(END_DATE).date()

# ── Helpers ──────────────────────────────────────────────────────────────────

def get_filename_for_location(location_name):
    """Return simplified filename for a location (e.g., '<Name>.csv')."""
    return f"{location_name}.csv"


def get_legacy_filenames(location_name):
    """Find legacy date-embedded filenames for a location.

    Returns list of matching paths, e.g.:
        <Name>_<lat>_<lon>_<start>_<end>.csv
    """
    pattern = os.path.join(OUTPUT_DIR, f"{location_name}_*.csv")
    return glob.glob(pattern)


def read_last_date_from_csv(filepath):
    """Extract the latest date from an existing CSV file.
    
    Returns a date object or None if file is empty/invalid.
    """
    try:
        df = pd.read_csv(filepath, usecols=["date"])
        if df.empty:
            return None
        last_date_str = df["date"].iloc[-1]
        return pd.to_datetime(last_date_str).date()
    except Exception as e:
        if args.verbose:
            print(f"    [DEBUG] Error reading last date from {filepath}: {e}")
        return None


def load_existing_data(filepath):
    """Load existing CSV data into a DataFrame.

    Returns DataFrame or None if file doesn't exist/is invalid.
    Backfills 'source' column if absent (legacy files pre-date the two-tier scheme).
    """
    try:
        if not os.path.exists(filepath):
            return None
        df = pd.read_csv(filepath)
        if not df.empty:
            df["date"] = pd.to_datetime(df["date"]).dt.date
            if "source" not in df.columns:
                df["source"] = "era5"
        return df
    except Exception as e:
        if args.verbose:
            print(f"    [DEBUG] Error loading existing data from {filepath}: {e}")
        return None


def consolidate_legacy_files(location_name, new_filepath):
    """Consolidate old date-embedded files into new simplified format.
    
    If old files exist and new file doesn't, migrate the latest one.
    Returns True if migration occurred, False otherwise.
    """
    if os.path.exists(new_filepath):
        return False  # New file already exists, no migration needed
    
    legacy_files = get_legacy_filenames(location_name)
    if not legacy_files:
        return False  # No legacy files found
    
    # Use the most recent legacy file (by modification time)
    latest_legacy = max(legacy_files, key=os.path.getmtime)
    print(f"  Migrating legacy file: {os.path.basename(latest_legacy)} -> {os.path.basename(new_filepath)}")
    os.rename(latest_legacy, new_filepath)
    
    # Clean up any other legacy files
    for legacy_file in legacy_files:
        if os.path.exists(legacy_file):
            os.remove(legacy_file)
            if args.verbose:
                print(f"    [DEBUG] Removed duplicate legacy file: {legacy_file}")
    
    return True


def seconds_until_utc_midnight():
    """Seconds from now until next UTC midnight."""
    import datetime as dt
    now = dt.datetime.utcnow()
    midnight = (now + dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((midnight - now).total_seconds()) + 60  # +60s buffer


def wait_if_rate_limited():
    """Check API status and sleep until the appropriate limit resets."""
    try:
        _probe_station = CONFIG["stations"][0]
        probe = cache_session.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={"latitude": round(_probe_station["lat"], 1),
                    "longitude": round(_probe_station["lon"], 1),
                    "start_date": "2024-01-01", "end_date": "2024-01-02",
                    "daily": "temperature_2m_max", "timezone": "UTC"},
            timeout=10,
        )
    except Exception as e:
        print(f"  API probe failed ({e.__class__.__name__}): {e}", flush=True)
        return
    if probe.from_cache:
        return  # cached response, no actual API call was made
    try:
        body = probe.json()
    except Exception:
        return
    reason = body.get("reason", "").lower() if isinstance(body, dict) else ""
    if "daily" in reason and "limit exceeded" in reason:
        secs = seconds_until_utc_midnight()
        hrs = secs / 3600
        print(f"  Daily API limit hit — waiting {hrs:.1f} hours until UTC midnight...", flush=True)
        time.sleep(secs)
    elif probe.status_code == 429 or ("hourly" in reason and "limit exceeded" in reason):
        print("  Hourly API limit hit — waiting 60 minutes...", flush=True)
        time.sleep(3600)


def fetch_location(loc):
    name      = loc["name"]
    lat       = loc["lat"]
    lon       = loc["lon"]
    elevation = loc["elevation"]

    # Use simplified filename format
    filename = get_filename_for_location(name)
    filepath = os.path.join(OUTPUT_DIR, filename)

    # Attempt to migrate legacy date-embedded files to new format
    consolidate_legacy_files(name, filepath)

    # Determine fetch date range (differential or full)
    fetch_start_date = START_DATE
    fetch_end_date = END_DATE
    fetch_mode = "full (--force-refresh)"
    
    if os.path.exists(filepath) and not args.force_refresh:
        # Differential update: fetch from day after last date, but always reach
        # back REFRESH_WINDOW days so ERA5T rows get upgraded to final ERA5.
        last_date = read_last_date_from_csv(filepath)
        if last_date is not None:
            last_date_dt = pd.to_datetime(last_date)
            next_date    = (last_date_dt + timedelta(days=1)).date()
            refresh_from = (datetime.now() - timedelta(days=REFRESH_WINDOW)).date()
            # Effective start is the earlier of "first missing day" and "refresh window"
            effective_start = min(next_date, refresh_from)

            if effective_start <= end_date:
                fetch_start_date = effective_start.strftime("%Y-%m-%d")
                fetch_end_date   = END_DATE
                fetch_mode = f"differential+refresh (from {fetch_start_date} to {fetch_end_date})"
                print(f"Updating {name} ({lat}, {lon})... {fetch_mode}", flush=True)
            else:
                print(f"Skipping {name} — already up-to-date (last: {last_date})", flush=True)
                return
        else:
            print(f"Fetching {name} ({lat}, {lon})... full (existing file is empty)", flush=True)
    else:
        if args.force_refresh and os.path.exists(filepath):
            print(f"Fetching {name} ({lat}, {lon})... full (--force-refresh)", flush=True)
        else:
            print(f"Fetching {name} ({lat}, {lon})... full", flush=True)

    wait_if_rate_limited()

    params = {
        "latitude":   lat,
        "longitude":  lon,
        "start_date": fetch_start_date,
        "end_date":   fetch_end_date,
        "daily":      DAILY_VARIABLES,
        "timezone":   "UTC",
    }

    try:
        responses = openmeteo.weather_api(
            "https://archive-api.open-meteo.com/v1/archive", params=params
        )
        response = responses[0]

        era5_elevation = response.Elevation()
        elev_diff = era5_elevation - elevation
        print(f"  ERA5-Land model elevation : {era5_elevation:.1f} m", flush=True)
        print(f"  Station elevation         : {elevation} m", flush=True)
        print(f"  Difference (ERA5-station) : {elev_diff:.1f} m", flush=True)

        daily = response.Daily()

        _has_precip = "precipitation_sum" in DAILY_VARIABLES
        _idx_precip = 3 if _has_precip else None
        _idx_et0    = 4 if _has_precip else None

        df_new = pd.DataFrame({
            "date": pd.date_range(
                start=pd.to_datetime(daily.Time(),    unit="s", utc=True),
                end=pd.to_datetime(daily.TimeEnd(),   unit="s", utc=True),
                freq=pd.Timedelta(seconds=daily.Interval()),
                inclusive="left",
            ).date,
            "temperature_max":  daily.Variables(0).ValuesAsNumpy(),
            "temperature_min":  daily.Variables(1).ValuesAsNumpy(),
            "temperature_mean": daily.Variables(2).ValuesAsNumpy(),
            **({
                "precipitation_sum":      daily.Variables(_idx_precip).ValuesAsNumpy(),
                "et0_evapotranspiration": daily.Variables(_idx_et0).ValuesAsNumpy(),
            } if _has_precip else {}),
        })

        before = len(df_new)
        fetch_start_obj = pd.to_datetime(fetch_start_date).date()
        fetch_end_obj = pd.to_datetime(fetch_end_date).date()
        df_new = df_new[(df_new["date"] >= fetch_start_obj) & (df_new["date"] <= fetch_end_obj)]
        dropped = before - len(df_new)
        if dropped:
            print(f"  Dropped {dropped} out-of-range row(s) (timezone artifact)", flush=True)

        # Add metadata columns
        df_new.insert(0, "location",            name)
        df_new.insert(1, "latitude",            lat)
        df_new.insert(2, "longitude",           lon)
        df_new.insert(3, "elevation_station_m", elevation)
        df_new.insert(4, "elevation_era5_m",    round(era5_elevation, 1))
        df_new.insert(5, "elevation_diff_m",    round(elev_diff, 1))

        # Tag data source: era5t for recent days (within ERA5 reanalysis lag),
        # era5 for everything older (final reanalysis confirmed available).
        prelim_cutoff = (datetime.now() - timedelta(days=ERA5_PRELIM_DAYS)).date()
        df_new["source"] = ["era5t" if d >= prelim_cutoff else "era5" for d in df_new["date"]]

        # Merge with existing data if differential update
        if not args.force_refresh and os.path.exists(filepath):
            df_existing = load_existing_data(filepath)
            if df_existing is not None and not df_existing.empty:
                # Combine existing and new data
                df_combined = pd.concat([df_existing, df_new], ignore_index=True)
                # Remove duplicates (keep last/newest)
                df_combined = df_combined.drop_duplicates(subset=["date"], keep="last")
                # Sort by date
                df_combined = df_combined.sort_values("date").reset_index(drop=True)
                df_final = df_combined
                total_rows = len(df_final)
                new_rows = len(df_new)
                print(f"  Merged {new_rows} new rows with existing data", flush=True)
            else:
                df_final = df_new
                total_rows = len(df_final)
                new_rows = total_rows
        else:
            df_final = df_new
            total_rows = len(df_final)
            new_rows = total_rows

        print(f"  Date range in CSV: {df_final['date'].iloc[0]} -> {df_final['date'].iloc[-1]}", flush=True)

        df_final.to_csv(filepath, index=False)
        print(f"  Saved {total_rows} total rows ({new_rows} new) -> {filepath}", flush=True)

    except Exception as e:
        err = str(e).lower()
        if "daily" in err and "limit exceeded" in err:
            secs = seconds_until_utc_midnight()
            hrs = secs / 3600
            print(f"  Daily API limit hit — waiting {hrs:.1f} hours until UTC midnight, then will retry {name}...", flush=True)
            time.sleep(secs)
            # Re-queue this location by recursing once
            fetch_location(loc)
            return
        elif "hourly" in err and "limit exceeded" in err:
            print(f"  Hourly API limit hit — waiting 60 minutes, then will retry {name}...", flush=True)
            time.sleep(3600)
            fetch_location(loc)
            return
        else:
            print(f"  Failed for {name}: {e}", flush=True)

    print(f"  Waiting 65 seconds before next request...", flush=True)
    time.sleep(65)


# ── Fetch and save ────────────────────────────────────────────────────────────

print(f"\nStarting data collection {'[FORCE REFRESH MODE]' if args.force_refresh else '[DIFFERENTIAL UPDATE MODE]'}")
print(f"Date range: {START_DATE} to {END_DATE}")
print(f"Locations: {len(LOCATIONS)}")
print()

for loc in LOCATIONS:
    fetch_location(loc)

print("\nDone! All files saved to:", os.path.abspath(OUTPUT_DIR))