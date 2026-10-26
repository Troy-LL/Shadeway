import type { BBox, OsmWay } from "./edges.js";
import { overpassEndpoints } from "./config.js";

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
};

type OverpassPayload = {
  osm3s?: { timestamp_osm_base?: string };
  elements: OverpassElement[];
};

export type OsmExtract = {
  endpoint: string;
  osmTimestamp: string;
  ways: OsmWay[];
  treePoints: number;
};

export function readOverpass(payload: OverpassPayload): { ways: OsmWay[]; treePoints: number } {
  const coords = new Map<number, { lon: number; lat: number }>();
  const trees = new Set<number>();
  for (const element of payload.elements) {
    if (element.type !== "node" || element.lon === undefined || element.lat === undefined) continue;
    coords.set(element.id, { lon: element.lon, lat: element.lat });
    if (element.tags?.natural === "tree") trees.add(element.id);
  }
  const treePoints = trees.size;
  const ways: OsmWay[] = [];
  for (const element of payload.elements) {
    if (element.type !== "way" || element.nodes === undefined) continue;
    const nodes = [];
    for (const id of element.nodes) {
      const point = coords.get(id);
      if (point === undefined) continue;
      nodes.push({ id, lon: point.lon, lat: point.lat });
    }
    ways.push({ id: element.id, tags: element.tags ?? {}, nodes });
  }
  return { ways, treePoints };
}

export async function fetchOsm(box: BBox): Promise<OsmExtract> {
  const query = `[out:json][timeout:180];
(
  way["highway"~"^(footway|pedestrian|path|steps|sidewalk|crossing|corridor)$"](${box.south},${box.west},${box.north},${box.east});
  node["natural"="tree"](${box.south},${box.west},${box.north},${box.east});
);
out body;
>;
out skel qt;`;
  const payload = await overpass(query);
  const parsed = readOverpass(payload);
  return {
    endpoint: payload.endpoint,
    osmTimestamp: payload.osm3s?.timestamp_osm_base ?? "unknown",
    ways: parsed.ways,
    treePoints: parsed.treePoints,
  };
}

export async function fetchNamedPlaces(box: BBox): Promise<{ name: string; lon: number; lat: number }[]> {
  const query = `[out:json][timeout:90];
(
  node["name"]["amenity"](${box.south},${box.west},${box.north},${box.east});
  node["name"]["shop"](${box.south},${box.west},${box.north},${box.east});
  node["name"]["tourism"](${box.south},${box.west},${box.north},${box.east});
  node["name"]["leisure"](${box.south},${box.west},${box.north},${box.east});
);
out body;`;
  const payload = await overpass(query);
  const places = [];
  for (const element of payload.elements) {
    const name = element.tags?.name?.trim();
    if (element.type !== "node" || !name || element.lon === undefined || element.lat === undefined) continue;
    places.push({ name, lon: element.lon, lat: element.lat });
  }
  return places;
}

async function overpass(query: string): Promise<OverpassPayload & { endpoint: string }> {
  const errors: string[] = [];
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "shadeway-measure/0.1",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) {
        errors.push(`${endpoint} HTTP ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as OverpassPayload;
      return { ...payload, endpoint };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint} ${message}`);
    }
  }
  throw new Error(errors.join("; "));
}
