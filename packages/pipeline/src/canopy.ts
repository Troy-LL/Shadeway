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

/** Split raster patches larger than this area into multiple crowns. */
export const MAX_CROWN_PATCH_AREA_M2 = 2000;

/** Target sub-patch size when splitting oversized components. */
export const TARGET_SPLIT_AREA_M2 = 400;

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

export function canopyCrownRetention(grid: CanopyGrid, crowns: readonly TreeCaster[]): number {
  const mask = new Uint8Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      if (sampleHeight(grid, row, col) >= CANOPY_HEIGHT_THRESHOLD_M) mask[row * grid.width + col] = 1;
    }
  }
  let crownPixels = 0;
  for (const crown of crowns) {
    for (let row = 0; row < grid.height; row += 1) {
      for (let col = 0; col < grid.width; col += 1) {
        const index = row * grid.width + col;
        if (mask[index] !== 1) continue;
        const center = cellCenter(grid, row, col);
        if (pointInCrownFootprint(crown.footprint, center.x, center.y)) crownPixels += 1;
      }
    }
  }
  let canopyPixels = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 1) canopyPixels += 1;
  }
  if (canopyPixels === 0) return 1;
  return crownPixels / canopyPixels;
}

function pointInCrownFootprint(footprint: readonly LngLat[], x: number, y: number): boolean {
  if (footprint.length < 3) return false;
  const ring = footprint.map((point) => toWebMercator(point[0], point[1]));
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const intersects = a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1e-12) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function crownsFromGrid(grid: CanopyGrid, transmittance: number): TreeCaster[] {
  const mask = new Uint8Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      mask[index] = sampleHeight(grid, row, col) >= CANOPY_HEIGHT_THRESHOLD_M ? 1 : 0;
    }
  }
  const baseLabels = labelComponents(mask, grid.width, grid.height);
  const labels = splitOversizedPatches(grid, mask, baseLabels);
  const crowns: TreeCaster[] = [];
  const seen = new Map<number, { cells: { row: number; col: number }[]; peakHeight: number }>();
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      const label = labels[index] ?? 0;
      if (label === 0) continue;
      const height = sampleHeight(grid, row, col);
      const entry = seen.get(label) ?? { cells: [], peakHeight: 0 };
      entry.cells.push({ row, col });
      if (height >= entry.peakHeight) entry.peakHeight = height;
      seen.set(label, entry);
    }
  }
  let crownIndex = 0;
  for (const [label, group] of seen) {
    if (group.cells.length < MIN_CROWN_PIXELS) continue;
    const footprint = footprintFromCells(grid, group.cells);
    const area = polygonAreaM2(footprint);
    if (area < MIN_CROWN_AREA_M2) continue;
    const simplified = area < 200 ? footprint : simplifyRing(footprint, CROWN_SIMPLIFY_M);
    if (simplified.length < 3) continue;
    const crownHeightM = crownPeakHeight(grid, group.cells);
    crowns.push({
      id: `canopy-${label}-${crownIndex}`,
      footprint: simplified,
      crownHeightM,
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

function splitOversizedPatches(grid: CanopyGrid, mask: Uint8Array, labels: Int32Array): Int32Array {
  const out = new Int32Array(labels);
  const pixelArea = grid.pixelSizeX * grid.pixelSizeY;
  let next = labels.reduce((max, value) => Math.max(max, value), 0) + 1;
  const byLabel = new Map<number, { row: number; col: number }[]>();
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      const label = labels[index] ?? 0;
      if (label === 0) continue;
      const list = byLabel.get(label) ?? [];
      list.push({ row, col });
      byLabel.set(label, list);
    }
  }
  for (const [label, cells] of byLabel) {
    if (cells.length * pixelArea <= MAX_CROWN_PATCH_AREA_M2) continue;
    const peaks = localMaxima(grid, mask, cells);
    if (peaks.length === 0 || peaks.length === cells.length) continue;
    const seeds = peaks.length > 1 ? peaks : gridSeeds(grid, cells, pixelArea);
    const assignments = voronoiBySeeds(cells, seeds, grid);
    for (const [subKey, subset] of assignments) {
      const subLabel = next;
      next += 1;
      for (const cell of subset) {
        out[cell.row * grid.width + cell.col] = subLabel;
      }
      void subKey;
      void label;
    }
  }
  return out;
}

function localMaxima(
  grid: CanopyGrid,
  mask: Uint8Array,
  cells: readonly { row: number; col: number }[],
): { row: number; col: number }[] {
  const set = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
  const peaks: { row: number; col: number }[] = [];
  for (const cell of cells) {
    const height = sampleHeight(grid, cell.row, cell.col);
    let isPeak = mask[cell.row * grid.width + cell.col] === 1;
    for (let dr = -1; dr <= 1 && isPeak; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const key = `${cell.row + dr},${cell.col + dc}`;
        if (!set.has(key)) continue;
        if (sampleHeight(grid, cell.row + dr, cell.col + dc) > height) {
          isPeak = false;
          break;
        }
      }
    }
    if (isPeak) peaks.push(cell);
  }
  return peaks;
}

