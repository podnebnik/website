# Coastal flood-map generator

Regenerates the sea-level flood overlays and statistics used by the Koper
sea-level widget (`code/ali-je-vroce-era5/charts/SeaLevelWidget.tsx`):

- `public/data/flood/flood-NNNcm.png` — 25 RGBA flood masks (10–250 cm, step 10)
- `public/data/flood-stats.json` — pixel / hectare / building counts per level

These assets were originally produced on 2026-06-13 by `mk_floodmap.py` in the
separate `MK_ERA5` project and imported into this repo as binary blobs (commit
`9af5825`). The scripts here reproduce them from scratch.

## Pipeline

```
extract_buildings.py  ──▶  buildings.json  ──┐
                                             ├─▶  mk_floodmap.py  ──▶  flood PNGs + flood-stats.json
AWS Terrarium DEM tiles ─────────────────────┘
```

1. **Elevation** — `mk_floodmap.py` downloads AWS Terrarium DEM tiles
   (`elevation-tiles-prod`, zoom 13, public/no-auth), decodes them to metres,
   and crops to the bbox `B` (13.535–13.795 E, 45.425–45.605 N).
2. **Flood model** — a BFS flood-fill from the map edges marks every cell below
   each water level that is sea-connected; the baseline sea (0 cm) is subtracted
   so each mask shows only *newly* flooded land. Masks are Gaussian-blurred and
   resized to 860×500 RGBA PNGs.
3. **Buildings** — `extract_buildings.py` fetches OSM building centroids
   (Overpass API) for the same bbox into `buildings.json`; `mk_floodmap.py`
   counts how many fall inside each flood zone.
4. **Area** — hectares per pixel via a mid-latitude cosine-corrected bbox.

## Usage

```bash
cd scripts/floodmap
pip install numpy requests pillow          # deps

python3 extract_buildings.py               # (re)build buildings.json from OSM
python3 mk_floodmap.py                      # 10–250 cm  -> PNGs + stats
python3 mk_floodmap.py --no-png             # rebuild stats only
python3 mk_floodmap.py --max 200 --step 10  # custom range
```

`buildings.json` is committed so the counts are reproducible without hitting
Overpass; re-run `extract_buildings.py` only to refresh from current OSM data.

## Provenance / caveats

- **DEM source is Terrarium (SRTM-derived global DEM), not Slovenian LIDAR/DMR.**
  The published article prose (`dvig-morja/index.md` in the legacy `podnebnik`
  repo) describes the visualisation as LIDAR-based. If you re-derive these masks
  from national LIDAR/DMR, update the note at the top of `mk_floodmap.py`.
- The IPCC AR6 per-SSP projection tables and the per-cm impact factors
  (`ha 20.77`, `build 14.13`, `ppl 63.3`) live in `SeaLevelWidget.tsx`, ported
  from `MK_ERA5/static/js/sea-level.js`. They are **not** produced by this
  script — they are editorial constants sourced from IPCC AR6 (Fox-Kemper et
  al. 2021), localised for the northern Adriatic (Inštitut za vodarstvo / DRSV
  2023) and the NASA AR6 sea-level projection tool.
