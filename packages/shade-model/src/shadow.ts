import {
  isEstimatedHeight,
  type Building,
  type Edge,
  type LngLat,
  type ShadowPolygon,
  type SunPosition,
  type TreeCaster,
} from "@shadeway/contract";

const EARTH_EQUATOR_M = 6378137;
const METERS_PER_DEG_LAT = (Math.PI * EARTH_EQUATOR_M) / 180;

interface Local {
  readonly x: number;
  readonly y: number;
}

function metersPerDegLon(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

function toLocal(origin: LngLat, point: LngLat): Local {
  return {
    x: (point[0] - origin[0]) * metersPerDegLon(origin[1]),
    y: (point[1] - origin[1]) * METERS_PER_DEG_LAT,
  };
}

function fromLocal(origin: LngLat, point: Local): LngLat {
  return [origin[0] + point.x / metersPerDegLon(origin[1]), origin[1] + point.y / METERS_PER_DEG_LAT];
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function round6(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

function pointKey(point: Local): string {
  return `${round6(point.x)},${round6(point.y)}`;
}

function parseKey(key: string): Local {
  const [xs, ys] = key.split(",");
  return { x: Number(xs), y: Number(ys) };
}

function signedArea(ring: readonly Local[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (current === undefined || next === undefined) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function cleanLngRing(ring: readonly LngLat[]): LngLat[] {
  const cleaned: LngLat[] = [];
  for (const point of ring) {
    const prev = cleaned[cleaned.length - 1];
    if (prev !== undefined && prev[0] === point[0] && prev[1] === point[1]) continue;
    cleaned.push(point);
  }
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (cleaned.length > 1 && first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]) {
    cleaned.pop();
  }
  return cleaned;
}

function sunUp(sun: SunPosition): boolean {
  return Number.isFinite(sun.azimuthDeg) && sun.elevationDeg > 0 && sun.elevationDeg < 90;
}

function shadowOffset(heightM: number, sun: SunPosition): Local {
  const length = heightM / Math.tan((sun.elevationDeg * Math.PI) / 180);
  const shadowAzimuth = ((sun.azimuthDeg + 180) * Math.PI) / 180;
  return { x: length * Math.sin(shadowAzimuth), y: length * Math.cos(shadowAzimuth) };
}

function onSegment(a: Local, b: Local, point: Local): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - 1e-8 &&
    point.x <= Math.max(a.x, b.x) + 1e-8 &&
    point.y >= Math.min(a.y, b.y) - 1e-8 &&
    point.y <= Math.max(a.y, b.y) + 1e-8
  );
}

function properIntersection(a: Local, b: Local, c: Local, d: Local): Local | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const den = cross(abx, aby, cdx, cdy);
  if (Math.abs(den) <= 1e-12) return null;
  const t = cross(c.x - a.x, c.y - a.y, cdx, cdy) / den;
  const u = cross(c.x - a.x, c.y - a.y, abx, aby) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: a.x + t * abx, y: a.y + t * aby };
}

