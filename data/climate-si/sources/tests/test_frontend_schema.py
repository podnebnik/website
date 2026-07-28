"""Freshness gate for the codegen'd frontend datasette contract (T-5.3b, D-18 Half 2).

`generate_frontend_schema.py` emits code/ali-je-vroce-era5/generated/datasette-schema.ts
from datapackage.yaml. This test is the CI freshness assert the ticket calls for:
`generate && git diff --exit-code`, expressed as "the committed file equals the
generator's current output". It rides the existing pytest gate rather than adding a
workflow. If datapackage.yaml changes and the generated file is not regenerated, this
fails — naming the regeneration command."""

import yaml  # noqa: E402

from generate_frontend_schema import (  # noqa: E402
    DATAPACKAGE,
    EXCLUDED_TABLES,
    OUTPUT,
    REGEN_CMD,
    generate,
)


def test_generated_schema_matches_datapackage():
    """The committed .ts equals a fresh generation. This is the drift gate."""
    assert OUTPUT.exists(), (
        f"{OUTPUT} is missing — regenerate with:\n    {REGEN_CMD}")
    expected = generate()
    actual = OUTPUT.read_text()
    assert actual == expected, (
        "code/ali-je-vroce-era5/generated/datasette-schema.ts is STALE relative to "
        f"datapackage.yaml.\nRegenerate with:\n    {REGEN_CMD}")


def test_every_non_excluded_table_is_emitted():
    """Every datapackage resource except the excluded set gets a row interface, so a
    table added to datapackage cannot silently miss the frontend contract."""
    with open(DATAPACKAGE) as f:
        dp = yaml.safe_load(f)
    content = generate()
    for res in dp.get("resources", []):
        table = res["name"]
        pascal = "".join(p.capitalize() for p in table.split("_"))
        marker = f"export interface Ds{pascal} {{"
        if table in EXCLUDED_TABLES:
            assert marker not in content, (
                f"{table} is excluded but still appears in the generated contract")
        else:
            assert marker in content, f"{table} missing from the generated contract"


def test_daily_percentiles_is_excluded():
    """daily_percentiles is declared in datapackage but fetched zero times, so it is
    excluded from the generator (NOT removed from the datasette — D-18)."""
    assert "daily_percentiles" in EXCLUDED_TABLES
    assert "DailyPercentiles" not in generate()