function gridSeeds(
  grid: CanopyGrid,
  cells: readonly { row: number; col: number }[],
  pixelArea: number,
): { row: number; col: number }[] {
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const cell of cells) {
    minRow = Math.min(minRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxRow = Math.max(maxRow, cell.row);
    maxCol = Math.max(maxCol, cell.col);
  }
  const spanRows = maxRow - minRow + 1;
  const spanCols = maxCol - minCol + 1;
  const area = cells.length * pixelArea;
  const parts = Math.max(2, Math.ceil(area / TARGET_SPLIT_AREA_M2));
  const side = Math.ceil(Math.sqrt(parts));
  const stepRow = Math.max(1, Math.floor(spanRows / side));
  const stepCol = Math.max(1, Math.floor(spanCols / side));
  const seeds: { row: number; col: number }[] = [];
  for (let row = minRow; row <= maxRow; row += stepRow) {
    for (let col = minCol; col <= maxCol; col += stepCol) {
      seeds.push({ row, col });
    }
  }
  if (seeds.length === 0) seeds.push(cells[0]!);
  void grid;
  return seeds;
}

function voronoiBySeeds(
  cells: readonly { row: number; col: number }[],
  seeds: readonly { row: number; col: number }[],
  grid: CanopyGrid,
): Map<string, { row: number; col: number }[]> {
  const groups = new Map<string, { row: number; col: number }[]>();
  for (const cell of cells) {
    const center = cellCenter(grid, cell.row, cell.col);
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      if (!seed) continue;
      const seedCenter = cellCenter(grid, seed.row, seed.col);
      const distance = (center.x - seedCenter.x) ** 2 + (center.y - seedCenter.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    const key = String(best);
    const list = groups.get(key) ?? [];
    list.push(cell);
    groups.set(key, list);
  }
  return groups;
}

function crownPeakHeight(grid: CanopyGrid, cells: readonly { row: number; col: number }[]): number {
  const mask = new Uint8Array(grid.width * grid.height);
  for (const cell of cells) mask[cell.row * grid.width + cell.col] = 1;
  const peaks = localMaxima(grid, mask, cells);
  if (peaks.length === 0) {
    let peak = 0;
    for (const cell of cells) peak = Math.max(peak, sampleHeight(grid, cell.row, cell.col));
    return peak;
  }
  let peak = 0;
  for (const cell of peaks) peak = Math.max(peak, sampleHeight(grid, cell.row, cell.col));
  return peak;
}

function footprintFromCells(grid: CanopyGrid, cells: readonly { row: number; col: number }[]): Ring {
  const set = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
  const corners: { x: number; y: number }[] = [];
  const has = (row: number, col: number) => set.has(`${row},${col}`);
  for (const { row, col } of cells) {
    const x0 = grid.originX + col * grid.pixelSizeX;
    const x1 = x0 + grid.pixelSizeX;
    const yTop = grid.originY - row * grid.pixelSizeY;
    const yBottom = yTop - grid.pixelSizeY;
    if (!has(row - 1, col)) corners.push({ x: x0, y: yTop }, { x: x1, y: yTop });
    if (!has(row + 1, col)) corners.push({ x: x1, y: yBottom }, { x: x0, y: yBottom });
    if (!has(row, col - 1)) corners.push({ x: x0, y: yBottom }, { x: x0, y: yTop });
    if (!has(row, col + 1)) corners.push({ x: x1, y: yTop }, { x: x1, y: yBottom });
  }
  if (corners.length === 0) return [];
  const deduped = dedupePoints(corners);
  if (deduped.length < 3) return deduped.map((point) => mercatorToLngLat(point.x, point.y));
  const cx = deduped.reduce((sum, point) => sum + point.x, 0) / deduped.length;
  const cy = deduped.reduce((sum, point) => sum + point.y, 0) / deduped.length;
  const sorted = [...deduped].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return sorted.map((point) => mercatorToLngLat(point.x, point.y));
}

function dedupePoints(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const point of points) {
    if (!out.some((existing) => Math.hypot(existing.x - point.x, existing.y - point.y) < 1e-6)) out.push(point);
  }
  return out;
}

type Ring = LngLat[];

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
