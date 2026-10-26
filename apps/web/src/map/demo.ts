import { slotStartMinutes, type LocalDateTime, type LngLat, type NodeId, type RouteWeight } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import type { MapController } from "./controller";
import type { PilotData } from "./pilot";

/** Bonifacio High Street, the tree-lined pilot walk. */
const DEMO_FROM: LngLat = [121.04862, 14.55148];
const DEMO_TO: LngLat = [121.05303, 14.55012];
const DEMO_DATE = "2026-10-26";

export async function runDemo(controller: MapController, pilot: PilotData, slot = 12): Promise<void> {
  const departure: LocalDateTime = { date: DEMO_DATE, minutes: slotStartMinutes(slot) };
  const routes = await routeInWorker(pilot, nearestNode(pilot, DEMO_FROM), nearestNode(pilot, DEMO_TO), departure);
  const order: RouteWeight[] = ["fastest", "balanced", "shadiest"];
  for (const weight of order) {
    const route = routes[weight];
    if (!route || route.geometry.length < 2) continue;
    controller.setRoute({ weight, coordinates: route.geometry });
  }
  controller.setStartMarker(DEMO_FROM);
  controller.setEndMarker(DEMO_TO);
  controller.fitRoute();
  document.documentElement.dataset.route = routes.shadiest ? "ready" : "empty";
}

async function routeInWorker(
  pilot: PilotData,
  start: NodeId,
  end: NodeId,
  departure: LocalDateTime,
): Promise<Partial<Record<RouteWeight, { geometry: readonly LngLat[] } | null>>> {
  const worker = new Worker(new URL("../../../../packages/router/src/worker.ts", import.meta.url), { type: "module" });
  const id = 1;
  const result = new Promise<Partial<Record<RouteWeight, { geometry: readonly LngLat[] } | null>>>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      if (!isOutbound(data) || data.id !== id) return;
      if (data.type === "error") reject(new Error(data.message ?? "route failed"));
      else resolve(data.routes ?? {});
    };
    worker.onerror = () => reject(new Error("router worker failed"));
  });
  worker.postMessage({
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
  try {
    return await result;
  } finally {
    worker.terminate();
  }
}

function nearestNode(pilot: PilotData, point: LngLat): NodeId {
  let best = 0;
  let bestDistance = Infinity;
  for (const edge of pilot.graph.edges) {
    const ends: readonly (readonly [NodeId, LngLat | undefined])[] = [
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

function isOutbound(value: unknown): value is { type: string; id: number; message?: string; routes?: Partial<Record<RouteWeight, { geometry: readonly LngLat[] } | null>> } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { type?: unknown; id?: unknown };
  return typeof record.type === "string" && typeof record.id === "number";
}
