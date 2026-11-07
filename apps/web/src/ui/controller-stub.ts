import type { MapController } from "../map/controller";

export type { MapController, RouteGeometry } from "../map/controller";

export function createNoopMapController(): MapController {
  return {
    setRoute() {},
    setAlternateRoute() {},
    setSlot() {},
    fitRoute() {},
    followPosition() {},
    setFollowFraction() {},
    setStartMarker() {},
    setEndMarker() {},
    setPilotBox() {},
    whenReady() {
      return Promise.resolve(null);
    },
    subscribeMapTap() {
      return () => {};
    },
  };
}
