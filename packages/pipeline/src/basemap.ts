import { ATTRIBUTION, type BBox, type Building, type Edge } from "@shadeway/contract";

export function basemapGeoJson(input: {
  bbox: BBox;
  edges: readonly Edge[];
  buildings: readonly Building[];
}): string {
  const features = [
    ...input.edges.map((edge) => ({
      type: "Feature",
      properties: {
        kind: "edge",
        id: edge.id,
        covered: edge.covered,
        bridge: edge.bridge,
        ...(edge.overrideId === undefined ? {} : { overrideId: edge.overrideId }),
      },
      geometry: { type: "LineString", coordinates: edge.geometry },
    })),
    ...input.buildings.flatMap((building) => {
      const close = building.footprint[0];
      if (close === undefined) return [];
      return [
        {
          type: "Feature",
          properties: {
            kind: "building",
            id: building.id,
            heightM: building.heightM,
            heightSource: building.heightSource,
          },
          geometry: {
            type: "Polygon",
            coordinates: [[...building.footprint, close]],
          },
        },
      ];
    }),
  ];
  return JSON.stringify({
    type: "FeatureCollection",
    attribution: ATTRIBUTION,
    bbox: input.bbox,
    features,
  });
}
