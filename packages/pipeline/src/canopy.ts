import type { LngLat, TreeCaster } from "@shadeway/contract";
import { fromFile } from "geotiff";
import { fromWebMercator, toWebMercator } from "./project.js";
import type { RasterWindow } from "./raster.js";
import { readRasterWindow } from "./raster.js";

/** Canopy heights at or above this value become tree crowns. Meta/WRI CHM, decision 004. */
export const CANOPY_HEIGHT_THRESHOLD_M = 3;

/** Drop raster crowns whose connected area is below this size. */
export const MIN_CROWN_AREA_M2 = 6;

/** Douglas-Peucker simplify tolerance in meters for crown polygons. */
export const CROWN_SIMPLIFY_M = 1.5;

/** Drop specks smaller than this many 1 m pixels. */
export const MIN_CROWN_PIXELS = 6;

export type CanopyGrid = {
  originX: number;
  originY: number;
  pixelSizeX: number;
  pixelSizeY: number;
  width: number;
  height: number;
  values: Uint8Array | Float32Array | Float64Array;
  box: { minX: number; minY: number; maxX: number; maxY: number };
};

export function countCanopyPixels(grid: CanopyGrid): { pixels: number; atLeast3m: number } {
  let pixels = 0;
  let atLeast3m = 0;
  for (let row = 0; row < grid.height; row += 1) {
    const y = grid.originY - (row + 0.5) * grid.pixelSizeY;
    if (y < grid.box.minY || y >= grid.box.maxY) continue;
    for (let col = 0; col < grid.width; col += 1) {
      const x = grid.originX + (col + 0.5) * grid.pixelSizeX;
      if (x < grid.box.minX || x >= grid.box.maxX) continue;
      pixels += 1;
      const height = sampleHeight(grid, row, col);
      if (height >= CANOPY_HEIGHT_THRESHOLD_M) atLeast3m += 1;
    }
  }
  return { pixels, atLeast3m };
}

export async function loadCanopyGrid(urlOrPath: string, world: CanopyGrid["box"]): Promise<CanopyGrid> {
  const window = urlOrPath.startsWith("http")
    ? await readRasterWindow(urlOrPath, 0, world)
    : await readLocalCanopy(urlOrPath, world);
  return {
    originX: window.originX,
    originY: window.originY,
    pixelSizeX: window.pixelSizeX,
    pixelSizeY: window.pixelSizeY,
    width: window.width,
    height: window.height,
    values: window.values,
    box: world,
  };
}

async function readLocalCanopy(path: string, world: CanopyGrid["box"]): Promise<RasterWindow> {
  const tiff = await fromFile(path);
  const image = await tiff.getImage();
  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const originX = origin[0];
  const originY = origin[1];
  const resX = resolution[0];
  const resY = resolution[1];
  if (originX === undefined || originY === undefined || resX === undefined || resY === undefined) {
    throw new Error(`raster ${path} has no geotransform`);
  }
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const col0 = clamp(Math.floor((world.minX - originX) / resX), 0, fullWidth);
  const col1 = clamp(Math.ceil((world.maxX - originX) / resX), 0, fullWidth);
  const rowAt = (y: number) => (y - originY) / resY;
  const row0 = clamp(Math.floor(Math.min(rowAt(world.minY), rowAt(world.maxY))), 0, fullHeight);
  const row1 = clamp(Math.ceil(Math.max(rowAt(world.minY), rowAt(world.maxY))), 0, fullHeight);
  if (col1 <= col0 || row1 <= row0) throw new Error(`raster window missed ${path}`);
  const rasters = await image.readRasters({ window: [col0, row0, col1, row1], samples: [0] });
  const band = Array.isArray(rasters) ? rasters[0] : rasters;
  if (!(band instanceof Uint8Array || band instanceof Float32Array || band instanceof Float64Array)) {
    throw new Error(`unexpected raster sample type from ${path}`);
  }
  const pixelSizeY = Math.abs(resY);
  const top = resY < 0 ? originY + row0 * resY : originY - row0 * pixelSizeY;
  return {
    originX: originX + col0 * resX,
    originY: top,
    pixelSizeX: Math.abs(resX),
    pixelSizeY,
    width: rasters.width,
    height: rasters.height,
    values: band,
    nodata: image.getGDALNoData(),
  };
}

