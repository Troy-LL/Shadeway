import { expect, test } from "vitest";
import { countFootpathEdges, type BBox, type OsmWay } from "./edges.js";

const box: BBox = { south: 0, west: 0, north: 10, east: 10 };

function way(id: number, nodes: number[][], tags: Record<string, string>): OsmWay {
  return {
    id,
    tags,
    nodes: nodes.flatMap((pair, index) => {
      const lon = pair[0];
      const lat = pair[1];
      if (lon === undefined || lat === undefined) return [];
      return [{ id: id * 100 + index, lon, lat }];
    }),
  };
}

test("one linear footway is one edge", () => {
  const counts = countFootpathEdges([way(1, [[1, 1], [2, 1], [3, 1]], { highway: "footway" })], box);
  expect(counts.footpathEdges).toBe(1);
  expect(counts.coveredEdges).toBe(0);
  expect(counts.pedestrianBridgeEdges).toBe(0);
});

test("a shared node splits both ways into edges", () => {
  const north = way(1, [[1, 1], [2, 2], [3, 1]], { highway: "footway" });
  const east = way(2, [[2, 2], [4, 2]], { highway: "path" });
  const sharedNorth = north.nodes[1];
  if (sharedNorth === undefined) throw new Error("missing node");
  east.nodes[0] = sharedNorth;
  const counts = countFootpathEdges([north, east], box);
  expect(counts.footpathEdges).toBe(3);
});

test("covered and bridge tags count the split edges", () => {
  const covered = way(1, [[1, 1], [2, 1], [3, 1]], { highway: "footway", covered: "yes" });
  const spur = way(2, [[2, 1], [2, 3]], { highway: "steps", bridge: "yes" });
  const sharedCovered = covered.nodes[1];
  if (sharedCovered === undefined) throw new Error("missing node");
  spur.nodes[0] = sharedCovered;
  const counts = countFootpathEdges([covered, spur], box);
  expect(counts.footpathEdges).toBe(3);
  expect(counts.coveredEdges).toBe(2);
  expect(counts.pedestrianBridgeEdges).toBe(1);
});

test("bridge=no, private access, areas, and carriageways are not footpath edges", () => {
  const counts = countFootpathEdges(
    [
      way(1, [[1, 1], [2, 1]], { highway: "footway", bridge: "no" }),
      way(2, [[1, 2], [2, 2]], { highway: "footway", access: "private", bridge: "yes", covered: "yes" }),
      way(3, [[1, 3], [2, 3], [2, 4], [1, 3]], { highway: "pedestrian", area: "yes" }),
      way(4, [[1, 4], [2, 4]], { highway: "primary", bridge: "yes", covered: "yes" }),
    ],
    box,
  );
  expect(counts.footpathEdges).toBe(1);
  expect(counts.coveredEdges).toBe(0);
  expect(counts.pedestrianBridgeEdges).toBe(0);
});

test("a way that only clips the box still counts, and one fully outside does not", () => {
  const counts = countFootpathEdges(
    [
      way(1, [[-2, 5], [2, 5]], { highway: "footway", covered: "yes" }),
      way(2, [[20, 20], [21, 20]], { highway: "sidewalk" }),
    ],
    box,
  );
  expect(counts.footpathEdges).toBe(1);
  expect(counts.coveredEdges).toBe(1);
});
