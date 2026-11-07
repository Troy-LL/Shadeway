#!/usr/bin/env python3
"""Tile HighResCanopyHeight over a GeoTIFF and write a georeferenced CHM GeoTIFF in EPSG:3857."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

TILE = 256
OUTPUT_EPSG = 3857


def main() -> int:
    parser = argparse.ArgumentParser(description="Predict canopy height from RGB GeoTIFF tiles.")
    parser.add_argument("--imagery", required=True, help="Input RGB GeoTIFF")
    parser.add_argument("--output", required=True, help="Output float32 CHM GeoTIFF (EPSG:3857)")
    parser.add_argument(
        "--bbox",
        nargs=4,
        type=float,
        metavar=("WEST", "SOUTH", "EAST", "NORTH"),
        help="Optional WGS84 clip (west south east north)",
    )
    parser.add_argument(
        "--checkpoint",
        default="saved_checkpoints/SSLhuge_satellite.pth",
        help="Model weights inside HIGHRESCANOPYHOME",
    )
    parser.add_argument("--device", default="cpu", help="torch device (cpu or cuda:0)")
    parser.add_argument(
        "--stub-height",
        type=float,
        help="Write a constant CHM in meters (no torch) for tests",
    )
    args = parser.parse_args()

    try:
        import numpy as np
        import rasterio
        from rasterio.crs import CRS
        from rasterio.warp import Resampling, calculate_default_transform, reproject, transform_bounds
        from rasterio.windows import Window, from_bounds as window_from_bounds
    except ImportError as exc:
        print(f"Missing dependency: {exc}. Install rasterio and numpy.", file=sys.stderr)
        return 2

    output_crs = CRS.from_epsg(OUTPUT_EPSG)

    if args.stub_height is not None:
        from rasterio.warp import Resampling, calculate_default_transform, reproject

        return write_stub(
            args,
            output_crs,
            np,
            rasterio,
            transform_bounds,
            window_from_bounds,
            reproject,
            Resampling,
            calculate_default_transform,
        )

    home = resolve_home()
    if home is None:
        return 2

    try:
        import torch
        import torchvision.transforms as T
    except ImportError as exc:
        print(f"Missing dependency: {exc}. Install torch and torchvision.", file=sys.stderr)
        return 2

    sys.path.insert(0, str(home))
    from inference import SSLModule  # type: ignore

    checkpoint = home / args.checkpoint
    if not checkpoint.is_file():
        print(f"Missing weights {checkpoint}. Download per upstream README.", file=sys.stderr)
        return 2

    norm = T.Normalize((0.420, 0.411, 0.296), (0.213, 0.156, 0.143))
    model = SSLModule(ssl_path=str(checkpoint))
    model.to(args.device)
    model.eval()

    with rasterio.open(args.imagery) as src:
        if args.bbox is not None:
            west, south, east, north = args.bbox
            bounds = transform_bounds("EPSG:4326", src.crs, west, south, east, north, densify_pts=21)
            win = window_from_bounds(*bounds, transform=src.transform)
            win = win.intersection(Window(0, 0, src.width, src.height))
        else:
            win = Window(0, 0, src.width, src.height)

        data = src.read(indexes=(1, 2, 3), window=win, boundless=True, fill_value=0).astype("float32")
        if data.shape[0] != 3:
            raise SystemExit("imagery must have at least three RGB bands")
        height, width = data.shape[1], data.shape[2]
        sub_transform = rasterio.windows.transform(win, src.transform)
        crs = src.crs

        acc = np.zeros((height, width), dtype=np.float64)
        weight = np.zeros((height, width), dtype=np.float64)

        for y0 in range(0, height, TILE):
            for x0 in range(0, width, TILE):
                patch_h = min(TILE, height - y0)
                patch_w = min(TILE, width - x0)
                patch = data[:, y0 : y0 + patch_h, x0 : x0 + patch_w]
                pad = np.zeros((3, TILE, TILE), dtype=np.float32)
                pad[:, :patch_h, :patch_w] = patch / 255.0
                tensor = torch.from_numpy(pad).unsqueeze(0).to(args.device)
                with torch.no_grad():
                    pred = model(norm(tensor)).relu().cpu().numpy()[0, 0, :patch_h, :patch_w]
                acc[y0 : y0 + patch_h, x0 : x0 + patch_w] += pred
                weight[y0 : y0 + patch_h, x0 : x0 + patch_w] += 1.0

    chm = np.divide(acc, np.maximum(weight, 1e-6), dtype=np.float32)
    chm = np.clip(chm, 0, None)
    write_reprojected(chm, sub_transform, crs, output_crs, args.output, reproject, Resampling, calculate_default_transform, np)
    return 0


def write_stub(
    args: argparse.Namespace,
    output_crs,
    np,
    rasterio,
    transform_bounds,
    window_from_bounds,
    reproject,
    Resampling,
    calculate_default_transform,
) -> int:
    from rasterio.windows import Window

    with rasterio.open(args.imagery) as src:
        if args.bbox is not None:
            west, south, east, north = args.bbox
            bounds = transform_bounds("EPSG:4326", src.crs, west, south, east, north, densify_pts=21)
            win = window_from_bounds(*bounds, transform=src.transform)
            win = win.intersection(Window(0, 0, src.width, src.height))
        else:
            win = Window(0, 0, src.width, src.height)
        height, width = (int(win.height), int(win.width))
        sub_transform = rasterio.windows.transform(win, src.transform)
        chm = np.full((height, width), float(args.stub_height), dtype=np.float32)
        write_reprojected(
            chm, sub_transform, src.crs, output_crs, args.output, reproject, Resampling, calculate_default_transform, np
        )
    return 0


def write_reprojected(chm, src_transform, src_crs, dst_crs, path, reproject, Resampling, calculate_default_transform, np):
    import rasterio.transform

    bounds = rasterio.transform.array_bounds(chm.shape[0], chm.shape[1], src_transform)
    dst_transform, dst_width, dst_height = calculate_default_transform(src_crs, dst_crs, chm.shape[1], chm.shape[0], *bounds)
    out = np.zeros((dst_height, dst_width), dtype=np.float32)
    reproject(
        chm,
        out,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        resampling=Resampling.bilinear,
    )
    profile = {
        "driver": "GTiff",
        "height": out.shape[0],
        "width": out.shape[1],
        "count": 1,
        "dtype": "float32",
        "transform": dst_transform,
        "crs": dst_crs,
        "compress": "deflate",
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(out, 1)


def resolve_home() -> Path | None:
    raw = os.environ.get("HIGHRESCANOPYHOME")
    if raw:
        home = Path(raw)
        if home.is_dir():
            return home
    sibling = Path(__file__).resolve().parents[2] / "HighResCanopyHeight"
    if sibling.is_dir():
        return sibling
    print(
        "Set HIGHRESCANOPYHOME to a HighResCanopyHeight clone "
        "(https://github.com/facebookresearch/HighResCanopyHeight).",
        file=sys.stderr,
    )
    return None


if __name__ == "__main__":
    raise SystemExit(main())
