import { describe, expect, it } from "vitest";
import { layoutFromVisualViewport } from "./viewport-layout";

describe("layoutFromVisualViewport", () => {
  it("lifts the sheet when the visual viewport shrinks for the keyboard", () => {
    const layout = layoutFromVisualViewport({
      innerHeight: 844,
      safeTopPx: 0,
      viewportHeight: 420,
      viewportOffsetTop: 120,
      desktop: false,
    });
    expect(layout.keyboardOffsetPx).toBe(844 - 420 - 120);
    expect(layout.editHeightPx).toBeGreaterThanOrEqual(176);
  });

  it("zeros layout on desktop", () => {
    expect(
      layoutFromVisualViewport({
        innerHeight: 900,
        safeTopPx: 0,
        viewportHeight: 900,
        viewportOffsetTop: 0,
        desktop: true,
      }),
    ).toEqual({ editHeightPx: 0, keyboardOffsetPx: 0 });
  });
});
