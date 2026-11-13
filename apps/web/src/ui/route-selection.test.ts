import { describe, expect, it } from "vitest";
import { effectiveRouteWeight } from "./route-selection";

describe("effectiveRouteWeight", () => {
  it("forces fastest while shade is unavailable and restores shadiest when coverage returns", () => {
    expect(effectiveRouteWeight("shadiest", true)).toBe("fastest");
    expect(effectiveRouteWeight("shadiest", false)).toBe("shadiest");
    expect(effectiveRouteWeight("fastest", true)).toBe("fastest");
    expect(effectiveRouteWeight("fastest", false)).toBe("fastest");
  });
});
