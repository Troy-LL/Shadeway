import type { Building, Edge, LngLat } from "@shadeway/contract";
import { slotStartMinutes } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { describe, expect, it } from "vitest";
import { offsetBehind, paintRoute, shadowDraws, sunLightDirection } from "./scene";

const origin: LngLat = [121.05, 14.552];

function square(id: string, source: Building["heightSource"]): Building {
  return {
    id,
    heightM: 30,
    heightSource: source,
    footprint: [
      [121.05, 14.552],
      [121.0504, 14.552],
      [121.0504, 14.5523],
      [121.05, 14.5523],
    ],
  };
}

describe("sun light", () => {
  it("sends the ray from the sun toward the ground", () => {
    const sun = shadeModel.sunPosition({ date: "2026-10-26", minutes: slotStartMinutes(18) }, origin);
    const [x, y, z] = sunLightDirection(sun);
    expect(z).toBeLessThan(0);
    const azimuth = (sun.azimuthDeg * Math.PI) / 180;
    expect(x).toBeCloseTo(-Math.sin(azimuth) * Math.cos((sun.elevationDeg * Math.PI) / 180), 5);
    expect(y).toBeCloseTo(-Math.cos(azimuth) * Math.cos((sun.elevationDeg * Math.PI) / 180), 5);
  });
});

describe("follow camera", () => {
  it("sits behind the walker", () => {
    const at: LngLat = [121.05, 14.552];
    const behind = offsetBehind(at, 0, 90);
    expect(behind[1]).toBeLessThan(at[1]);
    expect(behind[0]).toBeCloseTo(at[0], 5);
  });
});

describe("shadow draws", () => {
  it("dashes an estimated height and keeps an OSM height solid", () => {
    const sun = shadeModel.sunPosition({ date: "2026-10-26", minutes: slotStartMinutes(18) }, origin);
    const draws = shadowDraws([square("est", "raster"), square("tag", "osm")], sun);
    const estimated = draws.find((draw) => draw.estimated);
    const measured = draws.find((draw) => !draw.estimated);
    expect(estimated?.ring.at(0)).toEqual(estimated?.ring.at(-1));
    expect(measured).toBeTruthy();
    expect((estimated?.ring.length ?? 0) >= 4).toBe(true);
  });
});

describe("route paint", () => {
  it("draws a covered edge in teal with a roof tick", () => {
    const line: LngLat[] = [
      [121.0486, 14.5515],
      [121.0492, 14.5514],
      [121.0498, 14.5513],
    ];
    const edge: Edge = {
      id: 1,
      from: 1,
      to: 2,
      lengthM: 140,
      geometry: line,
      covered: true,
      bridge: false,
    };
    const paint = paintRoute(line, [edge], []);
    expect(paint.shaded.length).toBeGreaterThan(0);
    expect(paint.sunny.length).toBe(0);
    expect(paint.ticks.length).toBeGreaterThan(0);
  });
});
