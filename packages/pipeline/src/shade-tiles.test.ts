import { decodeSunFraction, decodeSunTile, sunByte, type Edge, type TreeCaster } from "@shadeway/contract";
import { expect, test } from "vitest";
import { shadeEdges } from "./shade-tiles.js";

const ORIGIN: [number, number] = [121.05, 14.55];

function edgeOverTreeLine(): Edge {
  return {
    id: 42,
    from: 1,
    to: 2,
    covered: false,
    bridge: false,
    lengthM: 40,
    geometry: [
      [ORIGIN[0] - 0.0002, ORIGIN[1]],
      [ORIGIN[0] + 0.0002, ORIGIN[1]],
    ],
  };
}

function treeOverOrigin(): TreeCaster {
  const d = 0.00003;
  return {
    id: "tree-test",
    crownHeightM: 12,
    transmittance: 0.35,
    footprint: [
      [ORIGIN[0] - d, ORIGIN[1] - d],
      [ORIGIN[0] + d, ORIGIN[1] - d],
      [ORIGIN[0] + d, ORIGIN[1] + d],
      [ORIGIN[0] - d, ORIGIN[1] + d],
    ],
  };
}

test("shade tiles include tree shadows and lower sun on a crossed edge", () => {
  const edge = edgeOverTreeLine();
  const sunMinutes = 12 * 60;
  const without = shadeEdges({
    edges: [edge],
    buildings: [],
    trees: [],
    location: ORIGIN,
    date: "2026-06-21",
    minutes: sunMinutes,
  });
  const withTrees = shadeEdges({
    edges: [edge],
    buildings: [],
    trees: [treeOverOrigin()],
    location: ORIGIN,
    date: "2026-06-21",
    minutes: sunMinutes,
  });
  const day = "june-solstice";
  const slot = 12;
  const beforeTile = decodeSunTile(without.files[day]);
  const afterTile = decodeSunTile(withTrees.files[day]);
  const before = decodeSunFraction(sunByte(beforeTile, 0, slot));
  const after = decodeSunFraction(sunByte(afterTile, 0, slot));
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  if (before === null || after === null) return;
  expect(after).toBeLessThan(before);
});

test("tree shadows are required for canopy tiles to change", () => {
  const edge = edgeOverTreeLine();
  const input = {
    edges: [edge],
    buildings: [],
    trees: [treeOverOrigin()],
    location: ORIGIN,
    date: "2026-06-21",
    minutes: 12 * 60,
  };
  const shaded = shadeEdges(input);
  const stripped = shadeEdges({ ...input, trees: [] });
  const day = "june-solstice";
  const slot = 12;
  const withTree = decodeSunFraction(sunByte(decodeSunTile(shaded.files[day]), 0, slot));
  const bare = decodeSunFraction(sunByte(decodeSunTile(stripped.files[day]), 0, slot));
  expect(withTree).not.toEqual(bare);
});
