import { mkdir } from "node:fs/promises";
import { buildArea, type BuildReport } from "./build.js";
import { bgcBox, googleImageryEnd, googleImageryStart, googleInferenceDate, googleManifestUrl, googleTileUrl } from "./config.js";
import { fetchOsm } from "./osm.js";
import { loadOverrides } from "./overrides.js";
import { loadShadeFootprints } from "./overture.js";
import { toUtm51N } from "./project.js";
import { readRasterWindow } from "./raster.js";
import { medianRasterHeight, type BuildingRecord, type HeightGrid, type Ring } from "./sample.js";

export async function buildPilot(cacheDir: string, outDir: string, overridesPath: string): Promise<BuildReport> {
  await mkdir(cacheDir, { recursive: true });
  console.error("pilot osm");
  const osm = await fetchOsm(bgcBox);
  console.error("pilot buildings");
  const buildings = await loadShadeFootprints(cacheDir, bgcBox, "building");
  console.error("pilot parts");
  const parts = await loadShadeFootprints(cacheDir, bgcBox, "building_part");
  console.error("pilot raster");
  const grid = await loadGoogleHeightGrid();
  const overrides = await loadOverrides(overridesPath);
  console.error(`pilot shade ways=${osm.ways.length} buildingRows=${buildings.length} partRows=${parts.length}`);
  return buildArea({
    area: "bgc",
    box: bgcBox,
    ways: osm.ways,
    buildings,
    parts,
    overrides,
    outDir,
    rasterHeight: (record) => rasterFor(record, grid),
    extraNotes: [
      `OpenStreetMap from ${osm.endpoint}, timestamp ${osm.osmTimestamp}.`,
      `Google height raster ${googleTileUrl} manifest ${googleManifestUrl} inference ${googleInferenceDate} imagery ${googleImageryStart} to ${googleImageryEnd}. Median of samples about 4 m apart inside the footprint.`,
    ],
  });
}

async function loadGoogleHeightGrid(): Promise<HeightGrid> {
  const corners = [
    toUtm51N(bgcBox.west, bgcBox.south),
    toUtm51N(bgcBox.east, bgcBox.south),
    toUtm51N(bgcBox.west, bgcBox.north),
    toUtm51N(bgcBox.east, bgcBox.north),
  ];
  const window = await readRasterWindow(googleTileUrl, 1, {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  });
  if (!(window.values instanceof Float32Array)) throw new Error("Google height band was not float32");
  return {
    originX: window.originX,
    originY: window.originY,
    pixelSize: window.pixelSizeX,
    width: window.width,
    height: window.height,
    nodata: window.nodata ?? -99,
    values: window.values,
  };
}

function rasterFor(record: BuildingRecord, grid: HeightGrid): number | undefined {
  const parts = (record.parts ?? [record.rings]).map((rings) => rings.map((ring) => projectRing(ring)));
  return medianRasterHeight(grid, parts);
}

function projectRing(ring: Ring): Ring {
  return ring.flatMap((pair) => {
    const lon = pair[0];
    const lat = pair[1];
    if (lon === undefined || lat === undefined) return [];
    const point = toUtm51N(lon, lat);
    return [[point.x, point.y]];
  });
}
