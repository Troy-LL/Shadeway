import { describe, expect, it } from "vitest";
import { defaultUiState } from "./fixtures";
import { isPilotPickOutside, placePickField } from "./pick-place";

describe("placePickField", () => {
  it("uses the focused search field instead of filling From first", () => {
    const state = defaultUiState({ focusedField: "to", start: null, end: null });
    expect(placePickField(state)).toBe("to");
  });
});

describe("isPilotPickOutside", () => {
  it("flags picks outside the pilot bbox", () => {
    const bbox = [121.04, 14.54, 121.06, 14.56] as const;
    expect(isPilotPickOutside(bbox, [121.05, 14.55])).toBe(false);
    expect(isPilotPickOutside(bbox, [120, 14.55])).toBe(true);
  });
});