function sweep(footprint: readonly Local[], vx: number, vy: number): Local[] {
  if (footprint.length < 3) return [...footprint];
  if (Math.hypot(vx, vy) < 1e-9) return [...footprint];

  const shifted = footprint.map((point) => ({ x: point.x + vx, y: point.y + vy }));
  const segments: Array<[Local, Local]> = [];
  const addRing = (ring: readonly Local[]) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a === undefined || b === undefined) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-12) segments.push([a, b]);
    }
  };
  addRing(footprint);
  addRing(shifted);
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const b = shifted[i];
    if (a !== undefined && b !== undefined) segments.push([a, b]);
  }

  const splits: Local[][] = segments.map(([a, b]) => [a, b]);
  for (let i = 0; i < segments.length; i++) {
    const left = segments[i];
    const into = splits[i];
    if (left === undefined || into === undefined) continue;
    const [a, b] = left;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abLen = Math.hypot(abx, aby) || 1;
    for (let j = i + 1; j < segments.length; j++) {
      const right = segments[j];
      const intoRight = splits[j];
      if (right === undefined || intoRight === undefined) continue;
      const [c, d] = right;
      const hit = properIntersection(a, b, c, d);
      if (hit !== null) {
        into.push(hit);
        intoRight.push(hit);
        continue;
      }
      const cdx = d.x - c.x;
      const cdy = d.y - c.y;
      const cdLen = Math.hypot(cdx, cdy) || 1;
      if (Math.abs(cross(abx, aby, cdx, cdy)) > 1e-8 * abLen * cdLen) continue;
      for (const point of [c, d]) {
        if (Math.abs(cross(abx, aby, point.x - a.x, point.y - a.y)) <= 1e-7 * abLen && onSegment(a, b, point)) {
          into.push(point);
        }
      }
      for (const point of [a, b]) {
        if (Math.abs(cross(cdx, cdy, point.x - c.x, point.y - c.y)) <= 1e-7 * cdLen && onSegment(c, d, point)) {
          intoRight.push(point);
        }
      }
    }
  }

  const points = new Map<string, Local>();
  const neighbors = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    let from = neighbors.get(a);
    if (from === undefined) {
      from = new Set();
      neighbors.set(a, from);
    }
    from.add(b);
    let to = neighbors.get(b);
    if (to === undefined) {
      to = new Set();
      neighbors.set(b, to);
    }
    to.add(a);
  };
  for (const group of splits) {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const point of group) {
      const key = pointKey(point);
      if (seen.has(key)) continue;
      seen.add(key);
      points.set(key, parseKey(key));
      keys.push(key);
    }
    if (keys.length < 2) continue;
    const sorted = [...keys].sort();
    const origin = points.get(sorted[0] ?? "");
    const end = points.get(sorted[sorted.length - 1] ?? "");
    if (origin === undefined || end === undefined) continue;
    const dx = end.x - origin.x;
    const dy = end.y - origin.y;
    sorted.sort((a, b) => {
      const pa = points.get(a);
      const pb = points.get(b);
      if (pa === undefined || pb === undefined) return 0;
      return (pa.x - origin.x) * dx + (pa.y - origin.y) * dy - ((pb.x - origin.x) * dx + (pb.y - origin.y) * dy);
    });
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a !== undefined && b !== undefined) link(a, b);
    }
  }

  let startKey = "";
  let start: Local | null = null;
  for (const [key, point] of points) {
    if (start === null || point.x < start.x || (point.x === start.x && point.y < start.y)) {
      start = point;
      startKey = key;
    }
  }
  if (start === null) return [...footprint];
  const startNeighbors = neighbors.get(startKey);
  if (startNeighbors === undefined || startNeighbors.size === 0) return [...footprint];

  const angle = (from: Local, toKey: string) => {
    const to = points.get(toKey);
    if (to === undefined) return 0;
    return Math.atan2(to.y - from.y, to.x - from.x);
  };
  let currentKey = [...startNeighbors].sort((a, b) => angle(start, a) - angle(start, b) || a.localeCompare(b))[0];
  if (currentKey === undefined) return [...footprint];

  const ring: Local[] = [start];
  let prevKey = startKey;
  const seenSteps = new Set<string>();
  for (let guard = 0; guard < 10000 && currentKey !== startKey; guard++) {
    const current = points.get(currentKey);
    if (current === undefined) break;
    ring.push(current);
    const options = neighbors.get(currentKey);
    if (options === undefined) break;
    const reverse = Math.atan2(parseKey(prevKey).y - current.y, parseKey(prevKey).x - current.x);
    let best: string | null = null;
    let bestDelta = -1;
    for (const next of options) {
      const nextPoint = points.get(next);
      if (nextPoint === undefined) continue;
      const nextAngle = Math.atan2(nextPoint.y - current.y, nextPoint.x - current.x);
      const delta = (reverse - nextAngle + Math.PI * 2) % (Math.PI * 2);
      if (delta < 1e-9) continue;
      if (delta > bestDelta) {
        bestDelta = delta;
        best = next;
      }
    }
    const stepTo = best ?? prevKey;
    const step = `${currentKey}>${stepTo}`;
    if (seenSteps.has(step)) break;
    seenSteps.add(step);
    prevKey = currentKey;
    currentKey = stepTo;
  }

  const deduped: Local[] = [];
  for (const point of ring) {
    const prev = deduped[deduped.length - 1];
    if (prev !== undefined && prev.x === point.x && prev.y === point.y) continue;
    deduped.push(point);
  }
  if (deduped.length >= 3 && signedArea(deduped) < 0) deduped.reverse();
  return deduped.length >= 3 ? deduped : [...footprint];
}

function pointInRing(ring: readonly Local[], x: number, y: number): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    if ((a.x + t * dx - x) ** 2 + (a.y + t * dy - y) ** 2 < 1e-8) return true;
  }
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    if (current === undefined || previous === undefined) continue;
    const crosses = (current.y > y) !== (previous.y > y);
    if (!crosses) continue;
    const xAt = ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y) + current.x;
    if (x < xAt) inside = !inside;
  }
  return inside;
}

function shadowRing(footprint: readonly LngLat[], offset: Local): LngLat[] {
  const origin = footprint[0];
  if (origin === undefined) return [];
  let local = footprint.map((point) => toLocal(origin, point));
  if (signedArea(local) < 0) local = local.reverse();
  return sweep(local, offset.x, offset.y).map((point) => fromLocal(origin, point));
}

export function shadowPolygons(buildings: readonly Building[], sun: SunPosition): ShadowPolygon[] {
  if (!sunUp(sun)) return [];
  return buildings.map((building) => {
    const footprint = cleanLngRing(building.footprint);
    const height = building.heightM;
    const offset = Number.isFinite(height) && height > 0 ? shadowOffset(height, sun) : { x: 0, y: 0 };
    return {
      buildingId: building.id,
      ring: shadowRing(footprint, offset),
      estimated: isEstimatedHeight(building.heightSource),
      kind: "building" as const,
    };
  });
}

