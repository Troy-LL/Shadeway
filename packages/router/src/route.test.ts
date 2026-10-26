import { describe, expect, it } from "vitest";
import {
  REFERENCE_DAYS,
  SLOT_GRID,
  decodeSunFraction,
  encodeSunFraction,
  encodeSunTile,
  type Edge,
  type LocalDateTime,
  type ReferenceDay,
  type SunDay,
  type SunTile,
  type TileManifest,
} from "@shadeway/contract";
import {
  WALKING_SPEED_MPS,
  attachRouterWorker,
  handleRouterMessage,
  loadCorridor,
  route,
  shadeStub,
  walkEdge,
  type RouterWorkerScope,
} from "./index";

const departure: LocalDateTime = { date: "2026-06-21", minutes: 12 * 60 };

function sunDay(partial: Partial<SunDay> = {}): SunDay {
  return {
    date: "2026-06-21",
    declinationDeg: 23.44,
    from: "june-solstice",
    to: "june-solstice",
    t: 0,
    ...partial,
  };
}

function edge(id: number, from: number, to: number, lengthM: number, covered = false): Edge {
  return {
    id,
    from,
    to,
    lengthM,
    geometry: [
      [from / 1000, 0],
      [to / 1000, 0],
    ],
    covered,
    bridge: false,
  };
}

function tile(
  referenceDay: ReferenceDay,
  samples: readonly { id: number; fraction: number | ((slot: number) => number) | null }[],
): SunTile {
  const sun = new Uint8Array(samples.length * SLOT_GRID.count);
  samples.forEach((sample, index) => {
    for (let slot = 0; slot < SLOT_GRID.count; slot++) {
      const fraction = typeof sample.fraction === "function" ? sample.fraction(slot) : sample.fraction;
      sun[index * SLOT_GRID.count + slot] = encodeSunFraction(fraction);
    }
  });
  return { referenceDay, edgeIds: Uint32Array.from(samples.map((sample) => sample.id)), sun };
}

function copies(
  samples: readonly { id: number; fraction: number | ((slot: number) => number) | null }[],
): SunTile[] {
  return REFERENCE_DAYS.map((day) => tile(day, samples));
}

describe("walk cost", () => {
  it("adds weight times sun-seconds to distance", () => {
    const walked = walkEdge(140, 0.5, 2);
    expect(walked.durationS).toBeCloseTo(140 / WALKING_SPEED_MPS);
    expect(walked.sunSeconds).toBeCloseTo(walked.durationS * 0.5);
    expect(walked.noDataSeconds).toBe(0);
    expect(walked.cost).toBeCloseTo(140 + 2 * walked.sunSeconds);
  });

  it("charges a missing fraction as full sun and records no-data time", () => {
    const walked = walkEdge(140, null, 2);
    expect(walked.sunSeconds).toBe(0);
    expect(walked.noDataSeconds).toBeCloseTo(140 / WALKING_SPEED_MPS);
    expect(walked.cost).toBeCloseTo(140 + 2 * walked.noDataSeconds);
  });
});

describe("shade stub", () => {
  it("blends reference days and returns null when a needed value is null", () => {
    const day = sunDay({ from: "june-solstice", to: "december-solstice", t: 0.25 });
    expect(
      shadeStub.interpolateSunFraction(
        { "march-equinox": 1, "june-solstice": 0, "december-solstice": 1 },
        day,
      ),
    ).toBeCloseTo(0.25);
    expect(
      shadeStub.interpolateSunFraction(
        { "march-equinox": 0, "june-solstice": 0, "december-solstice": null },
        day,
      ),
    ).toBeNull();
  });
});

