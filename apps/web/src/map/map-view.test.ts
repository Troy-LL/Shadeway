import { describe, expect, it } from "vitest";
import { clampFitPadding, shadowLayerVisibility } from "./view";

describe("clampFitPadding", () => {
  it("scales padding down when it would exceed the map viewport", () => {
    const inset = clampFitPadding({ top: 64, right: 16, bottom: 436, left: 16 }, 390, 844);
    expect(inset).not.toBeNull();
    expect(inset!.top + inset!.bottom).toBeLessThan(844);
  });
});

describe("shadowLayerVisibility", () => {
  it("hides all shadow layers when off and shows fill plus estimated edge when on", () => {
    expect(shadowLayerVisibility(false)).toEqual({
      shadows: "none",
      "shadow-edge": "none",
      "shadow-edge-estimated": "none",
    });
    expect(shadowLayerVisibility(true)).toEqual({
      shadows: "visible",
      "shadow-edge": "none",
      "shadow-edge-estimated": "visible",
    });
  });
});
