#!/usr/bin/env python3
"""mk_floodmap.py — Generate coastal flood PNG masks + per-level statistics.

Elevation: AWS Terrarium tiles (public, no auth) — global SRTM-derived DEM.
Buildings: OpenStreetMap building centroids (see extract_buildings.py).

Outputs (relative to repo root):
  public/data/flood/flood-NNNcm.png   — one RGBA mask per level
  public/data/flood-stats.json        — ha and building counts per level

Usage:
    python3 mk_floodmap.py                 # 10–250 cm, step 10
    python3 mk_floodmap.py --max 200
    python3 mk_floodmap.py --no-png        # rebuild stats only (skip PNG generation)

NOTE ON DATA SOURCE: this pipeline uses the public AWS Terrarium global DEM
(SRTM-derived), NOT Slovenian LIDAR/DMR. The published article prose describes
the visualisation as LIDAR-based; the actual raster used here is Terrarium.
If you re-derive these assets from national LIDAR/DMR, update this note.
"""

import math, io, time, argparse, os, json
from collections import deque

import numpy as np
import requests
from PIL import Image, ImageFilter

# ── Config ────────────────────────────────────────────────────────────────────

B    = dict(w=13.535, e=13.795, s=45.425, n=45.605)
ZOOM = 13
OUT_W, OUT_H = 860, 500

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR   = os.path.join(REPO_ROOT, "public", "data", "flood")
STATS_OUT = os.path.join(REPO_ROOT, "public", "data", "flood-stats.json")
TILE_URL  = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

BUILDINGS_JSON = os.path.join(os.path.dirname(__file__), "buildings.json")

# ── Tile helpers ──────────────────────────────────────────────────────────────

def latlon_to_tile(lat, lon, z):
    n = 2 ** z
    return (
        int((lon + 180) / 360 * n),
        int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n),
    )

def tile_nw_latlon(tx, ty, z):
    n = 2 ** z
    lon = tx / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / n))))
    return lat, lon

def fetch_tile(z, tx, ty, sess):
    r = sess.get(TILE_URL.format(z=z, x=tx, y=ty), timeout=15)
    r.raise_for_status()
    arr = np.array(Image.open(io.BytesIO(r.content)).convert("RGB"), dtype=np.float32)
    return arr[:, :, 0] * 256 + arr[:, :, 1] + arr[:, :, 2] / 256 - 32768


# ── Build + crop elevation grid ───────────────────────────────────────────────

def build_grid(zoom):
    tx_min, ty_max = latlon_to_tile(B["s"], B["w"], zoom)
    tx_max, ty_min = latlon_to_tile(B["n"], B["e"], zoom)
    n_cols, n_rows = tx_max - tx_min + 1, ty_max - ty_min + 1
    print(f"Tiles: x {tx_min}–{tx_max}, y {ty_min}–{ty_max}  ({n_cols}×{n_rows})", flush=True)

    sess = requests.Session()
    sess.headers["User-Agent"] = "podnebnik.si/floodmap-1.0"
    grid = np.zeros((n_rows * 256, n_cols * 256), dtype=np.float32)

    for row, ty in enumerate(range(ty_min, ty_max + 1)):
        for col, tx in enumerate(range(tx_min, tx_max + 1)):
            print(f"  z={zoom} x={tx} y={ty}", flush=True)
            grid[row*256:(row+1)*256, col*256:(col+1)*256] = fetch_tile(zoom, tx, ty, sess)
            time.sleep(0.04)

    lat_n, lon_w = tile_nw_latlon(tx_min,     ty_min,     zoom)
    lat_s, lon_e = tile_nw_latlon(tx_max + 1, ty_max + 1, zoom)
    H_f, W_f = grid.shape

    r_n = max(0, int((lat_n - B["n"]) / (lat_n - lat_s) * H_f))
    r_s = min(H_f, int((lat_n - B["s"]) / (lat_n - lat_s) * H_f))
    c_w = max(0, int((B["w"] - lon_w) / (lon_e - lon_w) * W_f))
    c_e = min(W_f, int((B["e"] - lon_w) / (lon_e - lon_w) * W_f))

    elev = grid[r_n:r_s, c_w:c_e]
    print(f"Cropped: {elev.shape[0]}×{elev.shape[1]} px  "
          f"{elev.min():.1f}–{elev.max():.1f} m", flush=True)
    return elev


# ── BFS flood fill ────────────────────────────────────────────────────────────

def sea_flood(elev, water_m, seed_m=0.0):
    below  = elev < water_m
    at_sea = elev <= seed_m
    H, W   = elev.shape
    vis    = np.zeros((H, W), dtype=bool)
    q      = deque()

    def seed(y, x):
        if at_sea[y, x] and below[y, x] and not vis[y, x]:
            vis[y, x] = True; q.append((y, x))

    for y in range(H): seed(y, 0)
    for x in range(W): seed(H - 1, x)

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < H and 0 <= nx < W and below[ny,nx] and not vis[ny,nx]:
                vis[ny, nx] = True; q.append((ny, nx))

    return vis


# ── Save PNG mask ─────────────────────────────────────────────────────────────