export function crownsFromGrid(grid: CanopyGrid, transmittance: number): TreeCaster[] {
  const mask = new Uint8Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      mask[index] = sampleHeight(grid, row, col) >= CANOPY_HEIGHT_THRESHOLD_M ? 1 : 0;
    }
  }
  const labels = labelComponents(mask, grid.width, grid.height);
  const crowns: TreeCaster[] = [];
  const seen = new Map<number, { pixels: number; maxHeight: number; points: { x: number; y: number }[] }>();
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      const label = labels[index] ?? 0;
      if (label === 0) continue;
      const height = sampleHeight(grid, row, col);
      const center = cellCenter(grid, row, col);
      const entry = seen.get(label) ?? { pixels: 0, maxHeight: 0, points: [] };
      entry.pixels += 1;
      entry.maxHeight = Math.max(entry.maxHeight, height);
      entry.points.push(center);
      seen.set(label, entry);
    }
  }
  let crownIndex = 0;
  for (const [label, group] of seen) {
    if (group.pixels < MIN_CROWN_PIXELS) continue;
    const footprint = convexHullLngLat(group.points);
    const area = polygonAreaM2(footprint);
    if (area < MIN_CROWN_AREA_M2) continue;
    const simplified = simplifyRing(footprint, CROWN_SIMPLIFY_M);
    if (simplified.length < 3) continue;
    crowns.push({
      id: `canopy-${label}-${crownIndex}`,
      footprint: simplified,
      crownHeightM: group.maxHeight,
      transmittance,
    });
    crownIndex += 1;
  }
  return crowns;
}

function sampleHeight(grid: CanopyGrid, row: number, col: number): number {
  const value = grid.values[row * grid.width + col];
  if (value === undefined || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function cellCenter(grid: CanopyGrid, row: number, col: number): { x: number; y: number } {
  return {
    x: grid.originX + (col + 0.5) * grid.pixelSizeX,
    y: grid.originY - (row + 0.5) * grid.pixelSizeY,
  };
}

function mercatorToLngLat(x: number, y: number): LngLat {
  const point = fromWebMercator(x, y);
  return [point.lon, point.lat];
}

function convexHullLngLat(points: readonly { x: number; y: number }[]): Ring {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: { x: number; y: number }[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  return hull.map((point) => mercatorToLngLat(point.x, point.y));
}

type Ring = LngLat[];

function cross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function polygonAreaM2(ring: readonly LngLat[]): number {
  if (ring.length < 3) return 0;
  const origin = ring[0];
  if (origin === undefined) return 0;
  const mercator = ring.map((point) => toWebMercator(point[0], point[1]));
  let area = 0;
  for (let i = 0; i < mercator.length; i += 1) {
    const a = mercator[i];
    const b = mercator[(i + 1) % mercator.length];
    if (!a || !b) continue;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function simplifyRing(ring: readonly LngLat[], toleranceM: number): Ring {
  if (ring.length <= 3) return [...ring];
  const flat = ring.map((point) => toWebMercator(point[0], point[1]));
  const simplified = douglasPeucker(flat, toleranceM);
  return simplified.map((point) => mercatorToLngLat(point.x, point.y));
}

function douglasPeucker(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  const start = points[0]!;
  const end = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i]!, start, end);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function perpendicularDistance(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.min(1, Math.max(0, t));
  return Math.hypot(point.x - (start.x + clamped * dx), point.y - (start.y + clamped * dy));
}

function labelComponents(mask: Uint8Array, width: number, height: number): Int32Array {
  const labels = new Int32Array(mask.length);
  let next = 1;
  const queue: number[] = [];
  const push = (row: number, col: number, label: number) => {
    const index = row * width + col;
    if (mask[index] !== 1 || labels[index] !== 0) return;
    labels[index] = label;
    queue.push(index);
  };
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const start = row * width + col;
      if (mask[start] !== 1 || labels[start] !== 0) continue;
      const label = next;
      next += 1;
      push(row, col, label);
      while (queue.length > 0) {
        const index = queue.pop();
        if (index === undefined) continue;
        const r = Math.floor(index / width);
        const c = index % width;
        if (r > 0) push(r - 1, c, label);
        if (r + 1 < height) push(r + 1, c, label);
        if (c > 0) push(r, c - 1, label);
        if (c + 1 < width) push(r, c + 1, label);
      }
    }
  }
  return labels;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
