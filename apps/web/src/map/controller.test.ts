import type { Building, GraphFile, LngLat, TileManifest } from "@shadeway/contract";
import { SLOT_GRID } from "@shadeway/contract";
import { beforeEach, describe, expect, it } from "vitest";
import { createMapController } from "./controller";
import type { PilotData } from "./pilot";
import type { CameraMove, MapScene, MapView } from "./view";

function manifest(): TileManifest {
  return {
    version: 1,
    area: "bgc",
    bbox: [121.04, 14.54, 121.06, 14.56],
    builtAt: "2026-10-26T00:00:00.000Z",
    slotGrid: SLOT_GRID,
    referenceDates: {
      "march-equinox": "2026-03-20",
      "june-solstice": "2026-06-21",
      "december-solstice": "2026-12-22",
    },
    graph: "graph.json",
    tiles: [],
    attribution: ["OpenStreetMap contributors, ODbL"],
  };
}

function pilot(): PilotData {
  const building: Building = {
    id: "tower",
    heightM: 48,
    heightSource: "default",
    footprint: [
      [121.05, 14.552],
      [121.0505, 14.552],
      [121.0505, 14.5524],
      [121.05, 14.5524],
    ],
  };
  const graph: GraphFile = { version: 1, area: "bgc", edges: [] };
  return { manifest: manifest(), graph, tiles: [], buildings: [building], roads: [], land: [], places: [], attribution: manifest().attribution };
}

function fakeView(): MapView & {
  scene: MapScene | null;
  cameras: CameraMove[];
  durations: number[];
  fitted: number;
  markers: { start: LngLat | null; end: LngLat | null };
  tap: ((position: LngLat) => void) | null;
} {
  const view = {
    scene: null as MapScene | null,
    cameras: [] as CameraMove[],
    durations: [] as number[],
    fitted: 0,
    markers: { start: null as LngLat | null, end: null as LngLat | null },
    tap: null as ((position: LngLat) => void) | null,
    setRoads() {},
    setLand() {},
    setLabels() {},
    setScene(scene: MapScene) {
      view.scene = scene;
    },
    ease(camera: CameraMove, durationMs: number) {
      view.cameras.push(camera);
      view.durations.push(durationMs);
    },
    fit(_bounds: readonly [number, number, number, number], _padding: object, camera: CameraMove, durationMs: number) {
      view.fitted += 1;
      view.cameras.push(camera);
      view.durations.push(durationMs);
    },
    setMarkers(start: LngLat | null, end: LngLat | null) {
      view.markers = { start, end };
    },
    setOutline() {},
    onTap(listener: (position: LngLat) => void) {
      view.tap = listener;
    },
  };
  return view;
}

const route: LngLat[] = [
  [121.0496, 14.5517],
  [121.0502, 14.5521],
  [121.0508, 14.5525],
];

describe("MapController", () => {
  beforeEach(() => localStorage.clear());

  it("stores a route, reuses it when the sheet sends only a weight, and fits under 400 ms", () => {
    const view = fakeView();
    const root = document.createElement("div");
    document.body.append(root);
    const controller = createMapController(root, { createView: () => view, pilot: pilot(), date: "2026-10-26" });
    controller.setSlot(18);
    controller.setRoute({ weight: "shadiest", coordinates: route });
    controller.setRoute({ weight: "shadiest", coordinates: [] });
    expect(view.scene?.shadows.some((shadow) => shadow.estimated)).toBe(true);
    expect((view.scene?.route.sunny.length ?? 0) + (view.scene?.route.shaded.length ?? 0)).toBeGreaterThan(0);
    controller.fitRoute();
    expect(view.fitted).toBe(1);
    expect(view.durations.at(-1)).toBeLessThan(400);
    expect(view.cameras.at(-1)?.pitch).toBe(0);
    expect(view.cameras.at(-1)?.bearing).toBe(0);
  });

  it("places markers, follows with a flat camera, and reports taps", () => {
    const view = fakeView();
    const root = document.createElement("div");
    const controller = createMapController(root, { createView: () => view, pilot: pilot() });
    controller.setRoute({ weight: "balanced", coordinates: route });
    controller.setStartMarker(route[0] ?? null);
    controller.setEndMarker(route[2] ?? null);
    expect(view.markers.start).toEqual(route[0]);
    expect(view.markers.end).toEqual(route[2]);
    controller.followPosition(true);
    expect(view.cameras.at(-1)?.pitch).toBe(0);
    const taps: LngLat[] = [];
    const unsubscribe = controller.subscribeMapTap((position) => taps.push(position));
    view.tap?.([121.05, 14.55]);
    unsubscribe();
    view.tap?.([0, 0]);
    expect(taps).toEqual([[121.05, 14.55]]);
  });

  it("cuts the camera when reduced motion is set", () => {
    const previous = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    })) as typeof window.matchMedia;
    const view = fakeView();
    const controller = createMapController(document.createElement("div"), { createView: () => view, pilot: pilot() });
    controller.fitRoute();
    expect(view.durations.at(-1)).toBe(0);
    window.matchMedia = previous;
  });

  it("shows the pilot build command when the tiles are missing", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    createMapController(root, {
      createView: () => fakeView(),
      fetch: async () => new Response("missing", { status: 404 }),
    });
    await viWait();
    expect(root.textContent).toContain("pnpm --filter @shadeway/pipeline build:pilot");
  });
});

async function viWait(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
