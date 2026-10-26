import {
  REFERENCE_DAYS,
  ROUTE_WEIGHTS,
  SLOT_GRID,
  decodeSunFraction,
  nearestSlot,
  type Edge,
  type EdgeId,
  type GraphFile,
  type LocalDateTime,
  type LngLat,
  type NodeId,
  type ReferenceDay,
  type RouteResult,
  type RouteWeight,
  type ShadeModel,
  type SunDay,
  type SunTile,
} from "@shadeway/contract";
import { METERS_PER_SUN_SECOND, walkEdge } from "./cost";
import { shadeStub } from "./shade-stub";

export interface RouteInput {
  readonly graph: GraphFile;
  readonly tiles: readonly SunTile[];
  readonly day: SunDay;
  readonly departure: LocalDateTime;
  readonly start: NodeId;
  readonly end: NodeId;
  readonly shade?: Pick<ShadeModel, "interpolateSunFraction">;
}

interface Label {
  readonly node: NodeId;
  readonly minutes: number;
  readonly cost: number;
  readonly distanceM: number;
  readonly durationS: number;
  readonly sunSeconds: number;
  readonly noDataSeconds: number;
  readonly prev: number;
  readonly via: EdgeId;
}

interface HeapItem {
  readonly f: number;
  readonly label: number;
}

interface Link {
  readonly to: NodeId;
  readonly edge: Edge;
}

interface Prepared {
  readonly input: RouteInput;
  readonly shade: Pick<ShadeModel, "interpolateSunFraction">;
  readonly links: Map<NodeId, Link[]>;
  readonly edges: Map<EdgeId, Edge>;
  readonly positions: Map<NodeId, LngLat>;
  readonly sun: Record<ReferenceDay, Map<EdgeId, { readonly bytes: Uint8Array; readonly index: number }>>;
  readonly blend: Map<number, number | null>;
}

const SLOT_SPAN = SLOT_GRID.count + 1;
const EARTH_RADIUS_M = 6_371_000;

/** Three routes. Cost is decision 001. The slot is the one in effect when the walker reaches the edge. */
export function route(input: RouteInput): Record<RouteWeight, RouteResult | null> {
  const prepared = prepare(input);
  const routes = {} as Record<RouteWeight, RouteResult | null>;
  for (const weight of ROUTE_WEIGHTS) routes[weight] = search(prepared, weight);
  return routes;
}

function prepare(input: RouteInput): Prepared {
  const links = new Map<NodeId, Link[]>();
  const edges = new Map<EdgeId, Edge>();
  const positions = new Map<NodeId, LngLat>();
  for (const edge of input.graph.edges) {
    const list = links.get(edge.from);
    if (list) list.push({ to: edge.to, edge });
    else links.set(edge.from, [{ to: edge.to, edge }]);
    edges.set(edge.id, edge);
    const origin = edge.geometry[0];
    const dest = edge.geometry[edge.geometry.length - 1];
    if (origin && !positions.has(edge.from)) positions.set(edge.from, origin);
    if (dest && !positions.has(edge.to)) positions.set(edge.to, dest);
  }
  const sun = emptySun();
  for (const tile of input.tiles) {
    const day = sun[tile.referenceDay];
    tile.edgeIds.forEach((id, index) => day.set(id, { bytes: tile.sun, index }));
  }
  return {
    input,
    shade: input.shade ?? shadeStub,
    links,
    edges,
    positions,
    sun,
    blend: new Map(),
  };
}

function emptySun(): Prepared["sun"] {
  const sun = {} as Prepared["sun"];
  for (const day of REFERENCE_DAYS) sun[day] = new Map();
  return sun;
}

function search(prepared: Prepared, weight: RouteWeight): RouteResult | null {
  const { input } = prepared;
  if (input.start === input.end) return result(prepared, weight, null);

  const labels: Label[] = [
    {
      node: input.start,
      minutes: input.departure.minutes,
      cost: 0,
      distanceM: 0,
      durationS: 0,
      sunSeconds: 0,
      noDataSeconds: 0,
      prev: -1,
      via: -1,
    },
  ];
  const heap: HeapItem[] = [];
  heapPush(heap, { f: heuristic(prepared, input.start), label: 0 });
  const settled = new Set<number>();
  const metersPerSunSecond = METERS_PER_SUN_SECOND[weight];

  while (heap.length > 0) {
    const item = heapPop(heap);
    if (!item) break;
    const label = labels[item.label];
    if (!label) continue;
    const state = stateKey(label.node, label.minutes);
    if (settled.has(state)) continue;
    settled.add(state);
    if (label.node === input.end) return result(prepared, weight, item.label, labels);

    const links = prepared.links.get(label.node);
    if (!links) continue;
    for (const link of links) {
      const walked = walkEdge(link.edge.lengthM, sunFraction(prepared, link.edge.id, label.minutes), metersPerSunSecond);
      const minutes = label.minutes + walked.durationS / 60;
      if (settled.has(stateKey(link.to, minutes))) continue;
      labels.push({
        node: link.to,
        minutes,
        cost: label.cost + walked.cost,
        distanceM: label.distanceM + link.edge.lengthM,
        durationS: label.durationS + walked.durationS,
        sunSeconds: label.sunSeconds + walked.sunSeconds,
        noDataSeconds: label.noDataSeconds + walked.noDataSeconds,
        prev: item.label,
        via: link.edge.id,
      });
      heapPush(heap, { f: label.cost + walked.cost + heuristic(prepared, link.to), label: labels.length - 1 });
    }
  }
  return null;
}

