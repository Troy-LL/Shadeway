import type { LngLat, TreeCaster } from "@shadeway/contract";
import { toWebMercator } from "./project.js";
import { type CanopyGrid, crownsFromGrid } from "./canopy.js";
import type { OsmTreePoint, OsmTreeRow } from "./osm.js";

/** OSM `natural=tree` fallback crown radius when no raster crown is nearby. */
export const OSM_TREE_CROWN_RADIUS_M = 4;

/** OSM fallback crown height in meters. */
export const OSM_TREE_CROWN_HEIGHT_M = 8;

/** Direct sun under an OSM-only crown. */
export const OSM_TREE_TRANSMITTANCE = 0.4;

/** Direct sun under a raster-derived crown. */
export const RASTER_TREE_TRANSMITTANCE = 0.35;

/** Skip an OSM crown when a raster crown lies within this distance. */
export const OSM_TREE_SKIP_RADIUS_M = 6;

export type TreeBuild = {
  trees: TreeCaster[];
  rasterCrowns: number;
  osmFallbackCrowns: number;
};

export function buildTreeCasters(
  grid: CanopyGrid,
  osmTrees: readonly OsmTreePoint[],
  osmRows: readonly OsmTreeRow[],
): TreeBuild {
  const raster = crownsFromGrid(grid, RASTER_TREE_TRANSMITTANCE);
  const fallback: TreeCaster[] = [];
  let osmIndex = 0;
  for (const tree of osmTrees) {
    if (nearRasterCrown(raster, tree.lon, tree.lat, OSM_TREE_SKIP_RADIUS_M)) continue;
    fallback.push({
      id: `osm-tree-${tree.id}`,
      footprint: circleRing(tree.lon, tree.lat, OSM_TREE_CROWN_RADIUS_M),
      crownHeightM: tree.heightM ?? OSM_TREE_CROWN_HEIGHT_M,
      transmittance: OSM_TREE_TRANSMITTANCE,
    });
    osmIndex += 1;
  }
  for (const row of osmRows) {
    const crowns = crownsAlongRow(row);
    for (const crown of crowns) {
      if (nearRasterCrown(raster, crown.lon, crown.lat, OSM_TREE_SKIP_RADIUS_M)) continue;
      fallback.push({
        id: `osm-row-${row.id}-${osmIndex}`,
        footprint: circleRing(crown.lon, crown.lat, OSM_TREE_CROWN_RADIUS_M),
        crownHeightM: crown.heightM ?? OSM_TREE_CROWN_HEIGHT_M,
        transmittance: OSM_TREE_TRANSMITTANCE,
      });
      osmIndex += 1;
    }
  }
  return { trees: [...raster, ...fallback], rasterCrowns: raster.length, osmFallbackCrowns: fallback.length };
}

function nearRasterCrown(crowns: readonly TreeCaster[], lon: number, lat: number, radiusM: number): boolean {
  const here = toWebMercator(lon, lat);
  const r2 = radiusM * radiusM;
  for (const crown of crowns) {
    for (const point of crown.footprint) {
      const there = toWebMercator(point[0], point[1]);
      const dx = there.x - here.x;
      const dy = there.y - here.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
  }
  return false;
}

function circleRing(lon: number, lat: number, radiusM: number, segments = 12): LngLat[] {
  const center = toWebMercator(lon, lat);
  const ring: LngLat[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * radiusM;
    const y = center.y + Math.sin(angle) * radiusM;
    const point = {
      lon: (x / 6378137) * (180 / Math.PI),
      lat: (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * (180 / Math.PI),
    };
    ring.push([point.lon, point.lat]);
  }
  return ring;
}

function crownsAlongRow(row: OsmTreeRow): { lon: number; lat: number; heightM?: number }[] {
  const points: { lon: number; lat: number; heightM?: number }[] = [];
  const spacingM = OSM_TREE_CROWN_RADIUS_M * 2.2;
  for (let i = 1; i < row.nodes.length; i += 1) {
    const a = row.nodes[i - 1];
    const b = row.nodes[i];
    if (!a || !b) continue;
    const start = toWebMercator(a.lon, a.lat);
    const end = toWebMercator(b.lon, b.lat);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / spacingM));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = start.x + dx * t;
      const y = start.y + dy * t;
      const lon = (x / 6378137) * (180 / Math.PI);
      const lat = (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * (180 / Math.PI);
      points.push({ lon, lat });
    }
  }
  return points;
}
