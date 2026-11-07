import { decodeSunTile, type GraphFile, type LngLat, type NodeId, type SunTile } from "@shadeway/contract";
import { route } from "@shadeway/router";
import { shadeModel } from "@shadeway/shade-model";

export function shadiestSunMinutes(input: {
  graph: GraphFile;
  tiles: readonly SunTile[];
  from: LngLat;
  to: LngLat;
  date: string;
  minutes: number;
}): number | null {
  const start = nearestNode(input.graph, input.from);
  const end = nearestNode(input.graph, input.to);
  if (start === null || end === null) return null;
  const day = shadeModel.sunDay(input.date);
  const routes = route({
    graph: input.graph,
    tiles: input.tiles,
    day,
    departure: { date: input.date, minutes: input.minutes },
    start,
    end,
    shade: shadeModel,
  });
  const shadiest = routes.shadiest;
  if (!shadiest) return null;
  return Math.round(shadiest.sunSeconds / 30) / 2;
}

export function tilesFromShadeFiles(files: Record<string, Uint8Array>): SunTile[] {
  return Object.values(files).map((bytes) => decodeSunTile(bytes));
}

function nearestNode(graph: GraphFile, point: LngLat): NodeId | null {
  let best: NodeId | null = null;
  let bestDistance = Infinity;
  for (const edge of graph.edges) {
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
