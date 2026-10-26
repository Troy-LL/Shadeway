import { readFile } from "node:fs/promises";

export type HeightOverride = {
  id: string;
  source: string;
  lng: number;
  lat: number;
  heightM: number;
};

export type EdgeOverride = {
  id: string;
  source: string;
  osmWayId: number;
  kind: "covered" | "bridge";
};

export type Overrides = {
  note: string;
  heights: HeightOverride[];
  edges: EdgeOverride[];
};

export async function loadOverrides(path: string): Promise<Overrides> {
  const text = await readFile(path, "utf8");
  return parseOverrides(JSON.parse(text) as unknown);
}

export function parseOverrides(value: unknown): Overrides {
  if (!isRecord(value)) throw new Error("overrides file is not an object");
  if (typeof value.note !== "string") throw new Error("overrides note must be a string");
  if (!Array.isArray(value.heights) || !Array.isArray(value.edges)) {
    throw new Error("overrides heights and edges must be arrays");
  }
  return {
    note: value.note,
    heights: value.heights.map(parseHeight),
    edges: value.edges.map(parseEdge),
  };
}

function parseHeight(value: unknown): HeightOverride {
  if (!isRecord(value)) throw new Error("height override is not an object");
  const id = requireId(value.id);
  const source = requireSource(value.source, id);
  const lng = requireNumber(value.lng, id, "lng");
  const lat = requireNumber(value.lat, id, "lat");
  const heightM = requireNumber(value.heightM, id, "heightM");
  if (!(heightM > 0)) throw new Error(`height override ${id} needs a positive heightM`);
  return { id, source, lng, lat, heightM };
}

function parseEdge(value: unknown): EdgeOverride {
  if (!isRecord(value)) throw new Error("edge override is not an object");
  const id = requireId(value.id);
  const source = requireSource(value.source, id);
  const osmWayId = requireNumber(value.osmWayId, id, "osmWayId");
  if (!Number.isInteger(osmWayId)) throw new Error(`edge override ${id} needs an integer osmWayId`);
  const kind = value.kind;
  if (kind !== "covered" && kind !== "bridge") throw new Error(`edge override ${id} has kind ${String(kind)}`);
  return { id, source, osmWayId, kind };
}

function requireId(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error("override is missing an id");
  return value;
}

function requireSource(value: unknown, id: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`override ${id} is missing a source note`);
  }
  return value;
}

function requireNumber(value: unknown, id: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`override ${id} field ${field} is not a finite number`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
