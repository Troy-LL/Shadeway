import { expect, test } from "vitest";
import { toUtm51N, toWebMercator } from "./project.js";

test("UTM zone 51N matches a known BGC corner within a meter", () => {
  const point = toUtm51N(121.0417, 14.5418);
  expect(Math.abs(point.x - 288990.37)).toBeLessThan(1);
  expect(Math.abs(point.y - 1608553.73)).toBeLessThan(1);
});

test("web mercator matches the standard spherical formula", () => {
  const point = toWebMercator(121.05, 14.55);
  const x = (121.05 * 20037508.342789244) / 180;
  const lat = (14.55 * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + lat / 2)) * 6378137;
  expect(Math.abs(point.x - x)).toBeLessThan(0.01);
  expect(Math.abs(point.y - y)).toBeLessThan(0.01);
});
