import type { LngLat } from "@shadeway/contract";
import type { BBox } from "./edges.js";

export const bgcBox: BBox = {
  south: 14.5415,
  west: 121.0417,
  north: 14.5628,
  east: 121.0603,
};

export const overtureRelease = "2026-10-21.0";
export const overtureOsmCutoff = "2026-09-12";
export const overtureS3 = `s3://overturemaps-us-west-2/release/${overtureRelease}/theme=buildings/type=building/*.parquet`;
export const overtureReleaseNotes = "https://docs.overturemaps.org/blog/2026/10/21/release-notes/";

export const googleTileUrl =
  "https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/3397c_2023_06_30/tile_IQqvgG9RLG4.tif";
export const googleManifestUrl =
  "https://storage.googleapis.com/open-buildings-temporal-data/v1/manifests/33_EPSG_32651_2023_06_30.json";
export const googleInferenceDate = "2023-06-30";
export const googleImageryStart = "2023-01-01";
export const googleImageryEnd = "2023-12-27";

export const canopyTileUrl =
  "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/132303122.tif";
export const canopyObjectModified = "2024-04-10";

export const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export const duckdbRelease = "v2.0.0";
export const duckdbUrl = `https://github.com/duckdb/duckdb/releases/download/${duckdbRelease}/duckdb-cli-linux-amd64.tar.gz`;

/** Non-reference date used for the build report's interpolation error, 12:00 Asia/Manila. */
export const interpolationCheck = { date: "2026-05-01", minutes: 12 * 60 } as const;

/**
 * Three walks inside the pilot box. Coordinates are `[lng, lat]`.
 * Covered and bridge ways were read from Overpass (`https://overpass.openstreetmap.fr/api/interpreter`, OSM timestamp 2026-08-10T00:10:23Z).
 * Tree counts are `natural=tree` nodes within 25 m of the named way in that same extract.
 */
export const pilotWalks: readonly {
  id: string;
  from: LngLat;
  to: LngLat;
  note: string;
}[] = [
  {
    id: "high-street-covered",
    from: [121.0476, 14.55152],
    to: [121.04606, 14.55202],
    note: "OSM way 846184128, highway=pedestrian, name=Bonifacio High Street, covered=yes. A covered walkway.",
  },
  {
    id: "high-street-trees",
    from: [121.04862, 14.55148],
    to: [121.05303, 14.55012],
    note: "Pedestrian Bonifacio High Street from way 203893598 (14.55148, 121.04862) to way 178125957 (14.55012, 121.05303). natural=tree nodes within 25 m: 25 on way 203893598 and 34 on parallel footway 203893587. Tree-lined by those tags.",
  },
  {
    id: "uptown-footbridge",
    from: [121.0541499, 14.5569653],
    to: [121.0543932, 14.55879],
    note: "OSM way 613886961, highway=footway, bridge=viaduct, layer=1. An overpass.",
  },
];
