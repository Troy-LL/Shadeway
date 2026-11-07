/** Longitude then latitude, WGS84 degrees, the GeoJSON order. */
export type LngLat = readonly [lng: number, lat: number];

/** Polygon outer ring, counterclockwise, first vertex not repeated at the end. */
export type Ring = readonly LngLat[];

/** West, south, east, north in WGS84 degrees. */
export type BBox = readonly [west: number, south: number, east: number, north: number];

/** Calendar date in Asia/Manila, `YYYY-MM-DD`. */
export type LocalDate = string;

/** A moment in Asia/Manila local time. */
export interface LocalDateTime {
  readonly date: LocalDate;
  /** Minutes since local midnight, 0 to 1439, fractions allowed. */
  readonly minutes: number;
}

export interface SlotGrid {
  readonly timeZone: "Asia/Manila";
  /** Manila has no daylight saving time, so the offset is fixed. */
  readonly utcOffsetMinutes: 480;
  readonly startMinutes: number;
  readonly stepMinutes: number;
  readonly count: number;
}

/** 30 minute slots from 06:00 to 18:00 local, 25 slots, per decision 001. */
export const SLOT_GRID: SlotGrid = {
  timeZone: "Asia/Manila",
  utcOffsetMinutes: 480,
  startMinutes: 6 * 60,
  stepMinutes: 30,
  count: 25,
};

/** Integer from 0 to `SLOT_GRID.count - 1`. Slot `i` is the instant `startMinutes + i * stepMinutes`. */
export type SlotIndex = number;

export function isSlotIndex(value: number): value is SlotIndex {
  return Number.isInteger(value) && value >= 0 && value < SLOT_GRID.count;
}

/** Local minutes since midnight at which the slot is sampled. */
export function slotStartMinutes(slot: SlotIndex): number {
  if (!isSlotIndex(slot)) throw new RangeError(`slot out of range: ${slot}`);
  return SLOT_GRID.startMinutes + slot * SLOT_GRID.stepMinutes;
}

/**
 * Nearest slot to a local time, or null outside 06:00 to 18:00.
 * Ties round to the later slot.
 */
export function nearestSlot(minutes: number): SlotIndex | null {
  const offset = (minutes - SLOT_GRID.startMinutes) / SLOT_GRID.stepMinutes;
  if (!Number.isFinite(offset) || offset < 0 || offset > SLOT_GRID.count - 1) return null;
  return Math.round(offset);
}

export const REFERENCE_DAYS = ["march-equinox", "june-solstice", "december-solstice"] as const;
export type ReferenceDay = (typeof REFERENCE_DAYS)[number];

/**
 * A date mapped onto the reference days by solar declination.
 * A value for this date is `(1 - t) * value(from) + t * value(to)`.
 */
export interface SunDay {
  readonly date: LocalDate;
  readonly declinationDeg: number;
  readonly from: ReferenceDay;
  readonly to: ReferenceDay;
  /** 0 to 1, weight on `to`. */
  readonly t: number;
}

export interface SunPosition {
  /** Degrees clockwise from true north, 0 to 360. */
  readonly azimuthDeg: number;
  /** Degrees above the horizon, negative below it. */
  readonly elevationDeg: number;
}

export const HEIGHT_SOURCES = ["osm", "levels", "raster", "default", "override"] as const;
export type HeightSource = (typeof HEIGHT_SOURCES)[number];

/**
 * Map attribution, one list, decision 004.
 * ODbL for OpenStreetMap and Overture. CC BY 4.0 for Google Open Buildings heights.
 */
export const ATTRIBUTION = [
  "OpenStreetMap contributors, ODbL",
  "Overture Maps Foundation buildings, ODbL",
  "Google Open Buildings 2.5D Temporal, CC BY 4.0",
  "Meta and WRI 1 m canopy height, CC BY 4.0",
  "Source imagery for CHM © 2016 Maxar",
] as const;

/** Any height not from an OSM `height` tag is an estimate and is drawn with a dashed shadow edge. */
export function isEstimatedHeight(source: HeightSource): boolean {
  return source !== "osm";
}

/** Raw height evidence for one building, before the decision 004 chain picks one. */
export interface HeightInput {
  /** OSM `height` tag in meters. */
  readonly heightTagM?: number;
  /** OSM `building:levels`. */
  readonly levels?: number;
  /** Google 2.5D Temporal raster height in meters. */
  readonly rasterHeightM?: number;
}

export interface BuildingHeight {
  readonly heightM: number;
  readonly heightSource: HeightSource;
}

export interface Building extends BuildingHeight {
  readonly id: string;
  readonly footprint: Ring;
}