export function treeShadowPolygons(trees: readonly TreeCaster[], sun: SunPosition): ShadowPolygon[] {
  if (!sunUp(sun)) return [];
  return trees.flatMap((tree) => {
    const footprint = cleanLngRing(tree.footprint);
    if (footprint.length < 3) return [];
    const height = tree.crownHeightM;
    const offset = Number.isFinite(height) && height > 0 ? shadowOffset(height, sun) : { x: 0, y: 0 };
    const ring = shadowRing(footprint, offset);
    if (ring.length < 3) return [];
    const transmittance = clamp01(tree.transmittance);
    return [
      {
        buildingId: tree.id,
        ring,
        estimated: true,
        kind: "tree" as const,
        transmittance,
      },
    ];
  });
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function pointInsideShadow(point: LngLat, shadow: ShadowPolygon): boolean {
  if (shadow.ring.length < 3) return false;
  const origin = shadow.ring[0];
  if (origin === undefined) return false;
  const local = shadow.ring.map((vertex) => toLocal(origin, vertex));
  const query = toLocal(origin, point);
  return pointInRing(local, query.x, query.y);
}

export function pointSunFraction(point: LngLat, shadows: readonly ShadowPolygon[]): number {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return 1;
  let sun = 1;
  for (const shadow of shadows) {
    if (!pointInsideShadow(point, shadow)) continue;
    if (shadow.kind === "tree") {
      sun = Math.min(sun, shadow.transmittance ?? 0);
      continue;
    }
    return 0;
  }
  return sun;
}

export function isInShadow(point: LngLat, shadows: readonly ShadowPolygon[]): boolean {
  return pointSunFraction(point, shadows) < 0.5;
}

function parameterOnSegment(a: Local, b: Local, c: Local, d: Local): number | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const den = cross(abx, aby, cdx, cdy);
  if (Math.abs(den) <= 1e-12) return null;
  const t = cross(c.x - a.x, c.y - a.y, cdx, cdy) / den;
  const u = cross(c.x - a.x, c.y - a.y, abx, aby) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return Math.min(1, Math.max(0, t));
}

function shadedLength(a: Local, b: Local, rings: readonly (readonly Local[])[]): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return 0;
  const parameters = [0, 1];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i];
      const d = ring[(i + 1) % ring.length];
      if (c === undefined || d === undefined) continue;
      const t = parameterOnSegment(a, b, c, d);
      if (t !== null) parameters.push(t);
    }
  }
  parameters.sort((p, q) => p - q);
  let shaded = 0;
  let previous = 0;
  for (const t of parameters) {
    if (t - previous < 1e-10) continue;
    const mid = (previous + t) / 2;
    const x = a.x + (b.x - a.x) * mid;
    const y = a.y + (b.y - a.y) * mid;
    if (rings.some((ring) => pointInRing(ring, x, y))) shaded += (t - previous) * length;
    previous = t;
  }
  return shaded;
}

export function edgeSunFraction(edge: Edge, shadows: readonly ShadowPolygon[], sun: SunPosition): number | null {
  if (!sunUp(sun) || edge.geometry.length < 2) return null;
  const origin = edge.geometry[0];
  if (origin === undefined) return null;
  const line = edge.geometry.map((point) => toLocal(origin, point));
  if (line.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  const treeShadows = shadows.filter((shadow) => shadow.kind === "tree");
  if (treeShadows.length === 0) {
    const buildingShadows = shadows.filter((shadow) => shadow.kind !== "tree");
    const rings = buildingShadows
      .filter((shadow) => shadow.ring.length >= 3)
      .map((shadow) => shadow.ring.map((point) => toLocal(origin, point)));
    let total = 0;
    let sunLength = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (a === undefined || b === undefined) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length === 0) continue;
      total += length;
      sunLength += length - shadedLength(a, b, rings);
    }
    if (!(total > 0)) return null;
    return Math.min(1, Math.max(0, sunLength / total));
  }
  let total = 0;
  let sunLength = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    if (a === undefined || b === undefined) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    total += length;
    const samples = Math.max(4, Math.ceil(length / 2));
    for (let s = 0; s < samples; s += 1) {
      const t0 = s / samples;
      const t1 = (s + 1) / samples;
      const span = (t1 - t0) * length;
      const mid = (t0 + t1) / 2;
      const x = a.x + (b.x - a.x) * mid;
      const y = a.y + (b.y - a.y) * mid;
      sunLength += span * pointSunFraction(fromLocal(origin, { x, y }), shadows);
    }
  }
  if (!(total > 0)) return null;
  return Math.min(1, Math.max(0, sunLength / total));
}

export function transmittance(point: LngLat): number {
  void point;
  return 1;
}
