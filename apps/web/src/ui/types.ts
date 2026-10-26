import type { RouteWeight, SlotIndex } from "@shadeway/contract";
import type { ConfidenceBadge } from "./copy";

export type SheetDetent = "peek" | "half" | "full";

export type UiScreen = "search" | "compare" | "in-route";

export type UiStatus =
  | "normal"
  | "loading-tiles"
  | "no-route"
  | "outside-pilot"
  | "night"
  | "offline"
  | "tile-failed";

export interface ShadeSegment {
  /** Start along the route, 0 to 1. */
  readonly from: number;
  /** End along the route, 0 to 1. */
  readonly to: number;
  /** True when the stretch is in direct sun. */
  readonly sunny: boolean;
}

export interface RouteCardModel {
  readonly weight: RouteWeight;
  readonly totalMinutes: number;
  readonly sunMinutes: number;
  readonly segments: readonly ShadeSegment[];
  readonly confidence: ConfidenceBadge;
}

export interface UiState {
  readonly screen: UiScreen;
  readonly detent: SheetDetent;
  readonly status: UiStatus;
  readonly selectedWeight: RouteWeight;
  readonly slot: SlotIndex;
  readonly departureIsNow: boolean;
  readonly routes: readonly RouteCardModel[];
  readonly locationDenied: boolean;
  readonly minutesRemaining: number;
  readonly sunMinutesRemaining: number;
  readonly offRoute: boolean;
  readonly navigationLine: string;
  readonly recents: readonly string[];
}
