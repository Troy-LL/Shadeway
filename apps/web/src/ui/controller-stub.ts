import type { LngLat, RouteWeight, SlotIndex } from "@shadeway/contract";

export type MapViewMode = "2d" | "3d";

export interface RouteGeometry {
  readonly weight: RouteWeight;
  readonly coordinates: readonly LngLat[];
}

/** Track 4 implements this in `apps/web/src/map/controller.ts`. Swap the import in `index.ts` when that lands. */
export interface MapController {
  setRoute(route: RouteGeometry | null): void;
  setViewMode(mode: MapViewMode): void;
  setSlot(slot: SlotIndex): void;
  fitRoute(): void;
  followPosition(enabled: boolean): void;
  setStartMarker(position: LngLat | null): void;
  setEndMarker(position: LngLat | null): void;
  subscribeMapTap(listener: (position: LngLat) => void): () => void;
}

export function createNoopMapController(): MapController {
  return {
    setRoute() {},
    setViewMode() {},
    setSlot() {},
    fitRoute() {},
    followPosition() {},
    setStartMarker() {},
    setEndMarker() {},
    subscribeMapTap() {
      return () => {};
    },
  };
}
