import {
  ATTRIBUTION,
  HEIGHT_SOURCES,
  type Building,
  type GraphFile,
  type HeightSource,
  type LngLat,
  type SunTile,
  type TileManifest,
} from "@shadeway/contract";
import { loadCorridor } from "@shadeway/router";

export interface PilotPlace {
  readonly name: string;
  readonly at: LngLat;
}

export interface PilotData {
  readonly manifest: TileManifest;
  readonly graph: GraphFile;
  readonly tiles: readonly SunTile[];
  readonly buildings: readonly Building[];
  readonly roads: readonly (readonly LngLat[])[];
  readonly places: readonly PilotPlace[];
  readonly attribution: readonly string[];
}

export class PilotDataMissing extends Error {
  constructor() {
    super("Pilot data is not built. pnpm --filter @shadeway/pipeline build:pilot");
    this.name = "PilotDataMissing";
  }
}

export async function loadPilot(dataUrl = "/data/bgc/", fetchImpl: typeof fetch = fetch): Promise<PilotData> {
  const base = dataUrl.endsWith("/") ? dataUrl : `${dataUrl}/`;
  const manifest = await readJson<TileManifest>(fetchImpl, `${base}manifest.json`);
  const basemap = await readJson<Basemap>(fetchImpl, `${base}basemap.geojson`);
  const places = await readPlaces(fetchImpl, `${base}places.json`);
  const { graph, tiles } = await loadCorridor(manifest, manifest.bbox, async (relativePath) => {
    const response = await fetchImpl(`${base}${relativePath}`);
    if (!response.ok) throw new PilotDataMissing();
    return new Uint8Array(await response.arrayBuffer());
  });
  const buildings: Building[] = [];
  const roads: LngLat[][] = [];
  for (const feature of basemap.features) {
    if (feature.properties.kind === "edge" && feature.geometry.type === "LineString") {
      const line = lineOf(feature.geometry.coordinates);
      if (line) roads.push(line);
      continue;
    }
    if (feature.properties.kind !== "building" || feature.geometry.type !== "Polygon") continue;
    const ring = openRing(polygonRing(feature.geometry.coordinates));
    const heightM = feature.properties.heightM;
    if (!ring || ring.length < 3 || typeof heightM !== "number") continue;
    buildings.push({
      id: String(feature.properties.id),
      footprint: ring,
      heightM,
      heightSource: heightSourceOf(feature.properties.heightSource),
    });
  }
  return {
    manifest,
    graph,
    tiles,
    buildings,
    roads,
    places,
    attribution: manifest.attribution.length > 0 ? manifest.attribution : ATTRIBUTION,
  };
}

async function readPlaces(fetchImpl: typeof fetch, url: string): Promise<PilotPlace[]> {
  try {
    const file = await readJson<unknown>(fetchImpl, url);
    if (typeof file !== "object" || file === null || !("places" in file) || !Array.isArray(file.places)) return [];
    const places: PilotPlace[] = [];
    for (const item of file.places) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as { name?: unknown; at?: unknown };
      if (typeof record.name !== "string" || !Array.isArray(record.at)) continue;
      const lng = record.at[0];
      const lat = record.at[1];
      if (typeof lng !== "number" || typeof lat !== "number") continue;
      places.push({ name: record.name, at: [lng, lat] });
    }
    return places;
  } catch (error) {
    if (error instanceof PilotDataMissing) return [];
    throw error;
  }
}

function lineOf(coordinates: unknown): LngLat[] | null {
  if (!Array.isArray(coordinates)) return null;
  const line: LngLat[] = [];
  for (const point of coordinates) {
    if (!Array.isArray(point) || typeof point[0] !== "number" || typeof point[1] !== "number") return null;
    line.push([point[0], point[1]]);
  }
  return line.length >= 2 ? line : null;
}

function polygonRing(coordinates: unknown): LngLat[] | null {
  if (!Array.isArray(coordinates)) return null;
  return lineOf(coordinates[0]);
}

function heightSourceOf(value: unknown): HeightSource {
  if (typeof value === "string" && (HEIGHT_SOURCES as readonly string[]).includes(value)) return value as HeightSource;
  return "default";
}

function openRing(ring: readonly LngLat[] | null): LngLat[] | null {
  if (ring === null || ring.length < 4) return null;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return null;
  const opened = first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : [...ring];
  return opened.length >= 3 ? opened : null;
}

async function readJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch {
    throw new PilotDataMissing();
  }
  if (!response.ok) throw new PilotDataMissing();
  return (await response.json()) as T;
}

interface Basemap {
  readonly features: readonly BasemapFeature[];
}

interface BasemapFeature {
  readonly properties: {
    readonly kind?: string;
    readonly id?: string | number;
    readonly heightM?: number;
    readonly heightSource?: string;
  };
  readonly geometry: {
    readonly type: string;
    readonly coordinates: unknown;
  };
}