/** A tree crown that casts a partial shadow, per decision 001. */
export interface TreeCaster {
  readonly id: string;
  readonly footprint: Ring;
  /** Canopy height above the ground in meters. */
  readonly crownHeightM: number;
  /** Direct sun fraction under the crown shadow, 0 to 1. */
  readonly transmittance: number;
}

export type ShadowCasterKind = "building" | "tree";

export interface ShadowPolygon {
  readonly buildingId: string;
  readonly ring: Ring;
  /** True when the casting building's height is an estimate. */
  readonly estimated: boolean;
  readonly kind?: ShadowCasterKind;
  /** Tree crowns only. Direct sun fraction inside the shadow polygon. */
  readonly transmittance?: number;
}

/** Integer from 0 to 2^32 - 1. */
export type NodeId = number;
/** Integer from 0 to 2^32 - 1, unique within an area. */
export type EdgeId = number;

export interface Edge {
  readonly id: EdgeId;
  readonly from: NodeId;
  readonly to: NodeId;
  readonly lengthM: number;
  /** From `from` to `to`, at least two points. */
  readonly geometry: readonly LngLat[];
  /** OSM `covered=yes` or a covered override. */
  readonly covered: boolean;
  /** OSM pedestrian `bridge` or a bridge override. */
  readonly bridge: boolean;
  /** Id of the `data/overrides/` entry applied to this edge, if any. */
  readonly overrideId?: string;
}

export interface GraphFile {
  readonly version: 1;
  readonly area: string;
  readonly edges: readonly Edge[];
}

export interface TileRef {
  readonly id: string;
  readonly bbox: BBox;
  readonly edgeCount: number;
  /** Tile file path per reference day, relative to the manifest. */
  readonly files: Readonly<Record<ReferenceDay, string>>;
}

export interface TileManifest {
  readonly version: 1;
  readonly area: string;
  readonly bbox: BBox;
  /** ISO 8601 UTC timestamp. */
  readonly builtAt: string;
  readonly slotGrid: SlotGrid;
  /** The calendar date each reference day was computed for. */
  readonly referenceDates: Readonly<Record<ReferenceDay, LocalDate>>;
  /** Graph file path, relative to the manifest. */
  readonly graph: string;
  readonly tiles: readonly TileRef[];
  /** Attribution strings the map must show, per decision 004. */
  readonly attribution: readonly string[];
  /** True when tiles include tree canopy shade. */
  readonly canopy?: boolean;
}

export const ROUTE_WEIGHTS = ["fastest", "balanced", "shadiest"] as const;
export type RouteWeight = (typeof ROUTE_WEIGHTS)[number];

export interface RouteResult {
  readonly weight: RouteWeight;
  readonly departure: LocalDateTime;
  readonly edgeIds: readonly EdgeId[];
  readonly geometry: readonly LngLat[];
  readonly distanceM: number;
  readonly durationS: number;
  /** Walking seconds in direct sun, summed over edges with a value. */
  readonly sunSeconds: number;
  /** Walking seconds on edges whose tile byte is no data. */
  readonly noDataSeconds: number;
}

/**
 * The shade functions `packages/shade-model` exports as one object.
 * The pipeline, router inputs, and map shadows all come from these, per decision 001.
 */
export interface ShadeModel {
  /** Declination and reference-day blend for a date. */
  sunDay(date: LocalDate): SunDay;
  sunPosition(at: LocalDateTime, location: LngLat): SunPosition;
  /** Sun position used for tile values of a reference day and slot. */
  referenceSunPosition(day: ReferenceDay, slot: SlotIndex, location: LngLat): SunPosition;
  /** Applies the decision 004 height chain. */
  estimateHeight(input: HeightInput): BuildingHeight;
  /** Each footprint swept along the sun azimuth by height divided by tan(elevation). */
  shadowPolygons(buildings: readonly Building[], sun: SunPosition): ShadowPolygon[];
  /** Tree crown shadows with partial transmittance under the polygon. */
  treeShadowPolygons(trees: readonly TreeCaster[], sun: SunPosition): ShadowPolygon[];
  isInShadow(point: LngLat, shadows: readonly ShadowPolygon[]): boolean;
  /** Direct sun at a point from shadow polygons, 0 to 1. */
  pointSunFraction(point: LngLat, shadows: readonly ShadowPolygon[]): number;
  /** Canopy light pass-through at a point, 0 to 1. Returns 1 until phase two. */
  transmittance(point: LngLat): number;
  /** Share of the edge in direct sun, 0 to 1, or null when it cannot be computed. */
  edgeSunFraction(edge: Edge, shadows: readonly ShadowPolygon[], sun: SunPosition): number | null;
  /** Blends reference-day sun fractions for a date. Null when a needed value is null. */
  interpolateSunFraction(
    values: Readonly<Record<ReferenceDay, number | null>>,
    day: SunDay,
  ): number | null;
}

