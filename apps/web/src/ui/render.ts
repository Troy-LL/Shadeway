import { createUiApp } from "./app";
import type { MapController } from "./controller-stub";
import { createNoopMapController } from "./controller-stub";
import { UI_STATE_FIXTURES } from "./state-fixtures";
import type { UiState } from "./types";

export function renderUiState(state: UiState, controller?: MapController): HTMLElement {
  const host = document.createElement("div");
  createUiApp(host, controller ?? createNoopMapController(), state);
  return host;
}

export function renderUiStateById(stateId: string): HTMLElement {
  const state = UI_STATE_FIXTURES[stateId];
  if (!state) throw new Error(`Unknown UI state id: ${stateId}`);
  return renderUiState(state);
}
