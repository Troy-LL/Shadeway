import { mkdir, writeFile } from "node:fs/promises";
import { ATTRIBUTION, HEIGHT_SOURCES, REFERENCE_DAYS, SLOT_GRID, type BBox as ContractBBox, type GraphFile, type HeightSource, type LngLat, type TileManifest } from "@shadeway/contract";
import { REFERENCE_DATES } from "@shadeway/shade-model";
import { basemapGeoJson } from "./basemap.js";
import { buildCasters } from "./casters.js";
import { interpolationCheck } from "./config.js";
import type { BBox } from "./edges.js";
import { footpathPieces, type OsmWay } from "./edges.js";
import { graphFromPieces } from "./graph.js";
import type { Overrides } from "./overrides.js";
import { shadeEdges } from "./shade-tiles.js";
import type { BuildingRecord } from "./sample.js";

export type BuildReport = {
  area: string;
  builtAt: string;
  edges: number;
  buildings: Record<HeightSource, number>;
  buildingRows: number;
  partRows: number;
  coveredEdges: number;
  coveredYesEdges: number;
  buildingPassageEdges: number;
  bridgeEdges: number;
  overrideEdges: number;
  interpolation: {
    date: string;
    minutes: number;
    edges: number;
    meanAbsoluteError: number | null;
  };
  basemap: string;
  notes: string[];
};

export type BuildInput = {
  area: string;
  box: BBox;
  ways: readonly OsmWay[];
  buildings: readonly BuildingRecord[];
  parts?: readonly BuildingRecord[];
  overrides: Overrides;
  outDir: string;
  rasterHeight?: (record: BuildingRecord) => number | undefined;
  now?: Date;
  extraNotes?: readonly string[];
  places?: readonly { name: string; at: LngLat }[];
};

export async function buildArea(input: BuildInput): Promise<BuildReport> {
  const graph = graphFromPieces(footpathPieces([...input.ways], input.box), input.overrides);
  const casters = buildCasters(
    input.buildings,
    input.parts ?? [],
    input.box,
    input.overrides,
    input.rasterHeight,
  );
  const location = boxCenter(input.box);
  const shaded = shadeEdges({
    edges: graph.edges,
    buildings: casters.casters,
    location,
    date: interpolationCheck.date,
    minutes: interpolationCheck.minutes,
  });
  const builtAt = (input.now ?? new Date()).toISOString();
  const bbox = toContractBox(input.box);
  const manifest: TileManifest = {
    version: 1,
    area: input.area,
    bbox,
    builtAt,
    slotGrid: SLOT_GRID,
    referenceDates: REFERENCE_DATES,
    graph: "graph.json",
    tiles: [
      {
        id: input.area,
        bbox,
        edgeCount: graph.edges.length,
        files: {
          "march-equinox": "tiles/march-equinox.swtl",
          "june-solstice": "tiles/june-solstice.swtl",
          "december-solstice": "tiles/december-solstice.swtl",
        },
      },
    ],
    attribution: ATTRIBUTION,
  };
  const graphFile: GraphFile = { version: 1, area: input.area, edges: graph.edges };
  const report: BuildReport = {
    area: input.area,
    builtAt,
    edges: graph.edges.length,
    buildings: casters.counts,
    buildingRows: casters.buildingRows,
    partRows: casters.partRows,
    coveredEdges: graph.coveredEdges,
    coveredYesEdges: graph.coveredYesEdges,
    buildingPassageEdges: graph.buildingPassageEdges,
    bridgeEdges: graph.bridgeEdges,
    overrideEdges: graph.overrideEdges,
    interpolation: shaded.interpolation,
    basemap: "basemap.geojson",
    notes: [
      "Basemap is basemap.geojson, one static GeoJSON file of the walking graph and building footprints. It is not a PMTiles or MVT archive.",
      "Covered edges are covered=yes, tunnel=building_passage, or a covered override. coveredYesEdges is the covered=yes subset and matches the measure's definition. Bridge edges are a bridge tag other than no or false, or a bridge override. Either covered or bridge is sun fraction 0 in every slot.",
      "Heights use shadeModel.estimateHeight: OSM height, then building:levels times 3.74 m, then the raster median, then default 3.74 m. A height override replaces that result and is source override. Shadow casters are Overture building rows and building_part rows with centroid in the box; a multipolygon is one caster per polygon. The raster median samples about every 4 m, so a footprint the 0.5 m presence test still hits can fall through to default.",
      `Interpolation error is the mean absolute sun-fraction difference at ${interpolationCheck.minutes} minutes on ${interpolationCheck.date} Asia/Manila, on edges that are not forced to full shade, between a direct shadeModel run and shadeModel.interpolateSunFraction of the three reference days.`,
      input.overrides.note,
      ...(input.extraNotes ?? []),
    ],
  };

  await mkdir(`${input.outDir}/tiles`, { recursive: true });
  await writeFile(`${input.outDir}/graph.json`, JSON.stringify(graphFile));
  await writeFile(`${input.outDir}/manifest.json`, JSON.stringify(manifest));
  await writeFile(`${input.outDir}/build-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    `${input.outDir}/basemap.geojson`,
    basemapGeoJson({ bbox, edges: graph.edges, buildings: casters.casters }),
  );
  await writeFile(
    `${input.outDir}/places.json`,
    `${JSON.stringify({ version: 1, places: input.places ?? [] }, null, 2)}\n`,
  );
  for (const day of REFERENCE_DAYS) {
    await writeFile(`${input.outDir}/tiles/${day}.swtl`, shaded.files[day]);
  }
  return report;
}

export function formatBuildReport(report: BuildReport): string {
  const lines = [
    `area=${report.area}`,
    `edges=${report.edges}`,
    `building_rows=${report.buildingRows}`,
    `part_rows=${report.partRows}`,
  ];
  for (const source of HEIGHT_SOURCES) lines.push(`buildings_${source}=${report.buildings[source]}`);
  lines.push(
    `covered_edges=${report.coveredEdges}`,
    `covered_yes_edges=${report.coveredYesEdges}`,
    `building_passage_edges=${report.buildingPassageEdges}`,
    `bridge_edges=${report.bridgeEdges}`,
    `override_edges=${report.overrideEdges}`,
    `interpolation_date=${report.interpolation.date}`,
    `interpolation_minutes=${report.interpolation.minutes}`,
    `interpolation_edges=${report.interpolation.edges}`,
    `interpolation_mae=${report.interpolation.meanAbsoluteError ?? "none"}`,
    `basemap=${report.basemap}`,
  );
  return lines.join("\n");
}

function boxCenter(box: BBox): LngLat {
  return [(box.west + box.east) / 2, (box.south + box.north) / 2];
}

function toContractBox(box: BBox): ContractBBox {
  return [box.west, box.south, box.east, box.north];
}
