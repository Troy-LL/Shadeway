import { expect, test } from "vitest";
import { CANOPY_HEIGHT_THRESHOLD_M, countCanopyPixels, crownsFromGrid } from "./canopy.js";
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
