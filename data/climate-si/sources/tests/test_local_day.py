"""T-4.3b regression test — the one-day date shift (D-4 timezone re-fetch).

This bug survived every structural/Pandera validator because a uniformly
shifted daily series is still perfectly valid in *shape*: contiguous dates,
right row count, in-range values. Only a physical date-alignment check catches
it. This test IS that check, pinned to a known epoch and a known offset for
both CET (+1) and CEST (+2).

The core assertion: the epoch Open-Meteo hands back for a given LOCAL midnight
must be labelled with that local calendar day — not the day before. Each case
also asserts, inline, that the OLD logic (no UTC-offset shift, i.e.
utc_offset_seconds=0) mislabels the row one day early — so the test would fail
against the pre-fix code and documents exactly what regressed.
"""

import datetime

import pandas as pd

from local_day import local_daily_dates

DAY = 86400  # seconds per daily step


def _epoch_of_utc(instant_iso):
    """Unix epoch (int seconds) of a UTC ISO instant."""
    return int(pd.Timestamp(instant_iso).value // 1_000_000_000)


def test_cest_local_midnight_labelled_correct_day():
    # Local midnight 2013-08-03 00:00 in Europe/Ljubljana (CEST, +2h) is
    # 2013-08-02 22:00:00 UTC. That is the epoch Open-Meteo returns as Time().
    start = _epoch_of_utc("2013-08-02T22:00:00Z")
    offset = 2 * 3600  # CEST

    dates = local_daily_dates(start, start + DAY, DAY, offset)
    assert list(dates) == [datetime.date(2013, 8, 3)]

    # The pre-fix logic omitted the offset — that read the UTC calendar day of
    # 22:00 the previous evening, i.e. 2013-08-02: one day EARLY.
    old = local_daily_dates(start, start + DAY, DAY, 0)
    assert list(old) == [datetime.date(2013, 8, 2)]
    assert list(old) != list(dates)


def test_cet_local_midnight_labelled_correct_day():
    # Local midnight 2013-01-15 00:00 in Europe/Ljubljana (CET, +1h) is
    # 2013-01-14 23:00:00 UTC.
    start = _epoch_of_utc("2013-01-14T23:00:00Z")
    offset = 1 * 3600  # CET

    dates = local_daily_dates(start, start + DAY, DAY, offset)
    assert list(dates) == [datetime.date(2013, 1, 15)]

    # Pre-fix: 23:00 UTC of the evening before → 2013-01-14, one day early.
    old = local_daily_dates(start, start + DAY, DAY, 0)
    assert list(old) == [datetime.date(2013, 1, 14)]
    assert list(old) != list(dates)


def test_multiday_range_all_labels_shift_together():
    # A 3-day CEST window: every interior label must be the correct local day,
    # not just the first — the shift was uniform across the whole series.
    start = _epoch_of_utc("2013-08-02T22:00:00Z")
    offset = 2 * 3600
    dates = local_daily_dates(start, start + 3 * DAY, DAY, offset)
    assert list(dates) == [
        datetime.date(2013, 8, 3),
        datetime.date(2013, 8, 4),
        datetime.date(2013, 8, 5),
    ]