describe("synthetic graph", () => {
  const edges = [
    edge(10, 1, 2, 100),
    edge(20, 1, 3, 80),
    edge(21, 3, 2, 80),
    edge(30, 1, 4, 200),
    edge(31, 4, 2, 200),
  ];
  const samples = [
    { id: 10, fraction: 1 },
    { id: 20, fraction: 0.25 },
    { id: 21, fraction: 0.25 },
    { id: 30, fraction: 0 },
    { id: 31, fraction: 0 },
  ];

  it("returns a known shady route that differs from the fastest", () => {
    const routes = route({
      graph: { version: 1, area: "fixture", edges },
      tiles: copies(samples),
      day: sunDay(),
      departure,
      start: 1,
      end: 2,
    });

    expect(routes.fastest?.edgeIds).toEqual([10]);
    expect(routes.balanced?.edgeIds).toEqual([20, 21]);
    expect(routes.shadiest?.edgeIds).toEqual([30, 31]);
    expect(routes.fastest?.sunSeconds).toBeGreaterThan(routes.shadiest?.sunSeconds ?? 0);
    expect(routes.shadiest?.sunSeconds).toBe(0);
    expect(routes.fastest?.distanceM).toBe(100);
    expect(routes.balanced?.distanceM).toBe(160);
    expect(routes.shadiest?.distanceM).toBe(400);
    expect(routes.fastest?.durationS).toBeCloseTo(100 / WALKING_SPEED_MPS);
    expect(routes.shadiest?.geometry).toEqual([
      [1 / 1000, 0],
      [4 / 1000, 0],
      [2 / 1000, 0],
    ]);
  });

  it("uses the slot at the moment the walker reaches the edge", () => {
    const long = 30 * 60 * WALKING_SPEED_MPS;
    const routes = route({
      graph: {
        version: 1,
        area: "fixture",
        edges: [edge(1, 0, 1, long), edge(2, 1, 2, WALKING_SPEED_MPS)],
      },
      tiles: copies([
        { id: 1, fraction: (slot) => (slot === 0 ? 1 : 0) },
        { id: 2, fraction: (slot) => (slot === 0 ? 1 : 0) },
      ]),
      day: sunDay(),
      departure: { date: "2026-06-21", minutes: 6 * 60 },
      start: 0,
      end: 2,
    });
    expect(routes.fastest?.edgeIds).toEqual([1, 2]);
    expect(routes.fastest?.sunSeconds).toBeCloseTo(30 * 60);
  });

  it("blends the two reference days named by the sun day", () => {
    const blended = sunDay({ from: "june-solstice", to: "december-solstice", t: 0.5 });
    const routes = route({
      graph: { version: 1, area: "fixture", edges: [edge(7, 0, 1, 140)] },
      tiles: [
        tile("march-equinox", [{ id: 7, fraction: 0 }]),
        tile("june-solstice", [{ id: 7, fraction: 0 }]),
        tile("december-solstice", [{ id: 7, fraction: 1 }]),
      ],
      day: blended,
      departure,
      start: 0,
      end: 1,
    });
    expect(routes.fastest?.sunSeconds).toBeCloseTo((140 / WALKING_SPEED_MPS) * 0.5);
  });

  it("does not treat a covered edge as shade unless the tile byte says so", () => {
    const routes = route({
      graph: { version: 1, area: "fixture", edges: [edge(1, 0, 1, 140, true)] },
      tiles: copies([{ id: 1, fraction: 1 }]),
      day: sunDay(),
      departure,
      start: 0,
      end: 1,
    });
    expect(routes.fastest?.sunSeconds).toBeCloseTo(140 / WALKING_SPEED_MPS);
  });

  it("prefers known shade over a shorter edge with no tile byte", () => {
    const routes = route({
      graph: {
        version: 1,
        area: "fixture",
        edges: [edge(1, 0, 1, 100), edge(2, 0, 2, 80), edge(3, 2, 1, 80)],
      },
      tiles: copies([
        { id: 1, fraction: null },
        { id: 2, fraction: 0 },
        { id: 3, fraction: 0 },
      ]),
      day: sunDay(),
      departure,
      start: 0,
      end: 1,
    });
    expect(routes.fastest?.edgeIds).toEqual([1]);
    expect(routes.fastest?.noDataSeconds).toBeCloseTo(100 / WALKING_SPEED_MPS);
    expect(routes.fastest?.sunSeconds).toBe(0);
    expect(routes.shadiest?.edgeIds).toEqual([2, 3]);
    expect(routes.shadiest?.sunSeconds).toBe(0);
    expect(routes.shadiest?.noDataSeconds).toBe(0);
  });

  it("counts time outside 06:00 to 18:00 as no data", () => {
    const routes = route({
      graph: { version: 1, area: "fixture", edges: [edge(1, 0, 1, 140)] },
      tiles: copies([{ id: 1, fraction: 0 }]),
      day: sunDay(),
      departure: { date: "2026-06-21", minutes: 5 * 60 },
      start: 0,
      end: 1,
    });
    expect(routes.fastest?.edgeIds).toEqual([1]);
    expect(routes.fastest?.sunSeconds).toBe(0);
    expect(routes.fastest?.noDataSeconds).toBeCloseTo(140 / WALKING_SPEED_MPS);
    expect(routes.shadiest?.edgeIds).toEqual([1]);
  });

  it("returns null weights when the end is unreachable", () => {
    const routes = route({
      graph: { version: 1, area: "fixture", edges: [edge(1, 0, 1, 10)] },
      tiles: copies([{ id: 1, fraction: 0 }]),
      day: sunDay(),
      departure,
      start: 0,
      end: 9,
    });
    expect(routes.fastest).toBeNull();
    expect(routes.balanced).toBeNull();
    expect(routes.shadiest).toBeNull();
  });

  it("returns an empty route when start and end are the same node", () => {
    const routes = route({
      graph: { version: 1, area: "fixture", edges: [edge(1, 0, 1, 10)] },
      tiles: copies([{ id: 1, fraction: 1 }]),
      day: sunDay(),
      departure,
      start: 0,
      end: 0,
    });
    expect(routes.fastest?.edgeIds).toEqual([]);
    expect(routes.fastest?.distanceM).toBe(0);
    expect(routes.fastest?.geometry).toEqual([[0, 0]]);
  });
});

