import type { LngLat } from "@shadeway/contract";
import type { OsmWay } from "./edges.js";

export type PlacePoint = {
  name: string;
  at: LngLat;
};

export type PlaceGroup = {
  places: readonly PlacePoint[];
  rank: number;
};

const PLACE_LIMIT = 48;

export function placesFromWays(ways: readonly OsmWay[]): PlacePoint[] {
  const points: PlacePoint[] = [];
  for (const way of ways) {
    const name = way.tags.name?.trim();
    const mid = way.nodes[Math.floor(way.nodes.length / 2)];
    if (!name || !mid) continue;
    points.push({ name, at: [mid.lon, mid.lat] });
  }
  return points;
}

export function curatePlaces(groups: readonly PlaceGroup[], limit = PLACE_LIMIT): PlacePoint[] {
  const best = new Map<string, { place: PlacePoint; rank: number }>();
  for (const group of groups) {
    for (const place of group.places) {
      const name = place.name.trim();
      const key = name.toLowerCase();
      if (key.length < 3) continue;
      const rank = group.rank + landmarkBoost(name);
      const prev = best.get(key);
      if (!prev || rank > prev.rank) best.set(key, { place: { name, at: place.at }, rank });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.rank - a.rank || a.place.name.localeCompare(b.place.name))
    .slice(0, limit)
    .map((item) => item.place)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function landmarkBoost(name: string): number {
  return /high street|market|serendra|uptown|aura|bonifacio|mind museum|the fort|terra 28|central square|mitsukoshi/i.test(name)
    ? 80
    : 0;
}
