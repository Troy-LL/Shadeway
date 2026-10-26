import { expect, test } from "vitest";
import { countBuildings, footprintHasRasterHeight, medianRasterHeight, type HeightGrid } from "./sample.js";

const box = { south: 0, west: 0, north: 10, east: 10 };

test("building counts use centroid in the box, height, and num_floors", () => {
  const counts = countBuildings(
    [
      { height: 12, numFloors: 3, rings: [[[1, 1], [2, 1], [2, 2], [1, 1]]] },
      { height: null, numFloors: 2, rings: [[[4, 4], [5, 4], [5, 5], [4, 4]]] },
      { height: 0, numFloors: null, rings: [[[6, 6], [7, 6], [7, 7], [6, 6]]] },
      { height: 8, numFloors: 1, rings: [[[20, 20], [21, 20], [21, 21], [20, 20]]] },
    ],
    box,
  );
  expect(counts).toEqual({ buildings: 3, withHeight: 1, withLevels: 2 });
});

test("a footprint has a raster height when a pixel inside it is above the nodata floor", () => {
  const grid: HeightGrid = {
    originX: 0,
    originY: 2,
    pixelSize: 1,
    width: 2,
    height: 2,
    nodata: -99,
    values: new Float32Array([5, 0, -99, 8]),
  };
  const coverFirst = [[[0.1, 1.9], [0.9, 1.9], [0.9, 1.1], [0.1, 1.1], [0.1, 1.9]]];
  const coverZero = [[[1.1, 1.9], [1.9, 1.9], [1.9, 1.1], [1.1, 1.1], [1.1, 1.9]]];
  const coverNodata = [[[0.1, 0.9], [0.9, 0.9], [0.9, 0.1], [0.1, 0.1], [0.1, 0.9]]];
  const coverLast = [[[1.1, 0.9], [1.9, 0.9], [1.9, 0.1], [1.1, 0.1], [1.1, 0.9]]];
  expect(footprintHasRasterHeight(grid, coverFirst)).toBe(true);
  expect(footprintHasRasterHeight(grid, coverZero)).toBe(false);
  expect(footprintHasRasterHeight(grid, coverNodata)).toBe(false);
  expect(footprintHasRasterHeight(grid, coverLast)).toBe(true);
});

test("raster median uses samples about 4 m apart and ignores nodata", () => {
  const grid: HeightGrid = {
    originX: 0,
    originY: 8,
    pixelSize: 4,
    width: 2,
    height: 2,
    nodata: -99,
    values: new Float32Array([10, 30, 20, -99]),
  };
  const left = [[[[0.1, 0.1], [3.9, 0.1], [3.9, 7.9], [0.1, 7.9]]]];
  expect(medianRasterHeight(grid, left)).toBe(15);
  expect(medianRasterHeight(grid, [[[[10, 10], [12, 10], [12, 12]]]])).toBeUndefined();
});