/** Byte meaning no data in a sun tile. */
export const NO_DATA_BYTE = 255;
const MAX_FRACTION_BYTE = 254;

/** Sun fraction 0 to 1 scaled to 0 to 254, or null to 255. */
export function encodeSunFraction(fraction: number | null): number {
  if (fraction === null) return NO_DATA_BYTE;
  if (!(fraction >= 0 && fraction <= 1)) throw new RangeError(`sun fraction out of range: ${fraction}`);
  return Math.round(fraction * MAX_FRACTION_BYTE);
}

export function decodeSunFraction(byte: number): number | null {
  if (!Number.isInteger(byte) || byte < 0 || byte > NO_DATA_BYTE) throw new RangeError(`not a byte: ${byte}`);
  return byte === NO_DATA_BYTE ? null : byte / MAX_FRACTION_BYTE;
}

/** Sun bytes for one tile and one reference day. */
export interface SunTile {
  readonly referenceDay: ReferenceDay;
  readonly edgeIds: Uint32Array;
  /** `edgeIds.length * SLOT_GRID.count` bytes, edge-major: edge `e`, slot `s` is at `e * count + s`. */
  readonly sun: Uint8Array;
}

/** Tile file magic, ASCII `SWTL`. */
const TILE_MAGIC = [0x53, 0x57, 0x54, 0x4c] as const;
export const TILE_FORMAT_VERSION = 1;
const TILE_HEADER_BYTES = 12;

export function sunByte(tile: SunTile, edgeIndex: number, slot: SlotIndex): number {
  if (!isSlotIndex(slot)) throw new RangeError(`slot out of range: ${slot}`);
  const byte = tile.sun[edgeIndex * SLOT_GRID.count + slot];
  if (byte === undefined) throw new RangeError(`edge index out of range: ${edgeIndex}`);
  return byte;
}

/**
 * Binary layout, little endian:
 * bytes 0-3 magic `SWTL`, 4 version, 5 slot count, 6 reference day index in `REFERENCE_DAYS`,
 * 7 reserved 0, 8-11 edge count (u32), then edge ids (u32 each), then the sun bytes.
 */
export function encodeSunTile(tile: SunTile): Uint8Array {
  const edgeCount = tile.edgeIds.length;
  if (tile.sun.length !== edgeCount * SLOT_GRID.count) {
    throw new RangeError(`sun has ${tile.sun.length} bytes, expected ${edgeCount * SLOT_GRID.count}`);
  }
  const dayIndex = REFERENCE_DAYS.indexOf(tile.referenceDay);
  if (dayIndex < 0) throw new RangeError(`unknown reference day: ${tile.referenceDay}`);

  const bytes = new Uint8Array(TILE_HEADER_BYTES + edgeCount * 4 + tile.sun.length);
  const view = new DataView(bytes.buffer);
  bytes.set(TILE_MAGIC, 0);
  view.setUint8(4, TILE_FORMAT_VERSION);
  view.setUint8(5, SLOT_GRID.count);
  view.setUint8(6, dayIndex);
  view.setUint32(8, edgeCount, true);
  tile.edgeIds.forEach((id, i) => view.setUint32(TILE_HEADER_BYTES + i * 4, id, true));
  bytes.set(tile.sun, TILE_HEADER_BYTES + edgeCount * 4);
  return bytes;
}

export function decodeSunTile(bytes: Uint8Array): SunTile {
  if (bytes.length < TILE_HEADER_BYTES) throw new RangeError("tile shorter than its header");
  if (TILE_MAGIC.some((b, i) => bytes[i] !== b)) throw new RangeError("not a sun tile");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint8(4);
  if (version !== TILE_FORMAT_VERSION) throw new RangeError(`unsupported tile version: ${version}`);
  const slotCount = view.getUint8(5);
  if (slotCount !== SLOT_GRID.count) throw new RangeError(`tile has ${slotCount} slots, expected ${SLOT_GRID.count}`);
  const referenceDay = REFERENCE_DAYS[view.getUint8(6)];
  if (referenceDay === undefined) throw new RangeError(`unknown reference day index: ${view.getUint8(6)}`);
  const edgeCount = view.getUint32(8, true);
  const sunOffset = TILE_HEADER_BYTES + edgeCount * 4;
  const expected = sunOffset + edgeCount * slotCount;
  if (bytes.length !== expected) throw new RangeError(`tile has ${bytes.length} bytes, expected ${expected}`);

  const edgeIds = new Uint32Array(edgeCount);
  for (let i = 0; i < edgeCount; i++) edgeIds[i] = view.getUint32(TILE_HEADER_BYTES + i * 4, true);
  return { referenceDay, edgeIds, sun: bytes.slice(sunOffset, expected) };
}
