import type { MapController } from "../map/controller";

export type { MapController, MapViewMode, RouteGeometry } from "../map/controller";

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
