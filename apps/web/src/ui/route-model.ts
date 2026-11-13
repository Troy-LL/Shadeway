import {
  REFERENCE_DAYS,
  SLOT_GRID,
  decodeSunFraction,
  nearestSlot,
  type EdgeId,
  type GraphFile,
  type ReferenceDay,
  type RouteResult,
  type RouteWeight,
  type SunDay,
  type SunTile,
} from "@shadeway/contract";
import { WALKING_SPEED_MPS } from "@shadeway/router";
import { shadeModel } from "@shadeway/shade-model";
import { COPY, sunMinutesFromSeconds } from "./copy";
import type { RouteCardModel, ShadeSegment } from "./types";

const CARD_ORDER: readonly RouteWeight[] = ["shadiest", "fastest"];

export function cardsFromResults(
  routes: Readonly<Record<RouteWeight, RouteResult | null>>,
  graph: GraphFile,
  tiles: readonly SunTile[],
  options: { readonly shadeCoverageUnavailable?: boolean; readonly canopy?: boolean } = {},
): RouteCardModel[] {
  const fastest = routes.fastest;
  const shadiest = routes.shadiest;
  const sunDown =
    fastest?.geometry[0] !== undefined &&
    shadeModel.sunPosition(fastest.departure, fastest.geometry[0]).elevationDeg <= 0;
  const unavailable = sunDown || options.shadeCoverageUnavailable === true;
  const same =
    fastest !== null &&
    shadiest !== null &&
    fastest.edgeIds.length > 0 &&
    sameIds(fastest.edgeIds, shadiest.edgeIds);
  const cards: RouteCardModel[] = [];
  for (const weight of CARD_ORDER) {
    const result = routes[weight];
    if (!result || result.geometry.length < 2) continue;
    const card: RouteCardModel = {
      weight,
      totalMinutes: Math.round(result.durationS / 60),
      sunMinutes: unavailable ? null : sunMinutesFromSeconds(result.sunSeconds),
      segments: unavailable ? [] : segmentsForRoute(graph, tiles, result),
      confidence: options.canopy ? "Estimate + canopy" : "Estimate",
      geometry: result.geometry,
      distanceM: result.distanceM,
      edgeKey: result.edgeIds.join(","),
      shadeUnavailable: unavailable,
    };
    cards.push(card);
  }
  return noteCards(cards, same);
}

export function compareRoutes(cards: readonly RouteCardModel[]): readonly RouteCardModel[] {
  return cards.filter((card) => card.weight === "shadiest" || card.weight === "fastest");
}

/** Shade unavailable: one fastest route, shared by cards and the map. */
export function displayedRoutes(state: { readonly status: string; readonly routes: readonly RouteCardModel[] }): readonly RouteCardModel[] {
  if (state.status === "shade-unavailable") {
    const fastest = state.routes.find((route) => route.weight === "fastest") ?? state.routes[0];
    return fastest ? [fastest] : [];
  }
  return compareRoutes(state.routes);
}

function noteCards(cards: RouteCardModel[], same: boolean): RouteCardModel[] {
  const shadeUnavailable = cards.some((card) => card.shadeUnavailable);
  if (shadeUnavailable) {
    const fastest = cards.find((card) => card.weight === "fastest") ?? cards[0];
    return fastest ? [{ ...fastest, weight: "fastest" }] : [];
  }
  if (cards.length === 1) {
    return cards.map((card) => ({ ...card, note: COPY.availableRoute }));
  }
  if (same && cards.length >= 2) {
    const merged = cards.find((card) => card.weight === "shadiest") ?? cards[0];
    if (!merged) return cards;
    return [{ ...merged, note: COPY.shadiestAndFastest }];
  }
  return cards;
}

export function segmentsForRoute(
  graph: GraphFile,
  tiles: readonly SunTile[],
  route: RouteResult,
): ShadeSegment[] {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const index = tileIndex(tiles);
  const day = shadeModel.sunDay(route.departure.date);
  const origin = route.geometry[0];
  const sunDown = origin !== undefined && shadeModel.sunPosition(route.departure, origin).elevationDeg <= 0;
  const spans: { length: number; sunny: boolean }[] = [];
  let cursor = 0;
  let minutes = route.departure.minutes;
  for (const id of route.edgeIds) {
    const edge = edges.get(id);
    if (!edge) continue;
    const forced = edge.covered || edge.bridge;
    const slot = nearestSlot(minutes);
    const fraction = forced || slot === null ? null : blended(index, id, slot, day);
    const sunny = !sunDown && !forced && (fraction === null || fraction >= 0.5);
    spans.push({ length: edge.lengthM, sunny });
    cursor += edge.lengthM;
    minutes += edge.lengthM / WALKING_SPEED_MPS / 60;
  }
  const total = cursor || 1;
  const segments: { from: number; to: number; sunny: boolean }[] = [];
  let walked = 0;
  for (const span of spans) {
    const from = walked / total;
    walked += span.length;
    const to = walked / total;
    const last = segments[segments.length - 1];
    if (last && last.sunny === span.sunny) last.to = to;
    else segments.push({ from, to, sunny: span.sunny });
  }
  return segments;
}

function sameIds(a: readonly EdgeId[], b: readonly EdgeId[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function tileIndex(tiles: readonly SunTile[]): Record<ReferenceDay, Map<EdgeId, { bytes: Uint8Array; index: number }>> {
  const maps = {} as Record<ReferenceDay, Map<EdgeId, { bytes: Uint8Array; index: number }>>;
  for (const day of REFERENCE_DAYS) maps[day] = new Map();
  for (const tile of tiles) {
    const day = maps[tile.referenceDay];
    tile.edgeIds.forEach((id, index) => {
      day.set(id, { bytes: tile.sun, index });
    });
  }
  return maps;
}

function blended(
  index: ReturnType<typeof tileIndex>,
  edgeId: EdgeId,
  slot: number,
  day: SunDay,
): number | null {
  const values = {} as Record<ReferenceDay, number | null>;
  for (const ref of REFERENCE_DAYS) {
    const located = index[ref].get(edgeId);
    const byte = located?.bytes[located.index * SLOT_GRID.count + slot];
    values[ref] = byte === undefined ? null : decodeSunFraction(byte);
  }
  return shadeModel.interpolateSunFraction(values, day);
}
