import { mkdir } from "node:fs/promises";
import { countCanopyPixels } from "./canopy.js";
import {
  bgcBox,
  canopyObjectModified,
  canopyTileUrl,
  googleImageryEnd,
  googleImageryStart,
  googleInferenceDate,
  googleManifestUrl,
  googleTileUrl,
  overtureOsmCutoff,
  overtureRelease,
  overtureReleaseNotes,
  overtureS3,
} from "./config.js";
import { countFootpathEdges } from "./edges.js";
import { fetchOsm } from "./osm.js";
import { loadBuildings } from "./overture.js";
import { toUtm51N, toWebMercator } from "./project.js";
import { readRasterWindow } from "./raster.js";
import { buildingCenter, countBuildings, footprintHasRasterHeight } from "./sample.js";

export type Measured = { name: string; value: number; source: string };
export type Unmeasured = { name: string; reason: string };

export type MeasureReport = {
  measured: Measured[];
  unmeasured: Unmeasured[];
};

const countNames = [
  "buildings",
  "with_height",
  "with_building_levels",
  "with_raster_height",
  "footpath_edges",
  "covered_yes_edges",
  "pedestrian_bridge_edges",
  "canopy_pixels_at_least_3m",
  "tree_points",
] as const;

export async function measure(cacheDir: string): Promise<MeasureReport> {
  await mkdir(cacheDir, { recursive: true });
  const measured: Measured[] = [];
  const unmeasured: Unmeasured[] = [];
  const record = (name: (typeof countNames)[number], value: number, source: string) => {
    measured.push({ name, value, source });
  };
  const fail = (name: (typeof countNames)[number], reason: string) => {
    unmeasured.push({ name, reason });
  };

  let buildings: Awaited<ReturnType<typeof loadBuildings>> = [];
  try {
    console.error("measure buildings");
    buildings = await loadBuildings(cacheDir, bgcBox);
    const counts = countBuildings(buildings, bgcBox);
    const source = `Overture ${overtureRelease} ${overtureS3} release notes ${overtureReleaseNotes} OSM cutoff ${overtureOsmCutoff}`;
    record("buildings", counts.buildings, source);
    record("with_height", counts.withHeight, source);
    record("with_building_levels", counts.withLevels, `${source}; field num_floors`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail("buildings", reason);
    fail("with_height", reason);
    fail("with_building_levels", reason);
  }

  try {
    console.error("measure raster");
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
    if (!(window.values instanceof Float32Array)) {
      throw new Error("Google height band was not float32");
    }
    const heights = window.values;
    let withRaster = 0;
    for (const building of buildings) {
      const center = buildingCenter(building);
      if (
        center.x < bgcBox.west ||
        center.x > bgcBox.east ||
        center.y < bgcBox.south ||
        center.y > bgcBox.north
      ) {
        continue;
      }
      const parts = building.parts ?? [building.rings];
      const hit = parts.some((rings) => {
        const projected = rings.map((ring) =>
          ring.flatMap((pair) => {
            const lon = pair[0];
            const lat = pair[1];
            if (lon === undefined || lat === undefined) return [];
            const point = toUtm51N(lon, lat);
            return [[point.x, point.y]];
          }),
        );
        return footprintHasRasterHeight(
          {
            originX: window.originX,
            originY: window.originY,
            pixelSize: window.pixelSizeX,
            width: window.width,
            height: window.height,
            nodata: window.nodata ?? -99,
            values: heights,
          },
          projected,
        );
      });
      if (hit) withRaster += 1;
    }
    record(
      "with_raster_height",
      withRaster,
      `${googleTileUrl} manifest ${googleManifestUrl} inference ${googleInferenceDate} imagery ${googleImageryStart} to ${googleImageryEnd}`,
    );
  } catch (error) {
    fail("with_raster_height", error instanceof Error ? error.message : String(error));
  }

  try {
    console.error("measure osm");
    const osm = await fetchOsm(bgcBox);
    const edges = countFootpathEdges(osm.ways, bgcBox);
    const source = `${osm.endpoint} OSM timestamp ${osm.osmTimestamp}`;
    record("footpath_edges", edges.footpathEdges, source);
    record("covered_yes_edges", edges.coveredEdges, source);
    record("pedestrian_bridge_edges", edges.pedestrianBridgeEdges, source);
    record("tree_points", osm.treePoints, source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail("footpath_edges", reason);
    fail("covered_yes_edges", reason);
    fail("pedestrian_bridge_edges", reason);
    fail("tree_points", reason);
  }

  try {
    console.error("measure canopy");
    const corners = [boxCorner(bgcBox.west, bgcBox.south), boxCorner(bgcBox.east, bgcBox.south), boxCorner(bgcBox.west, bgcBox.north), boxCorner(bgcBox.east, bgcBox.north)];
    const world = {
      minX: Math.min(...corners.map((corner) => corner.x)),
      minY: Math.min(...corners.map((corner) => corner.y)),
      maxX: Math.max(...corners.map((corner) => corner.x)),
      maxY: Math.max(...corners.map((corner) => corner.y)),
    };
    const window = await readRasterWindow(canopyTileUrl, 0, world);
    if (!(window.values instanceof Uint8Array)) {
      throw new Error("canopy band was not uint8");
    }
    const counts = countCanopyPixels({
      originX: window.originX,
      originY: window.originY,
      pixelSizeX: window.pixelSizeX,
      pixelSizeY: window.pixelSizeY,
      width: window.width,
      height: window.height,
      values: window.values,
      box: world,
    });
    record(
      "canopy_pixels_at_least_3m",
      counts.atLeast3m,
      `${canopyTileUrl} object last modified ${canopyObjectModified}; ${counts.atLeast3m} of ${counts.pixels} pixels in the box`,
    );
  } catch (error) {
    fail("canopy_pixels_at_least_3m", error instanceof Error ? error.message : String(error));
  }

  return { measured, unmeasured };
}

export function formatReport(report: MeasureReport): string {
  const lines: string[] = [];
  for (const name of countNames) {
    const row = report.measured.find((item) => item.name === name);
    const missing = report.unmeasured.find((item) => item.name === name);
    if (row !== undefined) {
      lines.push(`${name}=${row.value}`);
      continue;
    }
    lines.push(`${name}=unmeasurable ${missing?.reason ?? "missing"}`);
  }
  lines.push("sources");
  for (const row of report.measured) {
    lines.push(`${row.name} ${row.source}`);
  }
  return lines.join("\n");
}

function boxCorner(lon: number, lat: number): { x: number; y: number } {
  return toWebMercator(lon, lat);
}
