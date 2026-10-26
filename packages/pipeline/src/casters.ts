import { HEIGHT_SOURCES, type Building, type HeightSource, type LngLat } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import type { BBox } from "./edges.js";
import type { HeightOverride, Overrides } from "./overrides.js";
import { buildingCenter, ringContains, type BuildingRecord, type Ring } from "./sample.js";

const METERS_PER_DEG_LAT = (Math.PI * 6378137) / 180;

export type Caster = Building & { areaM2: number };

export type CasterBuild = {
  casters: Caster[];
  counts: Record<HeightSource, number>;
  buildingRows: number;
  partRows: number;
  droppedFootprints: number;
};

export function buildCasters(
  buildings: readonly BuildingRecord[],
  parts: readonly BuildingRecord[],
  box: BBox,
  overrides: Overrides,
  rasterHeight?: (record: BuildingRecord) => number | undefined,
): CasterBuild {
  const buildingRows = rowsInBox(buildings, box);
  const partRows = rowsInBox(parts, box);
  let droppedFootprints = 0;
  const casters = [
    ...recordsToCasters(buildings, box, "building", rasterHeight, (dropped) => {
      droppedFootprints += dropped;
    }),
    ...recordsToCasters(parts, box, "part", rasterHeight, (dropped) => {
      droppedFootprints += dropped;
    }),
  ];
  const withOverrides = applyHeightOverrides(casters, overrides.heights);
  const counts = emptyCounts();
  for (const caster of withOverrides) counts[caster.heightSource] += 1;
  return { casters: withOverrides, counts, buildingRows, partRows, droppedFootprints };
}

function recordsToCasters(
  records: readonly BuildingRecord[],
  box: BBox,
  prefix: string,
  rasterHeight: ((record: BuildingRecord) => number | undefined) | undefined,
  onDropped: (count: number) => void,
): Caster[] {
  const casters: Caster[] = [];
  let dropped = 0;
  records.forEach((record, recordIndex) => {
    if (!centroidInBox(record, box)) return;
    const rings = footprintsOf(record);
    if (rings.length === 0) {
      dropped += 1;
      return;
    }
    const height = chainHeight(record, rasterHeight);
    const base = record.id ?? `${prefix}-${recordIndex}`;
    rings.forEach((footprint, partIndex) => {
      const ring = openRing(footprint);
      if (ring === undefined) {
        dropped += 1;
        return;
      }
      casters.push({
        id: rings.length > 1 ? `${base}#${partIndex}` : base,
        footprint: ring,
        heightM: height.heightM,
        heightSource: height.heightSource,
        areaM2: areaM2(ring),
      });
    });
  });
  onDropped(dropped);
  return casters;
}

function applyHeightOverrides(casters: readonly Caster[], heights: readonly HeightOverride[]): Caster[] {
  const next = casters.map((caster) => ({ ...caster, footprint: caster.footprint }));
  const claimed = new Set<number>();
  for (const item of heights) {
    let bestIndex = -1;
    let bestArea = Infinity;
    next.forEach((caster, index) => {
      if (claimed.has(index)) return;
      if (!ringContains(caster.footprint, item.lng, item.lat)) return;
      if (caster.areaM2 < bestArea) {
        bestIndex = index;
        bestArea = caster.areaM2;
      }
    });
    const best = next[bestIndex];
    if (best === undefined) continue;
    claimed.add(bestIndex);
    next[bestIndex] = { ...best, heightM: item.heightM, heightSource: "override" };
  }
  return next;
}

function chainHeight(
  record: BuildingRecord,
  rasterHeight: ((record: BuildingRecord) => number | undefined) | undefined,
): { heightM: number; heightSource: HeightSource } {
  const needsRaster =
    !(record.height !== null && record.height > 0) && !(record.numFloors !== null && record.numFloors > 0);
  const raster = needsRaster ? rasterHeight?.(record) : undefined;
  return shadeModel.estimateHeight({
    ...(record.height !== null && record.height > 0 ? { heightTagM: record.height } : {}),
    ...(record.numFloors !== null && record.numFloors > 0 ? { levels: record.numFloors } : {}),
    ...(raster !== undefined && raster > 0 ? { rasterHeightM: raster } : {}),
  });
}

function footprintsOf(record: BuildingRecord): Ring[] {
  const parts = record.parts ?? [record.rings];
  const rings: Ring[] = [];
  for (const part of parts) {
    const outer = part[0];
    if (outer !== undefined) rings.push(outer);
  }
  return rings;
}

function rowsInBox(records: readonly BuildingRecord[], box: BBox): number {
  let count = 0;
  for (const record of records) if (centroidInBox(record, box)) count += 1;
  return count;
}

function centroidInBox(record: BuildingRecord, box: BBox): boolean {
  const center = buildingCenter(record);
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return false;
  return center.x >= box.west && center.x <= box.east && center.y >= box.south && center.y <= box.north;
}

function openRing(ring: Ring): LngLat[] | undefined {
  const points: LngLat[] = [];
  for (const pair of ring) {
    const lng = pair[0];
    const lat = pair[1];
    if (lng === undefined || lat === undefined) continue;
    const prev = points[points.length - 1];
    if (prev !== undefined && prev[0] === lng && prev[1] === lat) continue;
    points.push([lng, lat]);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (
    points.length > 1 &&
    first !== undefined &&
    last !== undefined &&
    first[0] === last[0] &&
    first[1] === last[1]
  ) {
    points.pop();
  }
  return points.length >= 3 ? points : undefined;
}

function areaM2(ring: readonly LngLat[]): number {
  const origin = ring[0];
  if (origin === undefined) return 0;
  const cos = Math.cos((origin[1] * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a === undefined || b === undefined) continue;
    const ax = (a[0] - origin[0]) * METERS_PER_DEG_LAT * cos;
    const ay = (a[1] - origin[1]) * METERS_PER_DEG_LAT;
    const bx = (b[0] - origin[0]) * METERS_PER_DEG_LAT * cos;
    const by = (b[1] - origin[1]) * METERS_PER_DEG_LAT;
    area += ax * by - bx * ay;
  }
  return Math.abs(area) / 2;
}

function emptyCounts(): Record<HeightSource, number> {
  const counts = {} as Record<HeightSource, number>;
  for (const source of HEIGHT_SOURCES) counts[source] = 0;
  return counts;
}
