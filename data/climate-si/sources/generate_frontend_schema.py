#!/usr/bin/env python3
"""Codegen the frontend datasette column contract from datapackage.yaml (T-5.3b, D-18 Half 2).

`data/climate-si/datapackage.yaml` is the AUTHORITATIVE per-table column declaration
(D-18, T-5.3a): `validate.py` already derives every derived table's column *set* from
it. This script closes the other end of the seam — it emits a TypeScript module
(`code/ali-je-vroce-era5/generated/datasette-schema.ts`) with, per table:

  * a row interface `Ds<Table>`            — every declared column, typed
  * a column tuple `<TABLE>_COLUMNS`       — the declared column names, `as const`
  * a column union  `<Table>Col`           — `typeof <TABLE>_COLUMNS[number]`

The frontend (`api.ts`, `types.ts`) consumes these instead of hand-maintained row
shapes and bare `_col=` string literals. A column renamed in datapackage.yaml then
regenerates this file, and any frontend site still naming the old column fails
`yarn typecheck` — instead of building green and breaking the live page (dsGet<T> is
an unchecked cast, api.ts:63-66; snapshot:check replays URL-keyed fixtures without a
live datasette). A pytest freshness gate (tests/test_frontend_schema.py) fails if the
committed file drifts from this generator's output.

`daily_percentiles` is DECLARED in datapackage but fetched ZERO times by the frontend
(T-5.3b Step 1d). It is excluded from the generated contract so no dead types are
emitted — this is exclusion FROM THE GENERATOR ONLY, not removal from the datasette
(the table stays a public resource; its removal is its own ticket, D-18).

Regenerate with:

    uv run --project data/climate-si/sources \
        python data/climate-si/sources/generate_frontend_schema.py

Writing to stdout instead (e.g. to diff): pass --stdout.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

# Tables declared in datapackage but NOT part of the frontend contract. Excluding a
# table here does NOT remove it from the datasette (D-18) — it only keeps dead types
# out of the generated module. `daily_percentiles`: declared, fetched zero times.
EXCLUDED_TABLES = {"daily_percentiles"}

# frictionless field type -> TypeScript type. Datasette serves `date` columns as ISO
# "YYYY-MM-DD" strings, so they map to `string`, not a Date.
TS_TYPE = {
    "string": "string",
    "date": "string",
    "number": "number",
    "integer": "number",
}

DATAPACKAGE = Path(__file__).resolve().parent.parent / "datapackage.yaml"
# repo root: sources -> climate-si -> data -> <root>
OUTPUT = (
    Path(__file__).resolve().parents[3]
    / "code" / "ali-je-vroce-era5" / "generated" / "datasette-schema.ts"
)

REGEN_CMD = (
    "uv run --project data/climate-si/sources "
    "python data/climate-si/sources/generate_frontend_schema.py"
)


def _pascal(table: str) -> str:
    return "".join(part.capitalize() for part in table.split("_"))


def _load_tables(dp_path: Path) -> list[tuple[str, list[tuple[str, str]]]]:
    """Return [(table, [(col, frictionless_type), …]), …] in datapackage order,
    excluding EXCLUDED_TABLES."""
    with open(dp_path) as f:
        dp = yaml.safe_load(f)
    tables: list[tuple[str, list[tuple[str, str]]]] = []
    for res in dp.get("resources", []):
        name = res["name"]
        if name in EXCLUDED_TABLES:
            continue
        fields = res.get("schema", {}).get("fields")
        if fields is None:
            raise ValueError(f"datapackage.yaml resource {name!r} has no schema.fields")
        cols = [(fld["name"], fld["type"]) for fld in fields]
        tables.append((name, cols))
    return tables


def generate(dp_path: Path = DATAPACKAGE) -> str:
    tables = _load_tables(dp_path)

    out: list[str] = []
    out.append("// AUTO-GENERATED — DO NOT EDIT BY HAND.")
    out.append("//")
    out.append("// Source of truth: data/climate-si/datapackage.yaml (D-18, T-5.3a/b).")
    out.append("// Regenerate with:")
    out.append(f"//   {REGEN_CMD}")
    out.append("// Generator: data/climate-si/sources/generate_frontend_schema.py")
    out.append("//")
    out.append("// Per datasette table this file declares a row interface (Ds<Table>), a")
    out.append("// column tuple (<TABLE>_COLUMNS, `as const`) and a column union (<Table>Col).")
    out.append("// api.ts / types.ts consume these so a datapackage column rename that is not")
    out.append("// mirrored into the frontend becomes a `yarn typecheck` error, not a live")
    out.append("// page break. A pytest freshness gate keeps this file in sync with datapackage.")
    out.append("//")
    out.append(f"// `daily_percentiles` is declared in datapackage but fetched zero times, so it")
    out.append("// is intentionally excluded here (exclusion from the generator, NOT removal from")
    out.append("// the datasette — D-18).")
    out.append("")

    for table, cols in tables:
        pascal = _pascal(table)
        upper = table.upper()

        out.append(f"export interface Ds{pascal} {{")
        for col, ftype in cols:
            ts = TS_TYPE.get(ftype)
            if ts is None:
                raise ValueError(
                    f"{table}.{col}: unmapped datapackage field type {ftype!r}")
            out.append(f"  {col}: {ts};")
        out.append("}")
        out.append("")

        out.append(f"export const {upper}_COLUMNS = [")
        for col, _ in cols:
            out.append(f'  "{col}",')
        out.append("] as const;")
        out.append(f"export type {pascal}Col = (typeof {upper}_COLUMNS)[number];")
        out.append("")

    # Drop the trailing blank line left by the per-table loop so the file ends with
    # exactly one newline.
    while out and out[-1] == "":
        out.pop()
    return "\n".join(out) + "\n"


def main(argv: list[str]) -> int:
    content = generate()
    if "--stdout" in argv:
        sys.stdout.write(content)
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(content)
    sys.stderr.write(f"wrote {OUTPUT}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
