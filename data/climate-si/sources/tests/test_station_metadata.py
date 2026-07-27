"""T-5.7e — station-metadata completeness guard.

si.yaml is the single source for the station list + geographic fields; the four
ARSO/Vremenar identity columns stay in precompute's STATION_META /
ERA5_TO_STATION_ID dicts by design (D-9 split). `assert_station_metadata_complete`
closes the one silent-drift path left by that split: a si.yaml station missing a
STATION_META entry would otherwise ship a fabricated official_name/name_locative.
"""

import pytest

import precompute_datasette as pc


def test_current_config_is_complete():
    # The shipped si.yaml + dicts must pass — this is the invariant build_stations
    # (and therefore the image build) relies on.
    pc.assert_station_metadata_complete()


def test_every_yaml_station_has_station_meta():
    # Structural restatement of the guard's core: no display-name fallback path.
    names = {loc["name"] for loc in pc.CONFIG["stations"]}
    assert names <= set(pc.STATION_META)


def test_station_id_map_is_a_subset_not_equality():
    # ERA5-only stations legitimately carry no station_id, so the map is a strict
    # subset of the station list — never all 18.
    names = {loc["name"] for loc in pc.CONFIG["stations"]}
    assert set(pc.ERA5_TO_STATION_ID) <= names
    assert set(pc.ERA5_TO_STATION_ID) != names


def test_missing_station_meta_raises(monkeypatch):
    trimmed = dict(pc.STATION_META)
    trimmed.pop("Kredarica")
    monkeypatch.setattr(pc, "STATION_META", trimmed)
    with pytest.raises(ValueError, match=r"STATION_META is missing.*Kredarica"):
        pc.assert_station_metadata_complete()


def test_orphan_station_meta_raises(monkeypatch):
    extra = dict(pc.STATION_META)
    extra["Atlantis"] = {"official_name": "Atlantis", "name_locative": "v Atlantidi", "xml_id": None}
    monkeypatch.setattr(pc, "STATION_META", extra)
    with pytest.raises(ValueError, match=r"STATION_META has entries for unknown.*Atlantis"):
        pc.assert_station_metadata_complete()


def test_orphan_station_id_raises(monkeypatch):
    extra = dict(pc.ERA5_TO_STATION_ID)
    extra["Atlantis"] = 9999
    monkeypatch.setattr(pc, "ERA5_TO_STATION_ID", extra)
    with pytest.raises(ValueError, match=r"ERA5_TO_STATION_ID maps unknown.*Atlantis"):
        pc.assert_station_metadata_complete()
