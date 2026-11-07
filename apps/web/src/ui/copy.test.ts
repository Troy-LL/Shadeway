import { describe, expect, it } from "vitest";
import {
  BUILDING_ONLY_ESTIMATE_LABEL,
  CANOPY_ESTIMATE_LABEL,
  routeEstimateLabel,
  sunMinutesFromSeconds,
} from "./copy";

describe("estimate labels", () => {
  it("pins the approved canopy label text", () => {
    expect(CANOPY_ESTIMATE_LABEL).toBe(
      "Estimate from buildings and a satellite tree map, not field-checked",
    );
    expect(routeEstimateLabel(true)).toBe(CANOPY_ESTIMATE_LABEL);
  });

  it("keeps the building-only label when canopy did not load", () => {
    expect(BUILDING_ONLY_ESTIMATE_LABEL).toBe("Building-only estimate, no trees");
    expect(routeEstimateLabel(false)).toBe(BUILDING_ONLY_ESTIMATE_LABEL);
  });
});

describe("sunMinutesFromSeconds", () => {
  it("rounds to half minutes so small tree effects show up", () => {
    expect(sunMinutesFromSeconds(239.2)).toBe(4);
    expect(sunMinutesFromSeconds(214.3)).toBe(3.5);
  });
});
