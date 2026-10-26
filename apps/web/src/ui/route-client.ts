import type { LocalDateTime, NodeId, RouteResult, RouteWeight } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import type { PilotData } from "../map/pilot";

export interface RouteClient {
  route(
    pilot: PilotData,
    start: NodeId,
    end: NodeId,
    departure: LocalDateTime,
  ): Promise<Readonly<Record<RouteWeight, RouteResult | null>>>;
}

type Outbound =
  | { type: "route"; id: number; routes: Readonly<Record<RouteWeight, RouteResult | null>> }
  | { type: "error"; id: number; message: string };

export function createRouteClient(): RouteClient {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (routes: Readonly<Record<RouteWeight, RouteResult | null>>) => void;
      reject: (error: Error) => void;
    }
  >();

  const ensure = (): Worker => {
    if (worker) return worker;
    const created = new Worker(new URL("../../../../packages/router/src/worker.ts", import.meta.url), { type: "module" });
    created.onmessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      if (!isOutbound(data)) return;
      const waiter = pending.get(data.id);
      if (!waiter) return;
      pending.delete(data.id);
      if (data.type === "error") waiter.reject(new Error(data.message));
      else waiter.resolve(data.routes);
    };
    created.onerror = () => {
      for (const waiter of pending.values()) waiter.reject(new Error("router worker failed"));
      pending.clear();
    };
    worker = created;
    return created;
  };

  return {
    route(pilot, start, end, departure) {
      const id = nextId;
      nextId += 1;
      const result = new Promise<Readonly<Record<RouteWeight, RouteResult | null>>>((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      ensure().postMessage({
        type: "route",
        id,
        job: {
          graph: pilot.graph,
          tiles: pilot.tiles,
          day: shadeModel.sunDay(departure.date),
          departure,
          start,
          end,
        },
      });
      return result;
    },
  };
}

const SNAP_TO_MAIN_M = 80;

export function nearestNode(graph: PilotData["graph"], point: readonly [number, number]): NodeId {
  const main = mainComponent(graph);
  const snapped = closest(graph, point, main);
  if (snapped && snapped.meters <= SNAP_TO_MAIN_M) return snapped.id;
  return closest(graph, point, null)?.id ?? 0;
}

function closest(
  graph: PilotData["graph"],
  point: readonly [number, number],
  allow: ReadonlySet<NodeId> | null,
): { id: NodeId; meters: number } | null {
  let best: NodeId | null = null;
  let bestMeters = Infinity;
  for (const edge of graph.edges) {
    const ends: readonly (readonly [NodeId, readonly [number, number] | undefined])[] = [
      [edge.from, edge.geometry[0]],
      [edge.to, edge.geometry[edge.geometry.length - 1]],
    ];
    for (const [id, at] of ends) {
      if (!at || (allow && !allow.has(id))) continue;
      const meters = metersBetween(at, point);
      if (meters < bestMeters) {
        bestMeters = meters;
        best = id;
      }
    }
  }
  return best === null ? null : { id: best, meters: bestMeters };
}

function mainComponent(graph: PilotData["graph"]): Set<NodeId> {
  const adj = new Map<NodeId, NodeId[]>();
  const touch = (id: NodeId) => {
    const list = adj.get(id);
    if (list) return list;
    const created: NodeId[] = [];
    adj.set(id, created);
    return created;
  };
  for (const edge of graph.edges) {
    touch(edge.from).push(edge.to);
    touch(edge.to).push(edge.from);
  }
  const seen = new Set<NodeId>();
  let largest = new Set<NodeId>();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const component = new Set<NodeId>();
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) continue;
      component.add(id);
      for (const next of adj.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function metersBetween(a: readonly [number, number], b: readonly [number, number]): number {
  const lat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const x = (a[0] - b[0]) * 111_320 * Math.cos(lat);
  const y = (a[1] - b[1]) * 110_540;
  return Math.hypot(x, y);
}

function isOutbound(value: unknown): value is Outbound {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { type?: unknown; id?: unknown };
  return (record.type === "route" || record.type === "error") && typeof record.id === "number";
}
