import type { MapController } from "../map/controller";
import { createUiApp } from "./app";

export { createUiApp } from "./app";

export function mountUi(root: HTMLElement, controller: MapController): void {
  createUiApp(root, controller);
}
export type { MapController, RouteGeometry } from "../map/controller";
export { BUILDING_ONLY_ESTIMATE_LABEL, CANOPY_ESTIMATE_LABEL, COPY, routeEstimateLabel } from "./copy";
export { renderUiState, renderUiStateById } from "./render";
export { UI_STATE_FIXTURES, UI_STATE_IDS } from "./state-fixtures";
export type { UiState, UiScreen, UiStatus, SheetDetent } from "./types";
