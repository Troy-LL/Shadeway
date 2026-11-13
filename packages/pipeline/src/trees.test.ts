import { expect, test } from "vitest";
import { crownsFromGrid, type CanopyGrid } from "./canopy.js";
import { toWebMercator } from "./project.js";
import { buildTreeCasters } from "./trees.js";

function emptyGrid(): CanopyGrid {
  const origin = toWebMercator(121.05, 14.552);
  return {
    originX: origin.x,
    originY: origin.y + 4,
    pixelSizeX: 1,
    pixelSizeY: 1,
    width: 4,
    height: 4,
    values: new Float32Array(16),
    box: { minX: origin.x, minY: origin.y, maxX: origin.x + 4, maxY: origin.y + 4 },
  };
}

test("adds one OSM node fallback when the raster has no crown", () => {
  const built = buildTreeCasters(emptyGrid(), [{ id: 7, lon: 121.05, lat: 14.552 }]);
  expect(built.osmFallbackCrowns).toBe(1);
  expect(built.trees).toHaveLength(1);
  expect(built.trees[0]?.id).toBe("osm-tree-7");
});

test("skips OSM fallback when a raster crown is nearby", () => {
  const origin = toWebMercator(121.05, 14.552);
  const grid = {
    originX: origin.x,
    originY: origin.y + 8,
    pixelSizeX: 1,
    pixelSizeY: 1,
    width: 8,
    height: 8,
    values: new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 5, 5, 5, 5, 0, 0, 0,
      0, 5, 5, 5, 5, 0, 0, 0,
      0, 5, 5, 5, 5, 0, 0, 0,
      0, 5, 5, 5, 5, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
    ]),
    box: { minX: origin.x, minY: origin.y, maxX: origin.x + 8, maxY: origin.y + 8 },
  };
  const raster = crownsFromGrid(grid, 0.35);
  const center = raster[0]?.footprint[0];
  if (!center) throw new Error("missing raster crown");
  const built = buildTreeCasters(grid, [{ id: 1, lon: center[0], lat: center[1] }]);
  expect(built.osmFallbackCrowns).toBe(0);
});
