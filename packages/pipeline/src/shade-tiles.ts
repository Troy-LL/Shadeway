import {
  NO_DATA_BYTE,
  REFERENCE_DAYS,
  SLOT_GRID,
  encodeSunFraction,
  encodeSunTile,
  nearestSlot,
  type Building,
  type Edge,
  type LngLat,
  type ReferenceDay,
  type ShadowPolygon,
  type SunPosition,
  type SunTile,
} from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { isFullyShaded } from "./tags.js";

const CELL = 0.002;

export type ShadeTiles = {
  files: Record<ReferenceDay, Uint8Array>;
  interpolation: {
    date: string;
    minutes: number;
    edges: number;
    meanAbsoluteError: number | null;
  };
};

export function shadeEdges(input: {
  edges: readonly Edge[];
  buildings: readonly Building[];
  location: LngLat;
  date: string;
  minutes: number;
}): ShadeTiles {
  const checkSlot = nearestSlot(input.minutes);
  if (checkSlot === null) throw new RangeError(`interpolation time is outside the slot grid: ${input.minutes}`);
  const atCheck = emptyDayRows(input.edges.length);

  const files = {} as Record<ReferenceDay, Uint8Array>;
  for (const day of REFERENCE_DAYS) {
    const sun = new Uint8Array(input.edges.length * SLOT_GRID.count);
    sun.fill(NO_DATA_BYTE);
    for (let slot = 0; slot < SLOT_GRID.count; slot += 1) {
      const started = Date.now();
      const position = shadeModel.referenceSunPosition(day, slot, input.location);
      const fractions = fractionsFor(input.edges, input.buildings, position);
      fractions.forEach((fraction, edgeIndex) => {
        sun[edgeIndex * SLOT_GRID.count + slot] = encodeSunFraction(fraction);
        if (slot === checkSlot) atCheck[day][edgeIndex] = fraction;
      });
      if (input.edges.length > 50) console.error(`shade ${day} slot ${slot} ${Date.now() - started}ms`);
    }
    const tile: SunTile = {
      referenceDay: day,
      edgeIds: Uint32Array.from(input.edges.map((edge) => edge.id)),
      sun,
    };
    files[day] = encodeSunTile(tile);
  }

  return { files, interpolation: interpolationError(input, atCheck) };
}

function interpolationError(
  input: { edges: readonly Edge[]; buildings: readonly Building[]; location: LngLat; date: string; minutes: number },
  atCheck: Record<ReferenceDay, (number | null)[]>,
): ShadeTiles["interpolation"] {
  const day = shadeModel.sunDay(input.date);
  const position = shadeModel.sunPosition({ date: input.date, minutes: input.minutes }, input.location);
  const direct = fractionsFor(input.edges, input.buildings, position);
  let edges = 0;
  let error = 0;
  input.edges.forEach((edge, edgeIndex) => {
    if (isFullyShaded(edge)) return;
    const value = direct[edgeIndex];
    if (value === undefined) return;
    const interpolated = shadeModel.interpolateSunFraction(
      {
        "march-equinox": atCheck["march-equinox"][edgeIndex] ?? null,
        "june-solstice": atCheck["june-solstice"][edgeIndex] ?? null,
        "december-solstice": atCheck["december-solstice"][edgeIndex] ?? null,
      },
      day,
    );
    if (value === null || interpolated === null) return;
    edges += 1;
    error += Math.abs(value - interpolated);
  });
  return {
    date: input.date,
    minutes: input.minutes,
    edges,
    meanAbsoluteError: edges === 0 ? null : error / edges,
  };
}

function fractionsFor(edges: readonly Edge[], buildings: readonly Building[], sun: SunPosition): (number | null)[] {
  const index = indexShadows(shadeModel.shadowPolygons(buildings, sun));
  return edges.map((edge) => fractionFor(edge, sun, index));
}

function fractionFor(edge: Edge, sun: SunPosition, index: ShadowIndex): number | null {
  if (isFullyShaded(edge)) return 0;
  const nearby = shadowsNear(edge, index);
  if (nearby.length === 0) {
    if (!(sun.elevationDeg > 0) || sun.elevationDeg >= 90) return null;
    return 1;
  }
  return shadeModel.edgeSunFraction(edge, nearby, sun);
}

function emptyDayRows(edgeCount: number): Record<ReferenceDay, (number | null)[]> {
  const row = (): (number | null)[] => Array.from({ length: edgeCount }, () => null);
  return {
    "march-equinox": row(),
    "june-solstice": row(),
    "december-solstice": row(),
  };
}

type Boxed = {
  n: number;
  shadow: ShadowPolygon;
  west: number;
  south: number;
  east: number;
  north: number;
};

type ShadowIndex = {
  cells: Map<string, Boxed[]>;
};

function indexShadows(shadows: readonly ShadowPolygon[]): ShadowIndex {
  const cells = new Map<string, Boxed[]>();
  shadows.forEach((shadow, n) => {
    if (shadow.ring.length < 3) return;
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const point of shadow.ring) {
      if (point[0] < west) west = point[0];
      if (point[1] < south) south = point[1];
      if (point[0] > east) east = point[0];
      if (point[1] > north) north = point[1];
    }
    const boxed = { n, shadow, west, south, east, north };
    const x0 = Math.floor(west / CELL);
    const x1 = Math.floor(east / CELL);
    const y0 = Math.floor(south / CELL);
    const y1 = Math.floor(north / CELL);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const key = `${x}:${y}`;
        const list = cells.get(key) ?? [];
        list.push(boxed);
        cells.set(key, list);
      }
    }
  });
  return { cells };
}

function shadowsNear(edge: Edge, index: ShadowIndex): ShadowPolygon[] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of edge.geometry) {
    if (point[0] < west) west = point[0];
    if (point[1] < south) south = point[1];
    if (point[0] > east) east = point[0];
    if (point[1] > north) north = point[1];
  }
  const found = new Map<number, ShadowPolygon>();
  const x0 = Math.floor(west / CELL) - 1;
  const x1 = Math.floor(east / CELL) + 1;
  const y0 = Math.floor(south / CELL) - 1;
  const y1 = Math.floor(north / CELL) + 1;
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      for (const boxed of index.cells.get(`${x}:${y}`) ?? []) {
        if (boxed.east < west || boxed.west > east || boxed.north < south || boxed.south > north) continue;
        found.set(boxed.n, boxed.shadow);
      }
    }
  }
  return [...found.values()];
}
