import type { BuildingHeight, HeightInput } from "@shadeway/contract";

/** Meters per OSM `building:levels`, the multiplier in decision 004. */
const METERS_PER_LEVEL = 3.74;

function usable(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function estimateHeight(input: HeightInput): BuildingHeight {
  if (usable(input.heightTagM)) return { heightM: input.heightTagM, heightSource: "osm" };
  if (usable(input.levels)) return { heightM: input.levels * METERS_PER_LEVEL, heightSource: "levels" };
  if (usable(input.rasterHeightM)) return { heightM: input.rasterHeightM, heightSource: "raster" };
  return { heightM: METERS_PER_LEVEL, heightSource: "default" };
}
