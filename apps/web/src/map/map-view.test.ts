import { describe, expect, it } from "vitest";
import { shadowLayerVisibility } from "./view";

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
