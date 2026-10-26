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
  },
  {
    weight: "balanced",
    totalMinutes: 15,
    sunMinutes: 7,
    segments: DEMO_SEGMENTS,
    confidence: "Estimate",
  },
  {
    weight: "fastest",
    totalMinutes: 12,
    sunMinutes: 11,
    segments: DEMO_SEGMENTS,
    confidence: "Estimate",
  },
];

export function defaultUiState(overrides: Partial<UiState> = {}): UiState {
  return {
    screen: "search",
    detent: "peek",
    status: "normal",
    selectedWeight: "shadiest",
    slot: 12,
    departureIsNow: true,
    routes: DEMO_ROUTES,
    locationDenied: false,
    minutesRemaining: 14,
    sunMinutesRemaining: 3,
    offRoute: false,
    navigationLine: "Turn left on 5th Ave · 120 m",
    recents: ["Uptown Mall", "Serendra"],
    ...overrides,
  };
}
