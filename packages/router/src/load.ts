import {
  REFERENCE_DAYS,
  decodeSunTile,
  type BBox,
  type GraphFile,
  type SunTile,
  type TileManifest,
  type TileRef,
} from "@shadeway/contract";

function intersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function tilesInCorridor(manifest: TileManifest, corridor: BBox): readonly TileRef[] {
  return manifest.tiles.filter((tile) => intersects(tile.bbox, corridor));
}

export function parseGraphFile(bytes: Uint8Array): GraphFile {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isGraphFile(parsed)) throw new RangeError("not a graph file");
  return parsed;
}

function isGraphFile(value: unknown): value is GraphFile {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { version?: unknown; area?: unknown; edges?: unknown };
  return record.version === 1 && typeof record.area === "string" && Array.isArray(record.edges);
}

export async function loadCorridor(
  manifest: TileManifest,
  corridor: BBox,
  read: (relativePath: string) => Promise<Uint8Array>,
): Promise<{ graph: GraphFile; tiles: SunTile[] }> {
  const graph = parseGraphFile(await read(manifest.graph));
  const tiles: SunTile[] = [];
  for (const ref of tilesInCorridor(manifest, corridor)) {
    for (const day of REFERENCE_DAYS) {
      const tile = decodeSunTile(await read(ref.files[day]));
      if (tile.referenceDay !== day) {
        throw new RangeError(`tile ${ref.id} is ${tile.referenceDay}, expected ${day}`);
      }
      tiles.push(tile);
    }
  }
  return { graph, tiles };
}
