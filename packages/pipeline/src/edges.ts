export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type OsmNode = {
  id: number;
  lon: number;
  lat: number;
};

export type OsmWay = {
  id: number;
  tags: Record<string, string>;
  nodes: OsmNode[];
};

const FOOT_HIGHWAYS = new Set([
  "footway",
  "sidewalk",
  "pedestrian",
  "path",
  "steps",
  "crossing",
  "corridor",
]);

export type EdgeCounts = {
  footpathEdges: number;
  coveredEdges: number;
  pedestrianBridgeEdges: number;
};

export function isFootpathWay(way: OsmWay): boolean {
  const highway = way.tags.highway;
  if (highway === undefined || !FOOT_HIGHWAYS.has(highway)) return false;
  if (way.tags.access === "private" || way.tags.access === "no") return false;
  if (way.tags.area === "yes") return false;
  return way.nodes.length >= 2;
}

function pointInBox(lon: number, lat: number, box: BBox): boolean {
  return lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north;
}

function segmentHitsBox(a: OsmNode, b: OsmNode, box: BBox): boolean {
  if (pointInBox(a.lon, a.lat, box) || pointInBox(b.lon, b.lat, box)) return true;
  let t0 = 0;
  let t1 = 1;
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, a.lon - box.west) &&
    clip(dx, box.east - a.lon) &&
    clip(-dy, a.lat - box.south) &&
    clip(dy, box.north - a.lat) &&
    t0 <= t1
  );
}

export type FootpathPiece = {
  osmWayId: number;
  tags: Record<string, string>;
  nodes: OsmNode[];
};

export function footpathPieces(ways: OsmWay[], box: BBox): FootpathPiece[] {
  const foot = ways.filter(isFootpathWay);
  const degree = new Map<number, number>();
  const hitting: { wayIndex: number; a: number; b: number }[] = [];
  foot.forEach((way, wayIndex) => {
    for (let i = 0; i < way.nodes.length - 1; i += 1) {
      const a = way.nodes[i];
      const b = way.nodes[i + 1];
      if (a === undefined || b === undefined || a.id === b.id) continue;
      if (!segmentHitsBox(a, b, box)) continue;
      degree.set(a.id, (degree.get(a.id) ?? 0) + 1);
      degree.set(b.id, (degree.get(b.id) ?? 0) + 1);
      hitting.push({ wayIndex, a: i, b: i + 1 });
    }
  });

  const byWay = new Map<number, { a: number; b: number }[]>();
  for (const segment of hitting) {
    const list = byWay.get(segment.wayIndex) ?? [];
    list.push({ a: segment.a, b: segment.b });
    byWay.set(segment.wayIndex, list);
  }

  const pieces: FootpathPiece[] = [];
  for (const [wayIndex, segments] of byWay) {
    const way = foot[wayIndex];
    if (way === undefined) continue;
    let current: OsmNode[] | undefined;
    let previousEnd = -1;
    const close = () => {
      if (current !== undefined && current.length >= 2) {
        pieces.push({ osmWayId: way.id, tags: way.tags, nodes: current });
      }
      current = undefined;
    };
    for (const segment of segments) {
      if (current === undefined || segment.a !== previousEnd) {
        close();
        const start = way.nodes[segment.a];
        current = start === undefined ? [] : [start];
      }
      const end = way.nodes[segment.b];
      if (end === undefined) continue;
      current?.push(end);
      if ((degree.get(end.id) ?? 0) !== 2) close();
      previousEnd = segment.b;
    }
    close();
  }
  return pieces;
}

export function countFootpathEdges(ways: OsmWay[], box: BBox): EdgeCounts {
  let coveredEdges = 0;
  let pedestrianBridgeEdges = 0;
  const pieces = footpathPieces(ways, box);
  for (const piece of pieces) {
    if (piece.tags.covered === "yes") coveredEdges += 1;
    const bridge = piece.tags.bridge;
    if (bridge !== undefined && bridge !== "no" && bridge !== "false") pedestrianBridgeEdges += 1;
  }
  return { footpathEdges: pieces.length, coveredEdges, pedestrianBridgeEdges };
}
