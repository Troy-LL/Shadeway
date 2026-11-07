import type { RouteCardModel, UiState } from "./types";

const DEMO_SEGMENTS: RouteCardModel["segments"] = [
  { from: 0, to: 0.2, sunny: true },
  { from: 0.2, to: 0.55, sunny: false },
  { from: 0.55, to: 0.7, sunny: true },
  { from: 0.7, to: 1, sunny: false },
];

export const DEMO_ROUTES: readonly RouteCardModel[] = [
  {
    weight: "shadiest",
    totalMinutes: 18,
    sunMinutes: 4,
    segments: DEMO_SEGMENTS,
    confidence: "Estimate",
    geometry: [],
    distanceM: 784,
    edgeKey: "shadiest",
  },
  {
    weight: "fastest",
    totalMinutes: 12,
    sunMinutes: 11,
    segments: DEMO_SEGMENTS,
    confidence: "Estimate",
    geometry: [],
    distanceM: 518,
    edgeKey: "fastest",
  },
];

export function defaultUiState(overrides: Partial<UiState> = {}): UiState {
  return {
    screen: "search",
    detent: "half",
    status: "normal",
    selectedWeight: "shadiest",
    slot: 12,
    departureIsNow: true,
    routes: DEMO_ROUTES,
    locationDenied: false,
    tripMinutes: 18,
    tripSunMinutes: 4,
    tripDistanceM: 784,
    fromQuery: "",
    toQuery: "",
    focusedField: "to",
    editingField: false,
    query: "",
    places: [],
    start: null,
    end: null,
    timePickerOpen: false,
    ...overrides,
  };
}
