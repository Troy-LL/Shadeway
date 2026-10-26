import type { Building, Edge, LngLat, SunPosition } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";

const METERS_PER_DEG_LAT = 111_320;

export interface ShadowDraw {
  readonly ring: readonly LngLat[];
  readonly estimated: boolean;
}

export interface RouteDraw {
  readonly sunny: LngLat[][];
  readonly shaded: LngLat[][];
  readonly ticks: LngLat[][];
}

/** Deck common space: x east, y north, z up. The vector is the direction light travels. */
export function sunLightDirection(sun: SunPosition): [number, number, number] {
  const azimuth = (sun.azimuthDeg * Math.PI) / 180;
  const elevation = (sun.elevationDeg * Math.PI) / 180;
  const cosElevation = Math.cos(elevation);
  return [-Math.sin(azimuth) * cosElevation, -Math.cos(azimuth) * cosElevation, -Math.sin(elevation)];
}

export function buildingsNearRoute(
  buildings: readonly Building[],
  route: readonly LngLat[],
  bufferM: number,
): Building[] {
  const bounds = expand(routeBounds(route), bufferM);
  if (!bounds) return [];
  return buildings.filter((building) => ringHits(building.footprint, bounds));
}

export function shadowDraws(buildings: readonly Building[], sun: SunPosition): ShadowDraw[] {
  return shadeModel.shadowPolygons(buildings, sun).flatMap((shadow) => {
    const ring = closeRing(shadow.ring);
    if (ring.length < 4) return [];
    return [{ ring, estimated: shadow.estimated }];
  });
}

export function paintRoute(
  route: readonly LngLat[],
  edges: readonly Edge[],
  shadows: readonly { readonly ring: readonly LngLat[] }[],
): RouteDraw {
  const covers = edgesOnRoute(edges, route).filter((edge) => edge.covered || edge.bridge);
  const shadowPolygons = shadows.map((shadow) => ({ buildingId: "", ring: shadow.ring, estimated: false }));
  const sunny: LngLat[][] = [];
  const shaded: LngLat[][] = [];
  let current: LngLat[] = [];
  let currentShade = false;

  const flush = () => {
    if (current.length < 2) {
      current = [];
      return;
    }
    (currentShade ? shaded : sunny).push(current);
    current = [];
  };

  for (const point of resample(route, 14)) {
    const shade =
      covers.some((edge) => distanceToLine(point, edge.geometry) < 12) ||
      shadeModel.isInShadow(point, shadowPolygons);
    if (current.length > 0 && shade !== currentShade) {
      current.push(point);
      flush();
    }
    currentShade = shade;
    current.push(point);
  }
  flush();

  return {
    sunny,
    shaded,
    ticks: covers.flatMap((edge) => ticksAlong(edge.geometry, 26, 5)),
  };
}

export function routeBounds(route: readonly LngLat[]): [number, number, number, number] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of route) {
    if (point[0] < west) west = point[0];
    if (point[1] < south) south = point[1];
    if (point[0] > east) east = point[0];
    if (point[1] > north) north = point[1];
  }
  if (!Number.isFinite(west)) return null;
  return [west, south, east, north];
}

/** Camera sits behind the walker so the street ahead stays in frame. */
export function offsetBehind(at: LngLat, bearing: number, meters: number): LngLat {
  const radians = (bearing * Math.PI) / 180;
  const east = -Math.sin(radians) * meters;
  const north = -Math.cos(radians) * meters;
  const lonScale = METERS_PER_DEG_LAT * Math.cos((at[1] * Math.PI) / 180);
  return [at[0] + east / lonScale, at[1] + north / METERS_PER_DEG_LAT];
}

export function pointAlong(route: readonly LngLat[], fraction: number): { at: LngLat; bearing: number } | null {
  if (route.length < 2) return null;
  const target = Math.min(1, Math.max(0, fraction)) * lengthM(route);
  let walked = 0;
  for (let i = 1; i < route.length; i++) {
    const previous = route[i - 1];
    const next = route[i];
    if (!previous || !next) continue;
    const span = metersBetween(previous, next);
    if (walked + span >= target || i === route.length - 1) {
      const t = span === 0 ? 0 : Math.min(1, (target - walked) / span);
      return {
        at: [previous[0] + (next[0] - previous[0]) * t, previous[1] + (next[1] - previous[1]) * t],
        bearing: bearingDeg(previous, next),
      };
    }
    walked += span;
  }
  const last = route[route.length - 1];
  const before = route[route.length - 2];
  if (!last || !before) return null;
  return { at: last, bearing: bearingDeg(before, last) };
}