describe("corridor loader", () => {
  it("reads the graph and the tiles whose bbox meets the corridor", async () => {
    const samples = [{ id: 1, fraction: 1 }];
    const files = new Map<string, Uint8Array>();
    files.set("graph.json", new TextEncoder().encode(JSON.stringify({ version: 1, area: "fixture", edges: [] })));
    for (const day of REFERENCE_DAYS) {
      files.set(`a-${day}.bin`, encodeSunTile(tile(day, samples)));
      files.set(`b-${day}.bin`, encodeSunTile(tile(day, [])));
    }
    const file = (day: ReferenceDay, id: string) => `${id}-${day}.bin`;
    const days = Object.fromEntries(REFERENCE_DAYS.map((day) => [day, file(day, "a")])) as TileManifest["tiles"][number]["files"];
    const other = Object.fromEntries(REFERENCE_DAYS.map((day) => [day, file(day, "b")])) as TileManifest["tiles"][number]["files"];
    const manifest: TileManifest = {
      version: 1,
      area: "fixture",
      bbox: [0, 0, 2, 2],
      builtAt: "2026-01-01T00:00:00.000Z",
      slotGrid: SLOT_GRID,
      referenceDates: {
        "march-equinox": "2026-03-20",
        "june-solstice": "2026-06-21",
        "december-solstice": "2026-12-21",
      },
      graph: "graph.json",
      tiles: [
        { id: "a", bbox: [0, 0, 1, 1], edgeCount: 1, files: days },
        { id: "b", bbox: [1.5, 1.5, 2, 2], edgeCount: 0, files: other },
      ],
      attribution: ["OpenStreetMap"],
    };
    const seen: string[] = [];
    const loaded = await loadCorridor(manifest, [0, 0, 0.5, 0.5], async (path) => {
      seen.push(path);
      const bytes = files.get(path);
      if (!bytes) throw new Error(`missing ${path}`);
      return bytes;
    });
    expect(seen).toEqual(["graph.json", ...REFERENCE_DAYS.map((day) => `a-${day}.bin`)]);
    expect(loaded.graph.area).toBe("fixture");
    expect(loaded.tiles).toHaveLength(3);
    expect(decodeSunFraction(loaded.tiles[0]!.sun[0]!)).toBe(1);
  });
});

describe("worker messages", () => {
  const job = {
    graph: { version: 1, area: "fixture", edges: [edge(10, 1, 2, 100), edge(30, 1, 4, 200), edge(31, 4, 2, 200)] },
    tiles: copies([
      { id: 10, fraction: 1 },
      { id: 30, fraction: 0 },
      { id: 31, fraction: 0 },
    ]),
    day: sunDay(),
    departure,
    start: 1,
    end: 2,
  };

  it("returns three weights for a route message", () => {
    const response = handleRouterMessage({ type: "route", id: 4, job });
    expect(response.type).toBe("route");
    if (response.type !== "route") return;
    expect(response.id).toBe(4);
    expect(response.routes.fastest?.edgeIds).toEqual([10]);
    expect(response.routes.shadiest?.edgeIds).toEqual([30, 31]);
  });

  it("posts the handler result through the worker scope", () => {
    const posted: unknown[] = [];
    const scope: RouterWorkerScope = {
      onmessage: null,
      postMessage(message) {
        posted.push(message);
      },
    };
    attachRouterWorker(scope);
    scope.onmessage?.({ data: { type: "route", id: 1, job } });
    expect(posted).toHaveLength(1);
  });

  it("rejects a message it does not understand", () => {
    expect(handleRouterMessage({ type: "draw", id: 3 })).toEqual({
      type: "error",
      id: 3,
      message: "unrecognized router message",
    });
  });
});
