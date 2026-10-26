import { describe, expect, it } from "vitest";
import { basemapGeoJson } from "./basemap.js";
import { readLandcover } from "./osm.js";

describe("landcover", () => {
  it("keeps park and water polygons for the basemap", () => {
    const land = readLandcover({
      elements: [
        {
          type: "way",
          id: 7,
          tags: { leisure: "park", name: "Sundial Park" },
          geometry: [
            { lon: 121.05, lat: 14.55 },
            { lon: 121.051, lat: 14.55 },
            { lon: 121.051, lat: 14.551 },
            { lon: 121.05, lat: 14.551 },
          ],
        },
        {
          type: "way",
          id: 8,
          tags: { natural: "water" },
          geometry: [
            { lon: 121.04, lat: 14.54 },
            { lon: 121.041, lat: 14.54 },
            { lon: 121.04, lat: 14.541 },
          ],
        },
      ],
    });
    expect(land.map((area) => area.kind)).toEqual(["park"]);
    const basemap = JSON.parse(
      basemapGeoJson({
        bbox: [121.04, 14.54, 121.06, 14.56],
        edges: [],
        buildings: [],
        land,
      }),
    ) as { features: { properties: { kind: string } }[] };
    expect(basemap.features.map((feature) => feature.properties.kind)).toEqual(["park"]);
  });
});