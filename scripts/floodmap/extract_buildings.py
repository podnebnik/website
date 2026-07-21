#!/usr/bin/env python3
"""extract_buildings.py — Fetch OSM building centroids for the flood bbox.

Produces buildings.json, the input consumed by mk_floodmap.py for per-level
building counts. Each entry is a building centroid:

    [{"lat": 45.5992, "lon": 13.7404, "type": "yes"}, ...]

Source: OpenStreetMap via the Overpass API (no auth). The bounding box matches
`B` in mk_floodmap.py (northern Adriatic / Slovenian coast: Koper–Sečovlje).

Usage:
    python3 extract_buildings.py                    # -> buildings.json
    python3 extract_buildings.py --out buildings.json
"""

import argparse, json, os, sys, time

import requests

# Bounding box — keep in sync with B in mk_floodmap.py
B = dict(w=13.535, e=13.795, s=45.425, n=45.605)

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

OUT_DEFAULT = os.path.join(os.path.dirname(__file__), "buildings.json")


def build_query():
    bbox = f'{B["s"]},{B["w"]},{B["n"]},{B["e"]}'
    # nwr = nodes, ways, relations tagged building=*; `out center` gives a
    # single representative lat/lon (centroid) for ways and relations.
    return f"""
    [out:json][timeout:180];
    (
      nwr["building"]({bbox});
    );
    out center tags;
    """


def fetch(query):
    last_err = None
    for url in OVERPASS_URLS:
        try:
            print(f"Querying {url} …", flush=True)
            r = requests.post(url, data={"data": query}, timeout=200,
                              headers={"User-Agent": "podnebnik.si/floodmap-1.0"})
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001 — try next mirror
            print(f"  failed: {e}", flush=True)
            last_err = e
            time.sleep(2)
    raise SystemExit(f"All Overpass mirrors failed: {last_err}")


def to_centroids(payload):
    out = []
    for el in payload.get("elements", []):
        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:  # way / relation -> use `center`
            c = el.get("center") or {}
            lat, lon = c.get("lat"), c.get("lon")
        if lat is None or lon is None:
            continue
        btype = (el.get("tags") or {}).get("building", "yes")
        out.append({"lat": lat, "lon": lon, "type": btype})
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=OUT_DEFAULT)
    args = p.parse_args()

    payload = fetch(build_query())
    centroids = to_centroids(payload)
    if not centroids:
        sys.exit("No buildings returned — aborting (refusing to overwrite with empty set)")

    with open(args.out, "w") as f:
        json.dump(centroids, f, separators=(",", ":"))
    print(f"{len(centroids):,} building centroids → {args.out}", flush=True)


if __name__ == "__main__":
    main()
