import type { GraphFile, LocalDateTime, NodeId, RouteResult, RouteWeight, SunDay, SunTile } from "@shadeway/contract";
import { route, type RouteInput } from "./search";

export interface RouteJob {
  readonly graph: GraphFile;
  readonly tiles: readonly SunTile[];
  readonly day: SunDay;
  readonly departure: LocalDateTime;
  readonly start: NodeId;
  readonly end: NodeId;
}

export type RouterInbound = {
  readonly type: "route";
  readonly id: number;
  readonly job: RouteJob;
};

export type RouterOutbound =
  | {
      readonly type: "route";
      readonly id: number;
      readonly routes: Readonly<Record<RouteWeight, RouteResult | null>>;
    }
  | { readonly type: "error"; readonly id: number; readonly message: string };

export interface RouterWorkerScope {
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  postMessage(message: RouterOutbound): void;
}

export function handleRouterMessage(message: unknown): RouterOutbound {
  const id = messageId(message);
  if (!isRouterInbound(message)) return { type: "error", id, message: "unrecognized router message" };
  try {
    return { type: "route", id, routes: route(message.job satisfies RouteInput) };
  } catch (error) {
    const text = error instanceof Error ? error.message : "route failed";
    return { type: "error", id, message: text };
  }
}

export function attachRouterWorker(scope: RouterWorkerScope): void {
  scope.onmessage = (event) => {
    scope.postMessage(handleRouterMessage(event.data));
  };
}

function isRouterInbound(message: unknown): message is RouterInbound {
  if (typeof message !== "object" || message === null) return false;
  const record = message as { type?: unknown; id?: unknown; job?: unknown };
  if (record.type !== "route" || typeof record.id !== "number") return false;
  const job = record.job;
  if (typeof job !== "object" || job === null) return false;
  const fields = job as { graph?: unknown; tiles?: unknown; day?: unknown; departure?: unknown; start?: unknown; end?: unknown };
  return (
    typeof fields.graph === "object" &&
    fields.graph !== null &&
    Array.isArray((fields.graph as { edges?: unknown }).edges) &&
    Array.isArray(fields.tiles) &&
    typeof fields.day === "object" &&
    fields.day !== null &&
    typeof fields.departure === "object" &&
    fields.departure !== null &&
    typeof fields.start === "number" &&
    typeof fields.end === "number"
  );
}

function messageId(message: unknown): number {
  if (typeof message !== "object" || message === null || !("id" in message)) return 0;
  return typeof message.id === "number" ? message.id : 0;
}
