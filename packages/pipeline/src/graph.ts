import type { Edge, LngLat, NodeId } from "@shadeway/contract";
import type { FootpathPiece } from "./edges.js";
import type { EdgeOverride, Overrides } from "./overrides.js";
import { shadeFlags } from "./tags.js";

const METERS_PER_DEG_LAT = (Math.PI * 6378137) / 180;

export type GraphBuild = {
  edges: Edge[];
  coveredEdges: number;
  coveredYesEdges: number;
  buildingPassageEdges: number;
  bridgeEdges: number;
  overrideEdges: number;
};

export function graphFromPieces(pieces: readonly FootpathPiece[], overrides: Overrides): GraphBuild {
  const byWay = new Map<number, EdgeOverride[]>();
  for (const item of overrides.edges) {
    const list = byWay.get(item.osmWayId) ?? [];
    list.push(item);
    byWay.set(item.osmWayId, list);
  }

  const nodeIds = new Map<number, NodeId>();
  const edges: Edge[] = [];
  let coveredEdges = 0;
  let coveredYesEdges = 0;
  let buildingPassageEdges = 0;
  let bridgeEdges = 0;
  let overrideEdges = 0;
  let nextNode: NodeId = 1;
  let nextEdge = 1;

  for (const piece of pieces) {
    const geometry: LngLat[] = [];
    const fromNode = piece.nodes[0];
    const toNode = piece.nodes[piece.nodes.length - 1];
    if (fromNode === undefined || toNode === undefined) continue;
    for (const node of piece.nodes) {
      const point: LngLat = [node.lon, node.lat];
      const prev = geometry[geometry.length - 1];
      if (prev !== undefined && prev[0] === point[0] && prev[1] === point[1]) continue;
      geometry.push(point);
    }
    if (geometry.length < 2) continue;

    const flags = shadeFlags(piece.tags);
    let covered = flags.covered;
    let bridge = flags.bridge;
    let overrideId: string | undefined;
    for (const item of byWay.get(piece.osmWayId) ?? []) {
      switch (item.kind) {
        case "covered":
          covered = true;
          break;
        case "bridge":
          bridge = true;
          break;
        default: {
          const never: never = item.kind;
          throw new Error(`unknown override kind: ${never}`);
        }
      }
      overrideId = item.id;
    }
    if (piece.tags.covered === "yes") coveredYesEdges += 1;
    if (piece.tags.tunnel === "building_passage") buildingPassageEdges += 1;
    if (covered) coveredEdges += 1;
    if (bridge) bridgeEdges += 1;
    if (overrideId !== undefined) overrideEdges += 1;

    const from = nodeIds.get(fromNode.id) ?? nextNode;
    if (!nodeIds.has(fromNode.id)) {
      nodeIds.set(fromNode.id, from);
      nextNode += 1;
    }
    const to = nodeIds.get(toNode.id) ?? nextNode;
    if (!nodeIds.has(toNode.id)) {
      nodeIds.set(toNode.id, to);
      nextNode += 1;
    }

    const edge: Edge = {
      id: nextEdge,
      from,
      to,
      lengthM: lengthM(geometry),
      geometry,
      covered,
      bridge,
    };
    edges.push(overrideId === undefined ? edge : { ...edge, overrideId });
    nextEdge += 1;
  }

  return { edges, coveredEdges, coveredYesEdges, buildingPassageEdges, bridgeEdges, overrideEdges };
}

function lengthM(geometry: readonly LngLat[]): number {
  let total = 0;
  for (let i = 0; i < geometry.length - 1; i += 1) {
    const a = geometry[i];
    const b = geometry[i + 1];
    if (a === undefined || b === undefined) continue;
    const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
    const x = (b[0] - a[0]) * METERS_PER_DEG_LAT * Math.cos(lat);
    const y = (b[1] - a[1]) * METERS_PER_DEG_LAT;
    total += Math.hypot(x, y);
  }
  return total;
}