function closeRing(ring: readonly LngLat[]): LngLat[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first) return [];
  if (!last || first[0] !== last[0] || first[1] !== last[1]) return [...ring, first];
  return [...ring];
}

function edgesOnRoute(edges: readonly Edge[], route: readonly LngLat[]): Edge[] {
  const keys = new Set(route.map(pointKey));
  return edges.filter((edge) => edge.geometry.length >= 2 && edge.geometry.every((point) => keys.has(pointKey(point))));
}

function pointKey(point: LngLat): string {
  return `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
}

function resample(route: readonly LngLat[], stepM: number): LngLat[] {
  const points: LngLat[] = [];
  const first = route[0];
  if (!first) return points;
  points.push(first);
  for (let i = 1; i < route.length; i++) {
    const previous = route[i - 1];
    const next = route[i];
    if (!previous || !next) continue;
    const span = metersBetween(previous, next);
    const steps = Math.max(1, Math.round(span / stepM));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      points.push([previous[0] + (next[0] - previous[0]) * t, previous[1] + (next[1] - previous[1]) * t]);
    }
  }
  return points;
}

function ticksAlong(line: readonly LngLat[], spacingM: number, halfM: number): LngLat[][] {
  const ticks: LngLat[][] = [];
  let since = spacingM;
  for (let i = 1; i < line.length; i++) {
    const previous = line[i - 1];
    const next = line[i];
    if (!previous || !next) continue;
    const span = metersBetween(previous, next);
    if (span === 0) continue;
    let walked = 0;
    while (since + (span - walked) >= spacingM) {
      const need = spacingM - since;
      walked += need;
      since = 0;
      const t = walked / span;
      const at: LngLat = [previous[0] + (next[0] - previous[0]) * t, previous[1] + (next[1] - previous[1]) * t];
      ticks.push(perpendicular(at, bearingDeg(previous, next), halfM));
    }
    since += span - walked;
  }
  return ticks;
}

function perpendicular(at: LngLat, bearing: number, halfM: number): [LngLat, LngLat] {
  const radians = ((bearing + 90) * Math.PI) / 180;
  const east = Math.sin(radians) * halfM;
  const north = Math.cos(radians) * halfM;
  const lon = metersPerDegLon(at[1]);
  return [
    [at[0] - east / lon, at[1] - north / METERS_PER_DEG_LAT],
    [at[0] + east / lon, at[1] + north / METERS_PER_DEG_LAT],
  ];
}

function expand(bounds: [number, number, number, number] | null, bufferM: number): [number, number, number, number] | null {
  if (!bounds) return null;
  const lat = (bounds[1] + bounds[3]) / 2;
  const dLat = bufferM / METERS_PER_DEG_LAT;
  const dLon = bufferM / metersPerDegLon(lat);
  return [bounds[0] - dLon, bounds[1] - dLat, bounds[2] + dLon, bounds[3] + dLat];
}

function ringHits(ring: readonly LngLat[], bounds: [number, number, number, number]): boolean {
  return ring.some((point) => point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3]);
}

function distanceToLine(point: LngLat, line: readonly LngLat[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    best = Math.min(best, distanceToSegment(point, a, b));
  }
  return best;
}

function distanceToSegment(point: LngLat, a: LngLat, b: LngLat): number {
  const ab = metersBetween(a, b);
  if (ab === 0) return metersBetween(point, a);
  const ax = (b[0] - a[0]) * metersPerDegLon(a[1]);
  const ay = (b[1] - a[1]) * METERS_PER_DEG_LAT;
  const px = (point[0] - a[0]) * metersPerDegLon(a[1]);
  const py = (point[1] - a[1]) * METERS_PER_DEG_LAT;
  const t = Math.min(1, Math.max(0, (px * ax + py * ay) / (ax * ax + ay * ay)));
  const east = px - ax * t;
  const north = py - ay * t;
  return Math.hypot(east, north);
}

function lengthM(route: readonly LngLat[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const previous = route[i - 1];
    const next = route[i];
    if (previous && next) total += metersBetween(previous, next);
  }
  return total;
}

function metersBetween(a: LngLat, b: LngLat): number {
  const east = (b[0] - a[0]) * metersPerDegLon((a[1] + b[1]) / 2);
  const north = (b[1] - a[1]) * METERS_PER_DEG_LAT;
  return Math.hypot(east, north);
}

function metersPerDegLon(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function bearingDeg(from: LngLat, to: LngLat): number {
  const east = (to[0] - from[0]) * metersPerDegLon(from[1]);
  const north = (to[1] - from[1]) * METERS_PER_DEG_LAT;
  const degrees = (Math.atan2(east, north) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}