function result(prepared: Prepared, weight: RouteWeight, labelIndex: number | null, labels: readonly Label[] = []): RouteResult {
  const edgeIds: EdgeId[] = [];
  let cursor = labelIndex;
  let distanceM = 0;
  let durationS = 0;
  let sunSeconds = 0;
  let noDataSeconds = 0;
  if (cursor !== null) {
    const found = labels[cursor];
    if (found) {
      distanceM = found.distanceM;
      durationS = found.durationS;
      sunSeconds = found.sunSeconds;
      noDataSeconds = found.noDataSeconds;
    }
    while (cursor !== null && cursor >= 0) {
      const step: Label | undefined = labels[cursor];
      if (!step || step.via < 0) break;
      edgeIds.push(step.via);
      cursor = step.prev;
    }
    edgeIds.reverse();
  }
  return {
    weight,
    departure: prepared.input.departure,
    edgeIds,
    geometry: geometry(prepared, edgeIds),
    distanceM,
    durationS,
    sunSeconds,
    noDataSeconds,
  };
}

function geometry(prepared: Prepared, edgeIds: readonly EdgeId[]): LngLat[] {
  const points: LngLat[] = [];
  for (const id of edgeIds) {
    const edge = prepared.edges.get(id);
    if (!edge) continue;
    const startAt = points.length === 0 ? 0 : 1;
    for (let i = startAt; i < edge.geometry.length; i++) {
      const point = edge.geometry[i];
      if (point) points.push(point);
    }
  }
  if (points.length > 0) return points;
  const origin = prepared.positions.get(prepared.input.start);
  return origin ? [origin] : [];
}

function sunFraction(prepared: Prepared, edgeId: EdgeId, minutes: number): number | null {
  const slot = nearestSlot(minutes);
  if (slot === null) return null;
  const key = edgeId * SLOT_GRID.count + slot;
  const cached = prepared.blend.get(key);
  if (cached !== undefined) return cached;
  const values = {} as Record<ReferenceDay, number | null>;
  for (const day of REFERENCE_DAYS) {
    const located = prepared.sun[day].get(edgeId);
    const byte = located?.bytes[located.index * SLOT_GRID.count + slot];
    values[day] = byte === undefined ? null : decodeSunFraction(byte);
  }
  const blended = prepared.shade.interpolateSunFraction(values, prepared.input.day);
  prepared.blend.set(key, blended);
  return blended;
}

function stateKey(node: NodeId, minutes: number): number {
  const slot = nearestSlot(minutes);
  return node * SLOT_SPAN + (slot === null ? 0 : slot + 1);
}

function heuristic(prepared: Prepared, node: NodeId): number {
  const from = prepared.positions.get(node);
  const to = prepared.positions.get(prepared.input.end);
  if (!from || !to) return 0;
  return metersBetween(from, to);
}

function metersBetween(a: LngLat, b: LngLat): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function heapPush(heap: HeapItem[], item: HeapItem): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    const parentItem = heap[parent];
    const current = heap[i];
    if (!parentItem || !current || parentItem.f <= current.f) break;
    heap[parent] = current;
    heap[i] = parentItem;
    i = parent;
  }
}

function heapPop(heap: HeapItem[]): HeapItem | undefined {
  const top = heap[0];
  if (!top) return undefined;
  const last = heap.pop();
  if (!last || heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    const leftItem = heap[left];
    const rightItem = heap[right];
    let smallest = i;
    let smallestItem = heap[i];
    if (!smallestItem) break;
    if (leftItem && leftItem.f < smallestItem.f) {
      smallest = left;
      smallestItem = leftItem;
    }
    if (rightItem && rightItem.f < smallestItem.f) {
      smallest = right;
      smallestItem = rightItem;
    }
    if (smallest === i) break;
    const swap = heap[i];
    const other = heap[smallest];
    if (!swap || !other) break;
    heap[i] = other;
    heap[smallest] = swap;
    i = smallest;
  }
  return top;
}
