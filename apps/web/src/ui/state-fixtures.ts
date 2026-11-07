import { defaultUiState } from "./fixtures";
import type { UiState } from "./types";

export const UI_STATE_FIXTURES: Record<string, UiState> = {
  "search-peek": defaultUiState({ screen: "search", detent: "peek" }),
  "search-half": defaultUiState({ screen: "search", detent: "half" }),
  "search-offline": defaultUiState({ screen: "search", detent: "half", status: "offline" }),
  "search-location-denied": defaultUiState({ screen: "search", detent: "half", locationDenied: true }),
  "compare-default": defaultUiState({ screen: "compare", detent: "half" }),
  "compare-loading": defaultUiState({ screen: "compare", detent: "half", status: "loading-tiles" }),
  "compare-no-route": defaultUiState({ screen: "compare", detent: "half", status: "no-route" }),
  "compare-outside-pilot": defaultUiState({ screen: "compare", detent: "half", status: "outside-pilot" }),
  "compare-shade-unavailable": defaultUiState({
    screen: "compare",
    detent: "half",
    status: "shade-unavailable",
    selectedWeight: "fastest",
    preferredWeight: "shadiest",
    routes: [
      {
        weight: "fastest",
        totalMinutes: 12,
        sunMinutes: 0,
        segments: [],
        confidence: "Estimate",
        geometry: [],
        distanceM: 500,
        edgeKey: "fast",
        shadeUnavailable: true,
      },
    ],
  }),
  "compare-tile-failed": defaultUiState({ screen: "compare", detent: "half", status: "tile-failed" }),
  "in-route-peek": defaultUiState({ screen: "in-route", detent: "half" }),
};

export const UI_STATE_IDS = Object.keys(UI_STATE_FIXTURES);
