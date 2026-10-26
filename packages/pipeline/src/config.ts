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
