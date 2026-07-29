"""Local-day date labelling for Open-Meteo daily responses (D-4, T-4.3b).

This is the single site that decides which calendar day each daily aggregate
belongs to.

When a timezone is requested (Europe/Ljubljana, per D-4), Open-Meteo returns
``daily.Time()`` / ``daily.TimeEnd()`` as the Unix epochs of each *local*
midnight. Interpreting those epochs directly as UTC labels every row one
calendar day early — local midnight is 22:00 (CEST) or 23:00 (CET) of the
*previous* day in UTC, so ``.date`` reads the wrong calendar day. Shifting each
epoch by the response's UTC offset makes the wall-clock local, so ``.date``
reads the intended local calendar day.

Under ``timezone=UTC`` the offset is 0 and this reduces to the original
behaviour, which is why the bug only surfaced with the D-4 change.
"""

import pandas as pd


def local_daily_dates(time_start, time_end, interval, utc_offset_seconds):
    """Return the local calendar dates for an Open-Meteo daily response.

    Parameters
    ----------
    time_start : int
        ``daily.Time()`` — Unix epoch (s) of the first local midnight.
    time_end : int
        ``daily.TimeEnd()`` — Unix epoch (s) just past the last local midnight.
    interval : int
        ``daily.Interval()`` — seconds per step (86400 for daily data).
    utc_offset_seconds : int
        ``response.UtcOffsetSeconds()`` — +3600 for CET, +7200 for CEST.

    Returns
    -------
    numpy.ndarray of datetime.date
        One entry per day, labelled by the local calendar day.
    """
    return pd.date_range(
        start=pd.to_datetime(time_start + utc_offset_seconds, unit="s", utc=True),
        end=pd.to_datetime(time_end + utc_offset_seconds, unit="s", utc=True),
        freq=pd.Timedelta(seconds=interval),
        inclusive="left",
    ).date
