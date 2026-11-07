#!/usr/bin/env python3
"""Thin wrapper around Meta HighResCanopyHeight. Does not download imagery or weights."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Run HighResCanopyHeight on a GeoTIFF and write a CHM GeoTIFF.")
    parser.add_argument("--imagery", required=True, help="Input imagery GeoTIFF")
    parser.add_argument("--output", required=True, help="Output canopy height GeoTIFF")
    parser.add_argument(
        "--bbox",
        nargs=4,
        type=float,
        metavar=("WEST", "SOUTH", "EAST", "NORTH"),
        help="Optional WGS84 clip before inference",
    )
    args = parser.parse_args()

    home = os.environ.get("HIGHRESCANOPYHOME")
    if not home:
        sibling = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "HighResCanopyHeight"))
        home = sibling if os.path.isdir(sibling) else None
    if not home or not os.path.isdir(home):
        print(
            "Set HIGHRESCANOPYHOME to a HighResCanopyHeight clone "
            "(https://github.com/facebookresearch/HighResCanopyHeight).",
            file=sys.stderr,
        )
        return 2

    infer = os.path.join(home, "inference.py")
    if not os.path.isfile(infer):
        print(f"Missing {infer}. Follow the upstream README to install weights.", file=sys.stderr)
        return 2

    cmd = [sys.executable, infer, "--input", args.imagery, "--output", args.output]
    if args.bbox is not None:
        cmd.extend(["--bbox", *[str(value) for value in args.bbox]])
    subprocess.check_call(cmd, cwd=home)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
