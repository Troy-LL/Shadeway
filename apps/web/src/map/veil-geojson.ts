import type { LngLat } from "@shadeway/contract";

/** Single polygon with a pilot bbox hole so the veil has no seams at the poles or sides. */
export function pilotVeilGeoJson(bbox: readonly [number, number, number, number]) {
  const [w, s, e, n] = bbox;
  const outer: LngLat[] = [
    [-180, 90],
    [180, 90],
    [180, -90],
    [-180, -90],
    [-180, 90],
  ];
  const hole: LngLat[] = [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [outer, hole] },
      },
    ],
  };
}
