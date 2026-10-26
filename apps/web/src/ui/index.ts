import type { MapController } from "./controller-stub";
import { createUiApp } from "./app";

export { createUiApp } from "./app";

export function mountUi(root: HTMLElement, controller: MapController): void {
  createUiApp(root, controller);
}
export type { MapController, MapViewMode, RouteGeometry } from "./controller-stub";
export { ROUTE_ESTIMATE_LABEL, COPY } from "./copy";
export { renderUiState, renderUiStateById } from "./render";
export { UI_STATE_FIXTURES, UI_STATE_IDS } from "./state-fixtures";
export type { UiState, UiScreen, UiStatus, SheetDetent } from "./types";
