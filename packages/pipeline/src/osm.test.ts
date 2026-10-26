import { expect, test } from "vitest";
import { readOverpass } from "./osm.js";

test("overpass payload joins way nodes and counts tree points", () => {
  const parsed = readOverpass({
    elements: [
      { type: "node", id: 1, lon: 1, lat: 1 },
      { type: "node", id: 2, lon: 2, lat: 1 },
      { type: "node", id: 9, lon: 3, lat: 3, tags: { natural: "tree" } },
      { type: "way", id: 5, nodes: [1, 2], tags: { highway: "footway", covered: "yes" } },
    ],
  });
  const way = parsed.ways[0];
  expect(parsed.treePoints).toBe(1);
  expect(parsed.ways).toHaveLength(1);
  expect(way?.nodes.map((node) => node.id)).toEqual([1, 2]);
  expect(way?.tags.covered).toBe("yes");
});
