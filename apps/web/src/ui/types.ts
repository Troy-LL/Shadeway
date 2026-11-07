import type { LngLat, RouteWeight, SlotIndex } from "@shadeway/contract";
import type { ConfidenceBadge } from "./copy";

export type SheetDetent = "peek" | "half";

export type UiScreen = "search" | "compare" | "in-route";

export type FieldFocus = "from" | "to";

export type UiStatus =
  | "normal"
  | "loading-tiles"
  | "no-route"
  | "outside-pilot"
  | "shade-unavailable"
  | "offline"
  | "tile-failed";

export interface ShadeSegment {
  readonly from: number;
  readonly to: number;
  readonly sunny: boolean;
}

export interface PlacePick {
  readonly name: string;
  readonly at: LngLat;
}

export interface RouteCardModel {
  readonly weight: RouteWeight;
  readonly totalMinutes: number;
  readonly sunMinutes: number;
  readonly segments: readonly ShadeSegment[];
  readonly confidence: ConfidenceBadge;
  readonly geometry: readonly LngLat[];
  readonly distanceM: number;
  readonly edgeKey: string;
  readonly note?: string;
  readonly shadeUnavailable?: boolean;
}

export interface UiState {
  readonly screen: UiScreen;
  readonly detent: SheetDetent;
  readonly status: UiStatus;
  readonly selectedWeight: RouteWeight;
  readonly preferredWeight: RouteWeight;
  readonly slot: SlotIndex;
  readonly departureIsNow: boolean;
  readonly routes: readonly RouteCardModel[];
  readonly locationDenied: boolean;
  readonly tripMinutes: number;
  readonly tripSunMinutes: number;
  readonly tripDistanceM: number;
  readonly fromQuery: string;
  readonly toQuery: string;
  readonly focusedField: FieldFocus;
  readonly editingField: boolean;
  readonly query: string;
  readonly places: readonly PlacePick[];
  readonly start: PlacePick | null;
  readonly end: PlacePick | null;
  readonly timePickerOpen: boolean;
}
