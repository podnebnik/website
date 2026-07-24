"""
Export the tables of a generated climate-si.db back to the datapackage CSV paths.

T-5.7c switched the shipped datasette to the *generated* tables: the derived
climate-si.*.csv files are no longer committed (they are produced at image-build
time by precompute_datasette.py). `invoke create-databases` still imports CSVs at
the paths declared in data/climate-si/datapackage.yaml, so this script materialises
those CSVs from the freshly-built DB, in the exact format the committed files used
(pandas to_csv, index-less, NaN → empty). Run it after precompute_datasette.py and
before `invoke create-databases`:

    DB_PATH=.../data/raw/climate-si.db OUT_DIR=.../data python3 export_datasette_csv.py

Each table `t` is written to OUT_DIR/climate-si.<t>.csv, matching the resource
paths in datapackage.yaml.
"""

import os
import sqlite3
import sys
from pathlib import Path

import pandas as pd

DB_PATH = Path(os.environ.get("DB_PATH", "/app/data/si/climate-si.db"))
OUT_DIR = Path(os.environ.get("OUT_DIR", str(DB_PATH.parent.parent)))


def main() -> None:
    if not DB_PATH.exists():
        sys.exit(f"DB not found: {DB_PATH}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    try:
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
        ]
        if not tables:
            sys.exit(f"No tables in {DB_PATH}")
        for name in tables:
            df = pd.read_sql_query(f'SELECT * FROM "{name}"', conn)
            out = OUT_DIR / f"climate-si.{name}.csv"
            df.to_csv(out, index=False)
            print(f"  wrote {len(df):,} rows → {out}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
