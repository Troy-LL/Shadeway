import { describe, expect, it } from "vitest";
import { pilotVeilGeoJson } from "./veil-geojson";

describe("pilotVeilGeoJson", () => {
  it("uses one world polygon with a bbox hole so north and south edges stay covered", () => {
    const bbox = [121.04, 14.54, 121.06, 14.56] as const;
    const data = pilotVeilGeoJson(bbox);
    expect(data.features).toHaveLength(1);
    const polygon = data.features[0]?.geometry;
    expect(polygon?.type).toBe("Polygon");
    expect(polygon?.coordinates).toHaveLength(2);
    const [outer, hole] = polygon?.coordinates ?? [];
    expect(outer?.[0]).toEqual([-180, 90]);
    expect(outer?.[2]).toEqual([180, -90]);
    expect(hole?.[0]).toEqual([bbox[0], bbox[1]]);
    expect(hole?.[2]).toEqual([bbox[2], bbox[3]]);
  });
});
