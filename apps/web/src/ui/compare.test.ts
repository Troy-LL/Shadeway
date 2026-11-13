// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { compareCardTitle } from "./screens/compare";
import type { RouteCardModel } from "./types";

function card(overrides: Partial<RouteCardModel> & Pick<RouteCardModel, "weight">): RouteCardModel {
  return {
    totalMinutes: 6,
    sunMinutes: null,
    segments: [],
    confidence: "Estimate",
    geometry: [
      [121.05, 14.55],
      [121.051, 14.551],
    ],
    distanceM: 518,
    edgeKey: "1",
    shadeUnavailable: true,
    ...overrides,
  };
}

describe("compareCardTitle", () => {
  it("uses Fastest walk when shade is unavailable even if routes were identical", () => {
    expect(
      compareCardTitle(
        card({
          weight: "fastest",
          note: COPY.shadiestAndFastest,
          shadeUnavailable: true,
        }),
      ),
    ).toBe(COPY.fastestWalk);
    expect(compareCardTitle(card({ weight: "shadiest", shadeUnavailable: true }))).toBe(COPY.fastestWalk);
  });

  it("still merges titles only when shade is available", () => {
    expect(
      compareCardTitle(
        card({
          weight: "fastest",
          shadeUnavailable: false,
          sunMinutes: 4,
          note: COPY.shadiestAndFastest,
        }),
      ),
    ).toBe(COPY.shadiestAndFastest);
  });
});
