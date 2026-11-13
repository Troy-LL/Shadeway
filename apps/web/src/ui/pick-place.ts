import type { FieldFocus, PlacePick, UiState } from "./types";

/** Which search field a place pick should update — always the focused field. */
export function placePickField(state: Pick<UiState, "focusedField">): FieldFocus {
  return state.focusedField;
}

export function isPilotPickOutside(
  bbox: readonly [number, number, number, number],
  at: PlacePick["at"],
): boolean {
  const [west, south, east, north] = bbox;
  return at[0] < west || at[0] > east || at[1] < south || at[1] > north;
}
