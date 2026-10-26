import { defaultUiState } from "./fixtures";
import type { UiState } from "./types";

export const UI_STATE_FIXTURES: Record<string, UiState> = {
  "search-peek": defaultUiState({ screen: "search", detent: "peek" }),
  "search-half": defaultUiState({ screen: "search", detent: "half" }),
  "search-full": defaultUiState({ screen: "search", detent: "full" }),
  "search-offline": defaultUiState({ screen: "search", detent: "half", status: "offline" }),
  "search-location-denied": defaultUiState({ screen: "search", detent: "half", locationDenied: true }),
  "compare-default": defaultUiState({ screen: "compare", detent: "half" }),
  "compare-loading": defaultUiState({ screen: "compare", detent: "half", status: "loading-tiles" }),
  "compare-no-route": defaultUiState({ screen: "compare", detent: "half", status: "no-route" }),
  "compare-outside-pilot": defaultUiState({ screen: "compare", detent: "half", status: "outside-pilot" }),
  "compare-night": defaultUiState({ screen: "compare", detent: "half", status: "night", selectedWeight: "fastest" }),
  "compare-tile-failed": defaultUiState({ screen: "compare", detent: "half", status: "tile-failed" }),
  "in-route-peek": defaultUiState({ screen: "in-route", detent: "peek" }),
  "in-route-off-route": defaultUiState({ screen: "in-route", detent: "peek", offRoute: true }),
};

export const UI_STATE_IDS = Object.keys(UI_STATE_FIXTURES);
