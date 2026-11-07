import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeArrayBuffer } from "geotiff";
import { expect, test } from "vitest";
import {
  CANOPY_HEIGHT_THRESHOLD_M,
  countCanopyPixels,
  crownsFromGrid,
  loadCanopyGrid,
} from "./canopy.js";
import { toWebMercator } from "./project.js";

test("canopy count keeps pixels whose centers sit inside the box and are at least 3 m", () => {
  const counts = countCanopyPixels({
    originX: 0,
    originY: 3,
    pixelSizeX: 1,
    pixelSizeY: 1,
    width: 3,
    height: 3,
    values: new Uint8Array([
      0, 3, 9,
      2, 4, 1,
      8, 3, 0,
    ]),
    box: { minX: 0.5, minY: 0.5, maxX: 2.5, maxY: 2.5 },
  });
  expect(counts).toEqual({ pixels: 4, atLeast3m: 3 });
});

test("vectorizes a synthetic canopy raster above the height threshold", () => {
  const origin = toWebMercator(121.05, 14.552);
  const grid = {
    originX: origin.x,
    originY: origin.y + 6,
    pixelSizeX: 1,
    pixelSizeY: 1,
    width: 8,
    height: 8,
    values: new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 4, 4, 4, 4, 0, 0, 0,
      0, 4, 5, 5, 4, 0, 0, 0,
      0, 4, 5, 5, 4, 0, 0, 0,
      0, 4, 4, 4, 4, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
    ]),
    box: { minX: origin.x, minY: origin.y, maxX: origin.x + 8, maxY: origin.y + 8 },
  };
  const crowns = crownsFromGrid(grid, 0.35);
  expect(crowns.length).toBeGreaterThan(0);
  expect(crowns[0]?.crownHeightM).toBeGreaterThanOrEqual(CANOPY_HEIGHT_THRESHOLD_M);
});

test("loads a synthetic canopy GeoTIFF from disk", async () => {
  const origin = toWebMercator(121.05, 14.552);
  const width = 6;
  const height = 6;
  const values = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      values[row * width + col] = row >= 1 && row <= 3 && col >= 1 && col <= 3 ? 5 : 0;
    }
  }
  const metadata = {
    height,
    width,
    ModelPixelScale: [1, 1, 0],
    ModelTiepoint: [0, 0, 0, origin.x, origin.y + height, 0],
    GeographicTypeGeoKey: 3857,
  };
  const buffer = await writeArrayBuffer(values, metadata);
  const dir = await mkdtemp(join(tmpdir(), "shadeway-canopy-"));
  const path = join(dir, "canopy.tif");
  await writeFile(path, Buffer.from(buffer));
  const box = { minX: origin.x, minY: origin.y, maxX: origin.x + width, maxY: origin.y + height };
  const grid = await loadCanopyGrid(path, box);
  const crowns = crownsFromGrid(grid, 0.35);
  expect(crowns.length).toBeGreaterThan(0);
});
