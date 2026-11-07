import {
  REFERENCE_DAYS,
  SLOT_GRID,
  encodeSunFraction,
  type GraphFile,
  type ReferenceDay,
  type RouteResult,
  type RouteWeight,
  type SunTile,
} from "@shadeway/contract";
import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { cardsFromResults, segmentsForRoute } from "./route-model";

function tile(day: ReferenceDay, ids: number[], fractions: readonly (number | null)[]): SunTile {
  const sun = new Uint8Array(ids.length * SLOT_GRID.count);
  sun.fill(255);
  ids.forEach((_, edgeIndex) => {
    const fraction = fractions[edgeIndex] ?? null;
    for (let slot = 0; slot < SLOT_GRID.count; slot += 1) {
      sun[edgeIndex * SLOT_GRID.count + slot] = encodeSunFraction(fraction);
    }
  });
  return { referenceDay: day, edgeIds: Uint32Array.from(ids), sun };
}

function result(weight: RouteWeight, edgeIds: number[]): RouteResult {
  return {
    weight,
    departure: { date: "2026-10-26", minutes: 12 * 60 },
    edgeIds,
    geometry: [
      [121.048, 14.551],
      [121.05, 14.551],
    ],
    distanceM: 40,
    durationS: 120,
    sunSeconds: 60,
    noDataSeconds: 0,
  };
}

const graph: GraphFile = {
  version: 1,
  area: "fixture",
  edges: [
    {
      id: 1,
      from: 1,
      to: 2,
      lengthM: 10,
      geometry: [
        [121.048, 14.551],
        [121.049, 14.551],
      ],
      covered: true,
      bridge: false,
    },
    {
      id: 2,
      from: 2,
      to: 3,
      lengthM: 30,
      geometry: [
        [121.049, 14.551],
        [121.05, 14.551],
      ],
      covered: false,
      bridge: false,
    },
  ],
};

describe("route shade strip", () => {
  it("draws covered length as shade even when the tile byte is full sun", () => {
    const tiles = REFERENCE_DAYS.map((day) => tile(day, [1, 2], [1, 1]));
    const segments = segmentsForRoute(graph, tiles, result("shadiest", [1, 2]));
    expect(segments.map((segment) => segment.sunny)).toEqual([false, true]);
    expect(segments[0]?.to).toBeCloseTo(0.25);
  });

  it("says so when the shadiest walk is the fastest walk", () => {
    const tiles = REFERENCE_DAYS.map((day) => tile(day, [2], [0]));
    const same = cardsFromResults(
      {
        fastest: result("fastest", [2]),
        balanced: result("balanced", [2]),
        shadiest: result("shadiest", [2]),
      },
      graph,
      tiles,
    );
    expect(same.find((card) => card.weight === "shadiest")?.note).toBe(COPY.shadiestAndFastest);
    expect(same.find((card) => card.weight === "fastest")?.note).toBeUndefined();
    expect(same).toHaveLength(2);
    expect(same.find((card) => card.weight === "shadiest")?.totalMinutes).toBe(2);
    expect(same.find((card) => card.weight === "shadiest")?.sunMinutes).toBe(1);

    const split = cardsFromResults(
      {
        fastest: result("fastest", [2]),
        balanced: result("balanced", [1, 2]),
        shadiest: result("shadiest", [1]),
      },
      graph,
      tiles,
    );
    expect(split.find((card) => card.weight === "shadiest")?.note).toBeUndefined();
  });

  it("draws the strip as shade when the sun is down, including a missing tile byte", () => {
    const tiles = REFERENCE_DAYS.map((day) => tile(day, [2], [null]));
    const night = {
      ...result("fastest", [2]),
      departure: { date: "2026-10-26" as const, minutes: 20 * 60 },
    };
    const segments = segmentsForRoute(graph, tiles, night);
    expect(segments.every((segment) => segment.sunny === false)).toBe(true);
  });
});
