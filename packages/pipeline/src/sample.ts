import type { BBox } from "./edges.js";

export type Ring = number[][];

export type BuildingRecord = {
  height: number | null;
  numFloors: number | null;
  rings: Ring[];
  parts?: Ring[][];
};

export type HeightGrid = {
  originX: number;
  originY: number;
  pixelSize: number;
  width: number;
  height: number;
  nodata: number;
  values: Float32Array;
};

export function buildingCenter(building: BuildingRecord): { x: number; y: number } {
  return partsCentroid(building.parts ?? [building.rings]);
}

export function countBuildings(
  buildings: BuildingRecord[],
  box: BBox,
): { buildings: number; withHeight: number; withLevels: number } {
  let count = 0;
  let withHeight = 0;
  let withLevels = 0;
  for (const building of buildings) {
    const center = buildingCenter(building);
    if (Number.isNaN(center.x)) continue;
    if (center.x < box.west || center.x > box.east || center.y < box.south || center.y > box.north) {
      continue;
    }
    count += 1;
    if (building.height !== null && building.height > 0) withHeight += 1;
    if (building.numFloors !== null && building.numFloors > 0) withLevels += 1;
  }
  return { buildings: count, withHeight, withLevels };
}

export function footprintHasRasterHeight(grid: HeightGrid, rings: Ring[]): boolean {
  const outer = rings[0];
  if (outer === undefined) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pair of outer) {
    const point = xy(pair);
    if (point === undefined) continue;
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const col0 = clamp(Math.floor((minX - grid.originX) / grid.pixelSize), 0, grid.width);
  const col1 = clamp(Math.ceil((maxX - grid.originX) / grid.pixelSize), 0, grid.width);
  const row0 = clamp(Math.floor((grid.originY - maxY) / grid.pixelSize), 0, grid.height);
  const row1 = clamp(Math.ceil((grid.originY - minY) / grid.pixelSize), 0, grid.height);
  for (let row = row0; row < row1; row += 1) {
    const y = grid.originY - (row + 0.5) * grid.pixelSize;
    for (let col = col0; col < col1; col += 1) {
      const value = grid.values[row * grid.width + col];
      if (value === undefined || value === grid.nodata || value <= 0) continue;
      const x = grid.originX + (col + 0.5) * grid.pixelSize;
      if (pointInRings(x, y, rings)) return true;
    }
  }
  return false;
}

function partsCentroid(parts: Ring[][]): { x: number; y: number } {
  let count = 0;
  let x = 0;
  let y = 0;
  for (const rings of parts) {
    const ring = rings[0];
    if (ring === undefined) continue;
    const first = xy(ring[0]);
    const last = xy(ring[ring.length - 1]);
    let n = ring.length;
    if (n > 1 && first !== undefined && last !== undefined && first.x === last.x && first.y === last.y) n -= 1;
    for (let i = 0; i < n; i += 1) {
      const point = xy(ring[i]);
      if (point === undefined) continue;
      x += point.x;
      y += point.y;
      count += 1;
    }
  }
  return { x: x / count, y: y / count };
}

function pointInRings(x: number, y: number, rings: Ring[]): boolean {
  const outer = rings[0];
  if (outer === undefined || !pointInRing(x, y, outer)) return false;
  for (let i = 1; i < rings.length; i += 1) {
    const hole = rings[i];
    if (hole !== undefined && pointInRing(x, y, hole)) return false;
  }
  return true;
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const current = xy(ring[i]);
    const previous = xy(ring[j]);
    if (current === undefined || previous === undefined) continue;
    const xi = current.x;
    const yi = current.y;
    const xj = previous.x;
    const yj = previous.y;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function xy(pair: number[] | undefined): { x: number; y: number } | undefined {
  const x = pair?.[0];
  const y = pair?.[1];
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