def mask_to_png(mask, out_path):
    H, W = mask.shape
    raw = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    blur_r = max(1, int(min(H / OUT_H, W / OUT_W) * 2))
    raw = raw.filter(ImageFilter.GaussianBlur(radius=blur_r))
    resized = raw.resize((OUT_W, OUT_H), Image.LANCZOS)
    alpha = np.array(resized, dtype=np.uint8)
    rgba = np.zeros((OUT_H, OUT_W, 4), dtype=np.uint8)
    rgba[alpha > 0, :3] = 255
    rgba[:, :, 3] = alpha
    Image.fromarray(rgba, "RGBA").save(out_path, "PNG", optimize=True)
    print(f"  PNG: {os.path.getsize(out_path)//1024} KB", flush=True)


# ── OSM buildings (local extract) ─────────────────────────────────────────────

def fetch_buildings():
    """
    Load building centroids from the pre-extracted buildings.json.
    Regenerate that file with:  python3 extract_buildings.py
    """
    if not os.path.exists(BUILDINGS_JSON):
        print(f"  {BUILDINGS_JSON} not found — skipping building count "
              f"(run extract_buildings.py first)", flush=True)
        return []
    with open(BUILDINGS_JSON) as f:
        data = json.load(f)
    buildings = [(b["lat"], b["lon"]) for b in data]
    print(f"  {len(buildings):,} buildings loaded from {BUILDINGS_JSON}", flush=True)
    return buildings


def buildings_to_pixels(buildings, elev_shape):
    """
    Convert building (lat, lon) centroids to (row, col) pixel coordinates
    in the cropped elevation grid.
    """
    H, W = elev_shape
    pixels = []
    for lat, lon in buildings:
        r = int((B["n"] - lat) / (B["n"] - B["s"]) * H)
        c = int((lon - B["w"]) / (B["e"] - B["w"]) * W)
        if 0 <= r < H and 0 <= c < W:
            pixels.append((r, c))
    return pixels


# ── Area calculation ──────────────────────────────────────────────────────────

def bbox_ha_per_pixel(elev_shape):
    """
    Area in hectares represented by one pixel in the elevation grid.
    Uses mid-latitude cosine correction for longitude.
    """
    lat_mid = (B["n"] + B["s"]) / 2
    km_per_deg_lat = 111.32
    km_per_deg_lon = 111.32 * math.cos(math.radians(lat_mid))
    H, W = elev_shape
    pixel_km2 = ((B["n"] - B["s"]) / H * km_per_deg_lat) * \
                ((B["e"] - B["w"]) / W * km_per_deg_lon)
    return pixel_km2 * 100   # km² → ha


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max",    type=int, default=250)
    p.add_argument("--step",   type=int, default=10)
    p.add_argument("--zoom",   type=int, default=ZOOM)
    p.add_argument("--no-png", action="store_true", help="skip PNG generation (stats only)")
    args = p.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    print("Building elevation grid…", flush=True)
    elev = build_grid(args.zoom)

    ha_per_px = bbox_ha_per_pixel(elev.shape)
    print(f"Grid resolution: {ha_per_px:.4f} ha/pixel", flush=True)

    print("Computing baseline sea…", flush=True)
    baseline = sea_flood(elev, 0.01, seed_m=0.0)
    print(f"  {baseline.sum():,} sea pixels", flush=True)

    # Fetch buildings and map to grid pixels
    buildings_latlon = fetch_buildings()
    bld_pixels = buildings_to_pixels(buildings_latlon, elev.shape)
    bld_rows = np.array([r for r, c in bld_pixels], dtype=np.int32)
    bld_cols = np.array([c for r, c in bld_pixels], dtype=np.int32)
    print(f"  {len(bld_pixels):,} buildings mapped to grid", flush=True)

    levels = list(range(args.step, args.max + 1, args.step))
    stats = {
        "ha_per_px": round(ha_per_px, 5),
        "building_total": len(bld_pixels),
        "levels": {},
    }

    for level_cm in levels:
        water_m = level_cm / 100.0
        print(f"Level {level_cm} cm…", flush=True)

        flooded  = sea_flood(elev, water_m, seed_m=0.0)
        new_land = flooded & ~baseline

        n_px = int(new_land.sum())
        ha   = round(n_px * ha_per_px, 1)

        # Count buildings whose centroid pixel is in the flood zone
        if len(bld_pixels) > 0:
            in_flood = new_land[bld_rows, bld_cols]
            n_bld = int(in_flood.sum())
        else:
            n_bld = 0

        print(f"  {n_px:,} px  {ha:.0f} ha  {n_bld} buildings", flush=True)
        stats["levels"][str(level_cm)] = {"px": n_px, "ha": ha, "buildings": n_bld}

        if not args.no_png:
            fname = os.path.join(OUT_DIR, f"flood-{level_cm:03d}cm.png")
            mask_to_png(new_land, fname)

    with open(STATS_OUT, "w") as f:
        json.dump(stats, f, separators=(",", ":"))
    print(f"\nStats → {STATS_OUT}", flush=True)
    if not args.no_png:
        print(f"PNGs  → {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
