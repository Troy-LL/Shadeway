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

export function nearestNode(graph: PilotData["graph"], point: readonly [number, number]): NodeId {
  let best = 0;
  let bestDistance = Infinity;
  for (const edge of graph.edges) {
    const ends: readonly (readonly [NodeId, readonly [number, number] | undefined])[] = [
      [edge.from, edge.geometry[0]],
      [edge.to, edge.geometry[edge.geometry.length - 1]],
    ];
    for (const [id, at] of ends) {
      if (!at) continue;
      const distance = (at[0] - point[0]) ** 2 + (at[1] - point[1]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = id;
      }
    }
  }
  return best;
}

function isOutbound(value: unknown): value is Outbound {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { type?: unknown; id?: unknown };
  return (record.type === "route" || record.type === "error") && typeof record.id === "number";
}
