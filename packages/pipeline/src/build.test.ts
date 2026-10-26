import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  ATTRIBUTION,
  REFERENCE_DAYS,
  SLOT_GRID,
  decodeSunFraction,
  decodeSunTile,
  sunByte,
  type Building,
  type GraphFile,
  type LngLat,
  type TileManifest,
} from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { afterEach, expect, test } from "vitest";
import { buildArea } from "./build.js";
import { bgcBox, pilotWalks } from "./config.js";
import type { BBox, OsmWay } from "./edges.js";
import { loadOverrides, parseOverrides } from "./overrides.js";
import { predictionForFraction, scoreLog } from "./score.js";
import type { BuildingRecord } from "./sample.js";

const box: BBox = { south: 14.549, west: 121.049, north: 14.553, east: 121.053 };
const overridesPath = new URL("../../../data/overrides/bgc.json", import.meta.url);
let outDir: string | undefined;

afterEach(async () => {
  if (outDir !== undefined) await rm(outDir, { recursive: true, force: true });
  outDir = undefined;
});

test("three pilot walks sit inside BGC and name a covered way, trees, and an overpass", () => {
  expect(pilotWalks).toHaveLength(3);
  const notes = pilotWalks.map((walk) => walk.note).join("\n");
  expect(notes).toContain("covered=yes");
  expect(notes).toContain("natural=tree");
  expect(notes).toContain("bridge=viaduct");
  for (const walk of pilotWalks) {
    expect(inside(walk.from)).toBe(true);
    expect(inside(walk.to)).toBe(true);
  }
});

test("the BGC overrides file loads, and a missing source note is rejected", async () => {
  const overrides = await loadOverrides(overridesPath.pathname);
  expect(overrides.heights).toEqual([]);
  expect(overrides.edges).toEqual([]);
  expect(overrides.note).toContain("318");
  expect(overrides.note).toContain("259.1");
  expect(() => parseOverrides({ note: "", heights: [{ id: "t", lng: 1, lat: 2, heightM: 10 }], edges: [] })).toThrow(
    /source note/,
  );
});

test("the scorer prints a match rate and the misses", () => {
  expect(predictionForFraction(0)).toBe("shade");
  expect(predictionForFraction(0.5)).toBe("sun");
  expect(predictionForFraction(null)).toBeNull();
  const text = scoreLog({
    version: 1,
    segments: [
      { id: "a", date: "2026-05-01", minutes: 720, observed: "shade", predicted: "shade", edgeId: 3 },
      { id: "b", date: "2026-05-01", minutes: 780, observed: "sun", predicted: "shade" },
    ],
  });
  expect(text).toContain("match_rate=0.5");
  expect(text).toContain("miss b observed=sun predicted=shade");
  expect(scoreLog({ version: 1, segments: [] })).toContain("match_rate=none");
});

test("a fixture area builds in under 60 seconds", async () => {
  outDir = await mkdtemp(join(tmpdir(), "shadeway-fixture-"));
  const started = performance.now();
  const report = await buildArea({
    area: "fixture",
    box,
    ways: fixtureWays(),
    buildings: fixtureBuildings(),
    overrides: {
      note: "fixture",
      heights: [{ id: "tower-fix", source: "fixture note", lng: 121.05027, lat: 14.55027, heightM: 180 }],
      edges: [{ id: "cover-fix", source: "fixture note", osmWayId: 99, kind: "covered" }],
    },
    outDir,
    now: new Date("2026-05-01T04:00:00.000Z"),
    rasterHeight: (record) => (record.id === "raster-b" ? 22 : undefined),
  });
  expect(performance.now() - started).toBeLessThan(60_000);

  expect(report.edges).toBe(5);
  expect(report.buildings).toEqual({ osm: 1, levels: 1, raster: 1, default: 0, override: 1 });
  expect(report.coveredEdges).toBe(3);
  expect(report.coveredYesEdges).toBe(1);
  expect(report.buildingPassageEdges).toBe(1);
  expect(report.bridgeEdges).toBe(1);
  expect(report.overrideEdges).toBe(1);
  expect(report.interpolation.date).toBe("2026-05-01");
  expect(report.interpolation.edges).toBe(1);
  expect(report.interpolation.meanAbsoluteError).not.toBeNull();

  const manifest = JSON.parse(await readFile(join(outDir, "manifest.json"), "utf8")) as TileManifest;
  expect(manifest.attribution).toEqual([...ATTRIBUTION]);
  expect(manifest.graph).toBe("graph.json");
  expect(manifest.tiles).toHaveLength(1);

  const graph = JSON.parse(await readFile(join(outDir, "graph.json"), "utf8")) as GraphFile;
  const covered = graph.edges.filter((edge) => edge.covered || edge.bridge);
  expect(covered).toHaveLength(4);
  expect(graph.edges.find((edge) => edge.overrideId === "cover-fix")?.covered).toBe(true);

  const basemap = JSON.parse(await readFile(join(outDir, "basemap.geojson"), "utf8")) as {
    attribution: string[];
    features: { properties: { kind: string; id: string; heightSource?: string; heightM?: number }; geometry: { type: string; coordinates: number[][][] } }[];
  };
  expect(basemap.attribution).toEqual([...ATTRIBUTION]);
  const tower = basemap.features.find((feature) => feature.properties.id === "plain-b");
  expect(tower?.properties.heightSource).toBe("override");
  expect(tower?.properties.heightM).toBe(180);

  const buildings = buildingsFrom(basemap.features);
  const open = graph.edges.find((edge) => !edge.covered && !edge.bridge);
  if (open === undefined) throw new Error("missing open edge");
  const openIndex = graph.edges.indexOf(open);
  const center: LngLat = [(box.west + box.east) / 2, (box.south + box.north) / 2];
  for (const day of REFERENCE_DAYS) {
    const tileRef = manifest.tiles[0];
    if (tileRef === undefined) throw new Error("missing tile");
    const tile = decodeSunTile(new Uint8Array(await readFile(join(outDir, tileRef.files[day]))));
    expect(tile.referenceDay).toBe(day);
    for (const edge of covered) {
      const index = graph.edges.indexOf(edge);
      for (let slot = 0; slot < SLOT_GRID.count; slot += 1) expect(sunByte(tile, index, slot)).toBe(0);
    }
    for (let slot = 0; slot < SLOT_GRID.count; slot += 1) {
      const sun = shadeModel.referenceSunPosition(day, slot, center);
      const expected = shadeModel.edgeSunFraction(open, shadeModel.shadowPolygons(buildings, sun), sun);
      const actual = decodeSunFraction(sunByte(tile, openIndex, slot));
      if (expected === null) expect(actual).toBeNull();
      else expect(actual).toBeCloseTo(expected, 2);
    }
  }
}, 60_000);

