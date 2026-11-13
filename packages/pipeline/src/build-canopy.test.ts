import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TreeCaster } from "@shadeway/contract";
import { afterEach, expect, test } from "vitest";
import { buildArea } from "./build.js";
import { loadOverrides } from "./overrides.js";
import type { BBox, OsmWay } from "./edges.js";
import { fromWebMercator, toWebMercator } from "./project.js";

const box: BBox = { south: 14.549, west: 121.049, north: 14.553, east: 121.053 };
const overridesPath = new URL("../../../data/overrides/bgc.json", import.meta.url);
let outDir: string | undefined;

afterEach(async () => {
  if (outDir !== undefined) await rm(outDir, { recursive: true, force: true });
  outDir = undefined;
});

test("pilot tiles and metrics require tree crowns", async () => {
  outDir = await mkdtemp(join(tmpdir(), "shadeway-canopy-build-"));
  const merc = toWebMercator(121.0505, 14.551);
  const at = fromWebMercator(merc.x, merc.y);
  const ways = fixtureWays(at.lon, at.lat);
  const d = 0.00002;
  const tree: TreeCaster = {
    id: "test-tree",
    crownHeightM: 10,
    transmittance: 0.35,
    footprint: [
      [at.lon - d, at.lat - d],
      [at.lon + d, at.lat - d],
      [at.lon + d, at.lat + d],
      [at.lon - d, at.lat + d],
    ],
  };
  const overrides = await loadOverrides(overridesPath.pathname);
  const bare = await buildArea({
    area: "fixture",
    box,
    ways,
    buildings: [],
    overrides,
    outDir: join(outDir, "bare"),
  });
  const shaded = await buildArea({
    area: "fixture",
    box,
    ways,
    buildings: [],
    overrides,
    outDir: join(outDir, "trees"),
    trees: [tree],
    treeStats: { rasterCrowns: 1, osmFallbackCrowns: 0 },
  });
  expect(bare.canopy).toBeUndefined();
  expect(shaded.canopy).toBeDefined();
  expect(shaded.canopy?.noonChangedEdgeShare).toBeGreaterThan(0);
  expect(shaded.canopy?.demoShadiestSunMinutesAfter).not.toBeNull();
  const bareTile = await readFile(join(outDir, "bare", "tiles", "june-solstice.swtl"));
  const withTile = await readFile(join(outDir, "trees", "tiles", "june-solstice.swtl"));
  expect(Buffer.compare(bareTile, withTile)).not.toBe(0);
  const bareManifest = JSON.parse(await readFile(join(outDir, "bare", "manifest.json"), "utf8")) as { canopy?: boolean };
  const treeManifest = JSON.parse(await readFile(join(outDir, "trees", "manifest.json"), "utf8")) as { canopy?: boolean };
  expect(bareManifest.canopy).toBeUndefined();
  expect(treeManifest.canopy).toBe(true);
});

function fixtureWays(treeLon: number, treeLat: number): OsmWay[] {
  return [
    {
      id: 99,
      tags: { highway: "footway" },
      nodes: [
        { id: 1, lon: treeLon - 0.001, lat: treeLat },
        { id: 2, lon: treeLon + 0.001, lat: treeLat },
      ],
    },
  ];
}
