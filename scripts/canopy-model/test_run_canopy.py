#!/usr/bin/env python3
import subprocess
import tempfile
import unittest
from pathlib import Path

import numpy as np


class RunCanopyStubTest(unittest.TestCase):
    def test_stub_writes_georeferenced_chm(self) -> None:
        try:
            import rasterio
        except ImportError:
            self.skipTest("rasterio not installed")
        from rasterio.crs import CRS
        from rasterio.transform import from_origin

        script = Path(__file__).with_name("run_canopy.py")
        with tempfile.TemporaryDirectory() as tmp:
            imagery = Path(tmp) / "rgb.tif"
            output = Path(tmp) / "chm.tif"
            transform = from_origin(500000, 1500000, 1, 1)
            profile = {
                "driver": "GTiff",
                "height": 64,
                "width": 64,
                "count": 3,
                "dtype": "uint8",
                "crs": CRS.from_epsg(3857),
                "transform": transform,
            }
            rgb = np.zeros((3, 64, 64), dtype=np.uint8)
            with rasterio.open(imagery, "w", **profile) as dst:
                dst.write(rgb)

            result = subprocess.run(
                [
                    "python3",
                    str(script),
                    "--imagery",
                    str(imagery),
                    "--output",
                    str(output),
                    "--stub-height",
                    "4.5",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            with rasterio.open(output) as chm:
                self.assertEqual(chm.crs.to_epsg(), 3857)
                band = chm.read(1)
                self.assertGreater(float(band[32, 32]), 4)
                self.assertLess(float(band[32, 32]), 5)


if __name__ == "__main__":
    unittest.main()
