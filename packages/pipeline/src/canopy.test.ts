import { expect, test } from "vitest";
import { countCanopyPixels } from "./canopy.js";

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