function inside(point: LngLat): boolean {
  return point[0] >= bgcBox.west && point[0] <= bgcBox.east && point[1] >= bgcBox.south && point[1] <= bgcBox.north;
}

function fixtureWays(): OsmWay[] {
  return [
    way(10, [[121.0492, 14.5492], [121.0494, 14.5494]], { highway: "footway", covered: "yes" }),
    way(11, [[121.0492, 14.5496], [121.0495, 14.5496]], { highway: "footway", bridge: "yes" }),
    way(12, [[121.0492, 14.5498], [121.0495, 14.5498]], { highway: "footway", tunnel: "building_passage" }),
    way(13, [[121.0515, 14.5525], [121.0525, 14.5525]], { highway: "footway" }),
    way(99, [[121.0492, 14.5512], [121.0496, 14.5512]], { highway: "path" }),
  ];
}

function fixtureBuildings(): BuildingRecord[] {
  return [
    { id: "osm-b", height: 40, numFloors: 10, rings: [square(121.0505, 14.5515, 0.0004)] },
    { id: "levels-b", height: null, numFloors: 4, rings: [square(121.0512, 14.5515, 0.0003)] },
    { id: "raster-b", height: null, numFloors: null, rings: [square(121.0516, 14.5506, 0.0003)] },
    { id: "plain-b", height: null, numFloors: null, rings: [square(121.0502, 14.5502, 0.00015)] },
  ];
}

function square(lng: number, lat: number, size: number): number[][] {
  return [
    [lng, lat],
    [lng + size, lat],
    [lng + size, lat + size],
    [lng, lat + size],
    [lng, lat],
  ];
}

function way(id: number, nodes: number[][], tags: Record<string, string>): OsmWay {
  return {
    id,
    tags,
    nodes: nodes.flatMap((pair, index) => {
      const lon = pair[0];
      const lat = pair[1];
      if (lon === undefined || lat === undefined) return [];
      return [{ id: id * 10 + index, lon, lat }];
    }),
  };
}

function buildingsFrom(
  features: { properties: { kind: string; id: string; heightSource?: string; heightM?: number }; geometry: { coordinates: number[][][] } }[],
): Building[] {
  return features.flatMap((feature) => {
    if (feature.properties.kind !== "building") return [];
    const ring = feature.geometry.coordinates[0];
    if (ring === undefined) return [];
    const footprint = ring.slice(0, -1).flatMap((pair) => {
      const lng = pair[0];
      const lat = pair[1];
      if (lng === undefined || lat === undefined) return [];
      return [[lng, lat] as LngLat];
    });
    const heightM = feature.properties.heightM;
    const heightSource = feature.properties.heightSource;
    if (heightM === undefined || (heightSource !== "osm" && heightSource !== "levels" && heightSource !== "raster" && heightSource !== "default" && heightSource !== "override")) {
      return [];
    }
    return [{ id: feature.properties.id, footprint, heightM, heightSource }];
  });
}
