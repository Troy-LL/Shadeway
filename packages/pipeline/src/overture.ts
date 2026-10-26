import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { duckdbUrl, overtureS3 } from "./config.js";
import type { BBox } from "./edges.js";
import type { BuildingRecord, Ring } from "./sample.js";

const execFileAsync = promisify(execFile);

type OvertureRow = {
  id?: string | null;
  height: number | null;
  num_floors: number | null;
  geojson: { type: string; coordinates: number[][][] | number[][][][] };
};

export async function loadShadeFootprints(
  cacheDir: string,
  box: BBox,
  type: "building" | "building_part",
): Promise<BuildingRecord[]> {
  const jsonPath = `${cacheDir}/overture-${type}-${box.south}-${box.west}-${box.north}-${box.east}.ndjson`;
  try {
    await access(jsonPath);
  } catch {
    const duckdb = await ensureDuckdb(cacheDir);
    const source = overtureS3.replace("type=building/", `type=${type}/`);
    const sql = `
INSTALL httpfs;
LOAD httpfs;
INSTALL spatial;
LOAD spatial;
CREATE OR REPLACE SECRET s (TYPE S3, PROVIDER config, KEY_ID '', SECRET '', REGION 'us-west-2');
COPY (
  SELECT id, height, num_floors, ST_AsGeoJSON(geometry) AS geojson
  FROM read_parquet('${source}', hive_partitioning=true)
  WHERE bbox.xmin < ${box.east} AND bbox.xmax > ${box.west}
    AND bbox.ymin < ${box.north} AND bbox.ymax > ${box.south}
) TO '${jsonPath}' (FORMAT JSON);
`;
    await execFileAsync(duckdb, ["-no-agent", "-c", sql], { maxBuffer: 10 * 1024 * 1024 });
  }
  return readBuildings(jsonPath);
}

export async function loadBuildings(cacheDir: string, box: BBox): Promise<BuildingRecord[]> {
  const jsonPath = `${cacheDir}/bgc-buildings-${box.south}-${box.west}-${box.north}-${box.east}.ndjson`;
  try {
    await access(jsonPath);
  } catch {
    const duckdb = await ensureDuckdb(cacheDir);
    const sql = `
INSTALL httpfs;
LOAD httpfs;
INSTALL spatial;
LOAD spatial;
CREATE OR REPLACE SECRET s (TYPE S3, PROVIDER config, KEY_ID '', SECRET '', REGION 'us-west-2');
COPY (
  SELECT height, num_floors, ST_AsGeoJSON(geometry) AS geojson
  FROM read_parquet('${overtureS3}', hive_partitioning=true)
  WHERE bbox.xmin < ${box.east} AND bbox.xmax > ${box.west}
    AND bbox.ymin < ${box.north} AND bbox.ymax > ${box.south}
) TO '${jsonPath}' (FORMAT JSON);
`;
    await execFileAsync(duckdb, ["-no-agent", "-c", sql], { maxBuffer: 10 * 1024 * 1024 });
  }
  return readBuildings(jsonPath);
}

async function ensureDuckdb(cacheDir: string): Promise<string> {
  const bin = `${cacheDir}/duckdb`;
  try {
    await access(bin);
    return bin;
  } catch {
    await mkdir(cacheDir, { recursive: true });
    const response = await fetch(duckdbUrl);
    if (!response.ok) {
      throw new Error(`duckdb download failed: HTTP ${response.status}`);
    }
    const tarPath = `${cacheDir}/duckdb.tar.gz`;
    await writeFile(tarPath, Buffer.from(await response.arrayBuffer()));
    await execFileAsync("tar", ["-xzf", tarPath, "-C", cacheDir]);
    await chmod(bin, 0o755);
    return bin;
  }
}

async function readBuildings(jsonPath: string): Promise<BuildingRecord[]> {
  const buildings: BuildingRecord[] = [];
  const lines = createInterface({ input: createReadStream(jsonPath), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    const row = JSON.parse(line) as OvertureRow;
    const geojson = typeof row.geojson === "string" ? JSON.parse(row.geojson) as OvertureRow["geojson"] : row.geojson;
    const parts = polygonsOf(geojson);
    const record: BuildingRecord = {
      height: row.height,
      numFloors: row.num_floors,
      rings: parts[0] ?? [],
      parts,
    };
    if (typeof row.id === "string" && row.id !== "") record.id = row.id;
    buildings.push(record);
  }
  return buildings;
}

function polygonsOf(geojson: OvertureRow["geojson"]): Ring[][] {
  if (geojson.type === "Polygon") return [geojson.coordinates as Ring[]];
  if (geojson.type === "MultiPolygon") return geojson.coordinates as Ring[][];
  return [];
}
