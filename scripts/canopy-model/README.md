# HighResCanopyHeight runner

Reproducible path to derive a canopy height GeoTIFF for `pnpm --filter @shadeway/pipeline build:pilot -- --canopy path.tif`.

## Model

[facebookresearch/HighResCanopyHeight](https://github.com/facebookresearch/HighResCanopyHeight) (Apache-2.0). Clone that repository beside this repo or set `HIGHRESCANOPYHOME` to its path.

## Inputs you must supply

- A GeoTIFF of imagery covering the pilot bounding box. The imagery license must allow publishing derived canopy heights (check your provider).
- Model weights from the HighResCanopyHeight release. Download manually; they are not stored in this repo.

## Output

A single-band float GeoTIFF of canopy height in meters, georeferenced like the input imagery. Pass it to the pipeline:

```bash
pnpm --filter @shadeway/pipeline build:pilot -- --canopy /path/to/canopy.tif
```

## Run

```bash
python scripts/canopy-model/run_canopy.py \
  --imagery /path/to/imagery.tif \
  --output /path/to/canopy-height.tif \
  --bbox 121.0417 14.5415 121.0603 14.5628
```

`run_canopy.py` expects `HIGHRESCANOPYHOME` (or a clone at `../HighResCanopyHeight`), loads the SSL checkpoint directly, tiles the RGB GeoTIFF in 256×256 windows, and writes a float32 CHM. It does not download imagery or weights. Requires Python `rasterio`, `numpy`, `torch`, and `torchvision`.

## Caveats

- Inference is GPU-heavy and is not run in CI.
- Derived heights are only as good as the imagery date and the model; the app label states they are not field-checked.
