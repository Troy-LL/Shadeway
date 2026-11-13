import { ATTRIBUTION, type BBox, type Building, type Edge, type LngLat, type TreeCaster } from "@shadeway/contract";

export function basemapGeoJson(input: {
  bbox: BBox;
  edges: readonly Edge[];
  buildings: readonly Building[];
  trees?: readonly TreeCaster[];
  land?: readonly { kind: "park" | "water"; id: string; ring: readonly LngLat[] }[];
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
    ...(input.trees ?? []).flatMap((tree) => {
      const close = tree.footprint[0];
      if (close === undefined) return [];
      return [
        {
          type: "Feature",
          properties: {
            kind: "tree",
            id: tree.id,
            crownHeightM: tree.crownHeightM,
            transmittance: tree.transmittance,
          },
          geometry: {
            type: "Polygon",
            coordinates: [[...tree.footprint, close]],
          },
        },
      ];
    }),
    ...(input.land ?? []).flatMap((area) => {
      const ring = closeRing(area.ring);
      if (ring.length < 4) return [];
      return [
        {
          type: "Feature",
          properties: { kind: area.kind, id: area.id },
          geometry: { type: "Polygon", coordinates: [ring] },
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

function closeRing(ring: readonly LngLat[]): LngLat[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return [...ring];
  if (first[0] === last[0] && first[1] === last[1]) return [...ring];
  return [...ring, first];
}
