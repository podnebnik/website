#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/app/data/si}"
DB_PATH="${DATA_DIR}/era5-slovenia.db"

# If no CSV files yet, run initial data collection (takes ~10 min on first run)
CSV_COUNT=$(find "$DATA_DIR" -name "*.csv" 2>/dev/null | wc -l)
if [ "$CSV_COUNT" -eq 0 ]; then
    echo "[entrypoint] No ERA5 CSVs found — running initial collection..."
    uv run python mk_collect.py
fi

# (Re-)generate the SQLite if it's missing or CSVs are newer
LATEST_CSV=$(find "$DATA_DIR" -name "*.csv" -newer "$DB_PATH" 2>/dev/null | head -1)
if [ ! -f "$DB_PATH" ] || [ -n "$LATEST_CSV" ]; then
    echo "[entrypoint] Building SQLite database from CSVs..."
    uv run python mk_precompute.py
fi

# Start the API service (foreground)
echo "[entrypoint] Starting ERA5 API on port ${API_PORT:-5052}..."
exec uv run python mk_api.py
