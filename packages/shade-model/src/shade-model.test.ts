import { describe, expect, it } from "vitest";
import type { Building, Edge, HeightSource, LngLat, SunPosition } from "@shadeway/contract";
import { REFERENCE_DATES, shadeModel } from "./index";

// WGS84 equatorial radius, duplicated so a different radius in the model fails the tip checks.
const EARTH_EQUATOR_M = 6378137;
const METERS_PER_DEG_LAT = (Math.PI * EARTH_EQUATOR_M) / 180;
const ORIGIN: LngLat = [121.05, 14.55];
const HEIGHT_M = 10;

function lngLat(eastM: number, northM: number): LngLat {
  return [
    ORIGIN[0] + eastM / (METERS_PER_DEG_LAT * Math.cos((ORIGIN[1] * Math.PI) / 180)),
    ORIGIN[1] + northM / METERS_PER_DEG_LAT,
  ];
}

function toMeters(point: LngLat): [number, number] {
  return [
    (point[0] - ORIGIN[0]) * METERS_PER_DEG_LAT * Math.cos((ORIGIN[1] * Math.PI) / 180),
    (point[1] - ORIGIN[1]) * METERS_PER_DEG_LAT,
  ];
}

function building(id: string, meters: readonly (readonly [number, number])[], source: HeightSource = "osm"): Building {
  return {
    id,
    heightM: HEIGHT_M,
    heightSource: source,
    footprint: meters.map(([east, north]) => lngLat(east, north)),
  };
}

function sun(azimuthDeg: number, elevationDeg: number): SunPosition {
  return { azimuthDeg, elevationDeg };
}

function expectVertex(ring: readonly LngLat[], east: number, north: number) {
  const hit = ring.some((point) => {
    const [e, n] = toMeters(point);
    return Math.hypot(e - east, n - north) <= 1e-3;
  });
  expect(hit).toBe(true);
}

function signedArea(ring: readonly LngLat[]): number {
  const meters = ring.map(toMeters);
  let area = 0;
  for (let i = 0; i < meters.length; i++) {
    const current = meters[i];
    const next = meters[(i + 1) % meters.length];
    if (current === undefined || next === undefined) continue;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

const SQUARE = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
] as const;

const TRIANGLE = [
  [0, 0],
  [30, 0],
  [0, 40],
] as const;

// Concave L. The missing square is x = 10..20, y = 10..20.
const L_SHAPE = [
  [0, 0],
  [20, 0],
  [20, 10],
  [10, 10],
  [10, 20],
  [0, 20],
] as const;

function edge(geometry: readonly (readonly [number, number])[], covered = false): Edge {
  return {
    id: 1,
    from: 1,
    to: 2,
    lengthM: 1,
    geometry: geometry.map(([east, north]) => lngLat(east, north)),
    covered,
    bridge: false,
  };
}

describe("sun position", () => {
  // NOAA solar calculator, geometric elevation, no refraction.
  // Manila local time is UTC+8. Location lon 121.05, lat 14.55.
  // JD at 0h UT from the Gregorian formula, then minutes/1440 minus the zone.
  //
  // 2026-03-20 12:00 (equinox noon), worked intermediates:
  // JD 2461119.6666667, T 0.26214009, mean longitude 357.711405 deg,
  // mean anomaly 74.323264 deg, equation of center 1.852357 deg,
  // apparent longitude 359.559861 deg, obliquity 23.438256 deg,
  // declination -0.175069 deg, equation of time -7.531562 min,
  // hour angle -0.832891 deg.
  it("matches the equinox noon position", () => {
    const position = shadeModel.sunPosition({ date: "2026-03-20", minutes: 12 * 60 }, ORIGIN);
    expect(shadeModel.sunDay("2026-03-20").declinationDeg).toBeCloseTo(-0.175069, 4);
    expect(position.azimuthDeg).toBeCloseTo(176.726595, 4);
    expect(position.elevationDeg).toBeCloseTo(75.251897, 4);
  });

  // 2026-06-21 08:00. Equation of time -1.715490 min, hour angle -59.378872 deg.
  // Sun is east of north. sunDay reports the noon declination, 23.438019 deg.
  it("matches the June morning position", () => {
    const position = shadeModel.referenceSunPosition("june-solstice", 4, ORIGIN);
    expect(position).toEqual(shadeModel.sunPosition({ date: "2026-06-21", minutes: 8 * 60 }, ORIGIN));
    expect(shadeModel.sunDay("2026-06-21").declinationDeg).toBeCloseTo(23.438019, 4);
    expect(position.azimuthDeg).toBeCloseTo(71.277794, 4);
    expect(position.elevationDeg).toBeCloseTo(33.522905, 4);
  });

  // 2026-06-21 12:00. Declination 23.438019 deg is north of Manila's latitude,
  // so the noon sun sits just west of north. Hour angle 0.612058 deg.
  it("matches the June noon position", () => {
    const position = shadeModel.referenceSunPosition("june-solstice", 12, ORIGIN);
    expect(shadeModel.sunDay("2026-06-21").declinationDeg).toBeCloseTo(23.438019, 4);
    expect(position.azimuthDeg).toBeCloseTo(356.37065, 4);
    expect(position.elevationDeg).toBeCloseTo(81.09321, 4);
  });

  // 2026-12-22 16:00. Equation of time 1.509847 min, hour angle 61.427462 deg.
  // Sun is west of south. sunDay reports the noon declination, -23.437486 deg.
  it("matches the December afternoon position", () => {
    const position = shadeModel.referenceSunPosition("december-solstice", 20, ORIGIN);
    expect(position).toEqual(
      shadeModel.sunPosition({ date: REFERENCE_DATES["december-solstice"], minutes: 16 * 60 }, ORIGIN),
    );
    expect(shadeModel.sunDay("2026-12-22").declinationDeg).toBeCloseTo(-23.437486, 4);
    expect(position.azimuthDeg).toBeCloseTo(238.42481, 4);
    expect(position.elevationDeg).toBeCloseTo(18.954503, 4);
  });

  // Sunrise hour angle from cos(H) = -tan(lat) tan(dec).
  // lat 14.55 deg, dec -23.44 deg: cos(H) = tan(14.55) tan(23.44) ≈ 0.1125, H ≈ 83.5 deg,
  // 83.5 / 15 h ≈ 5.57 h before solar noon, so sunrise is after 06:00.
  it("is below the horizon at the December 06:00 slot", () => {
    const position = shadeModel.referenceSunPosition("december-solstice", 0, ORIGIN);
    expect(position.elevationDeg).toBeLessThan(0);
    expect(() => shadeModel.referenceSunPosition("june-solstice", 25, ORIGIN)).toThrow(RangeError);
    expect(() => shadeModel.sunPosition({ date: "2026-02-31", minutes: 0 }, ORIGIN)).toThrow(RangeError);
  });
});

describe("reference-day interpolation", () => {
  it("uses the noon declination extrema as the reference dates", () => {
    const declination = (date: string) => shadeModel.sunDay(date).declinationDeg;
    expect(Math.abs(declination("2026-03-20"))).toBeLessThan(Math.abs(declination("2026-03-19")));
    expect(Math.abs(declination("2026-03-20"))).toBeLessThan(Math.abs(declination("2026-03-21")));
    expect(declination("2026-06-21")).toBeGreaterThan(declination("2026-06-20"));
    expect(declination("2026-06-21")).toBeGreaterThan(declination("2026-06-22"));
    expect(declination("2026-12-22")).toBeLessThan(declination("2026-12-21"));
    expect(declination("2026-12-22")).toBeLessThan(declination("2026-12-23"));
    for (const day of ["march-equinox", "june-solstice", "december-solstice"] as const) {
      const mapped = shadeModel.sunDay(REFERENCE_DATES[day]);
      expect(mapped.from).toBe(day);
      expect(mapped.to).toBe(day);
      expect(mapped.t).toBe(0);
    }
  });

  // 2026-04-20 noon declination 11.507230 deg.
  // March reference -0.175069, June reference 23.438019.
  // t = (11.507230 - (-0.175069)) / (23.438019 - (-0.175069)) = 11.682299 / 23.613088 = 0.494737.
  it("blends April between the March and June references", () => {
    const day = shadeModel.sunDay("2026-04-20");
    expect(day.declinationDeg).toBeCloseTo(11.50723, 4);
    expect(day.from).toBe("march-equinox");
    expect(day.to).toBe("june-solstice");
    expect(day.t).toBeCloseTo(0.494737, 4);
    const blended = shadeModel.interpolateSunFraction(
      { "march-equinox": 0.2, "june-solstice": 0.8, "december-solstice": 0 },
      day,
    );
    expect(blended).toBeCloseTo((1 - 0.494737) * 0.2 + 0.494737 * 0.8, 4);
  });

  // 2026-01-15 noon declination -21.129365 deg.
  // December reference -23.437486, March reference -0.175069.
  // t = (-21.129365 - (-23.437486)) / (-0.175069 - (-23.437486)) = 2.308121 / 23.262417 = 0.099221.
  it("blends January between the December and March references", () => {
    const day = shadeModel.sunDay("2026-01-15");
    expect(day.declinationDeg).toBeCloseTo(-21.129365, 4);
    expect(day.from).toBe("december-solstice");
    expect(day.to).toBe("march-equinox");
    expect(day.t).toBeCloseTo(0.099221, 4);
  });

  // 2026-09-23 noon declination -0.062243, just above the March reference -0.175069.
  // The September equinox has no reference day of its own, so almost all the weight stays on March.
  // t = (-0.062243 - (-0.175069)) / (23.438019 - (-0.175069)) = 0.112826 / 23.613088 = 0.004779.
  it("weights the September equinox on the March reference", () => {
    const day = shadeModel.sunDay("2026-09-23");
    expect(day.declinationDeg).toBeCloseTo(-0.062243, 4);
    expect(day.from).toBe("march-equinox");
    expect(day.to).toBe("june-solstice");
    expect(day.t).toBeCloseTo(0.004779, 4);
  });

  it("returns null only for a reference value the blend uses", () => {
    const april = shadeModel.sunDay("2026-04-20");
    expect(
      shadeModel.interpolateSunFraction(
        { "march-equinox": 0.25, "june-solstice": null, "december-solstice": 1 },
        april,
      ),
    ).toBeNull();
    const june = shadeModel.sunDay("2026-06-21");
    expect(
      shadeModel.interpolateSunFraction(
        { "march-equinox": null, "june-solstice": 0.4, "december-solstice": null },
        june,
      ),
    ).toBe(0.4);
  });
});

describe("height", () => {
  // Decision 004 order: OSM height, then levels times 3.74 m, then raster, then default.
  // HeightInput has no building type, so the default is one level, 3.74 m.
  it("follows the height chain and tags the source", () => {
    expect(shadeModel.estimateHeight({ heightTagM: 30, levels: 10, rasterHeightM: 5 })).toEqual({
      heightM: 30,
      heightSource: "osm",
    });
    expect(shadeModel.estimateHeight({ levels: 2, rasterHeightM: 50 })).toEqual({
      heightM: 7.48,
      heightSource: "levels",
    });
    expect(shadeModel.estimateHeight({ rasterHeightM: 40 })).toEqual({ heightM: 40, heightSource: "raster" });
    expect(shadeModel.estimateHeight({})).toEqual({ heightM: 3.74, heightSource: "default" });
    expect(shadeModel.estimateHeight({ heightTagM: 0, levels: -1, rasterHeightM: Number.NaN })).toEqual({
      heightM: 3.74,
      heightSource: "default",
    });
  });
});

describe("shadow tips", () => {
  // Decision 001: length = height / tan(elevation), swept opposite the sun azimuth.
  // Elevation 45 deg, tan(45 deg) = 1, height 10 m, so every tip below is 10 m from its vertex.
  // Azimuth 0 is north, clockwise. Shadow east = length * sin(azimuth + 180 deg),
  // shadow north = length * cos(azimuth + 180 deg).

  it("casts the morning square, triangle, and L due west", () => {
    // Azimuth 90 deg, sun due east. Shadow azimuth 270 deg.
    // east = 10 * sin(270 deg) = -10, north = 10 * cos(270 deg) = 0.
    const light = sun(90, 45);
    const square = shadeModel.shadowPolygons([building("square", SQUARE)], light)[0];
    const triangle = shadeModel.shadowPolygons([building("triangle", TRIANGLE)], light)[0];
    const ell = shadeModel.shadowPolygons([building("l", L_SHAPE)], light)[0];
    expect(square).toBeDefined();
    expect(triangle).toBeDefined();
    expect(ell).toBeDefined();
    if (square === undefined || triangle === undefined || ell === undefined) return;
    expect(signedArea(square.ring)).toBeGreaterThan(0);
    expect(signedArea(triangle.ring)).toBeGreaterThan(0);
    expect(signedArea(ell.ring)).toBeGreaterThan(0);
    expectVertex(square.ring, -10, 0);
    expectVertex(square.ring, -10, 10);
    expectVertex(triangle.ring, -10, 0);
    expectVertex(triangle.ring, -10, 40);
    expectVertex(ell.ring, -10, 0);
    expectVertex(ell.ring, -10, 20);
    // (-5, 5) is 5 m west of the square. (15, 5) is east of it, on the sun side.
    expect(shadeModel.isInShadow(lngLat(-5, 5), [square])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(15, 5), [square])).toBe(false);
    // (-5, 1) is west of the triangle base. (35, 1) is east of the 30 m base.
    expect(shadeModel.isInShadow(lngLat(-5, 1), [triangle])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(35, 1), [triangle])).toBe(false);
    // (-5, 5) is west of the L. (15, 15) is the missing notch: a convex hull would shade it.
    expect(shadeModel.isInShadow(lngLat(-5, 5), [ell])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(15, 15), [ell])).toBe(false);
    expect(square.estimated).toBe(false);
  });

  it("casts the noon square, triangle, and L due north", () => {
    // Azimuth 180 deg, sun due south. Shadow azimuth 0 deg.
    // east = 10 * sin(0 deg) = 0, north = 10 * cos(0 deg) = 10.
    const light = sun(180, 45);
    const square = shadeModel.shadowPolygons([building("square", SQUARE)], light)[0];
    const triangle = shadeModel.shadowPolygons([building("triangle", TRIANGLE)], light)[0];
    const ell = shadeModel.shadowPolygons([building("l", L_SHAPE, "levels")], light)[0];
    expect(square).toBeDefined();
    expect(triangle).toBeDefined();
    expect(ell).toBeDefined();
    if (square === undefined || triangle === undefined || ell === undefined) return;
    expectVertex(square.ring, 0, 20);
    expectVertex(square.ring, 10, 20);
    // Apex (0, 40) plus 10 m north.
    expectVertex(triangle.ring, 0, 50);
    expectVertex(ell.ring, 0, 30);
    expectVertex(ell.ring, 10, 30);
    // (5, 15) is 5 m north of the square. (5, -2) is south, on the sun side.
    expect(shadeModel.isInShadow(lngLat(5, 15), [square])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(5, -2), [square])).toBe(false);
    // At y = 45 the shifted hypotenuse from (30, 10) to (0, 50) has x = 3.75,
    // so (1, 45) is inside the cast and (10, 45) is outside it.
    expect(shadeModel.isInShadow(lngLat(1, 45), [triangle])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(10, 45), [triangle])).toBe(false);
    // (15, 15) is in the northward cast of the east wing. (15, 25) is past that wing.
    expect(shadeModel.isInShadow(lngLat(15, 15), [ell])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(15, 25), [ell])).toBe(false);
    expect(ell.estimated).toBe(true);
  });

  it("casts the late-afternoon square, triangle, and L toward the east-northeast", () => {
    // Azimuth 240 deg. Shadow azimuth 60 deg.
    // east = 10 * sin(60 deg) = 5 * sqrt(3), north = 10 * cos(60 deg) = 5.
    const east = 5 * Math.sqrt(3);
    const light = sun(240, 45);
    const square = shadeModel.shadowPolygons([building("square", SQUARE)], light)[0];
    const triangle = shadeModel.shadowPolygons([building("triangle", TRIANGLE)], light)[0];
    const ell = shadeModel.shadowPolygons([building("l", L_SHAPE, "raster")], light)[0];
    expect(square).toBeDefined();
    expect(triangle).toBeDefined();
    expect(ell).toBeDefined();
    if (square === undefined || triangle === undefined || ell === undefined) return;
    // Far vertices: square (10, 10), triangle (30, 0), L (20, 10).
    expectVertex(square.ring, 10 + east, 15);
    expectVertex(triangle.ring, 30 + east, 5);
    expectVertex(ell.ring, 20 + east, 15);
    expect(shadeModel.isInShadow(lngLat(5, 5), [square])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(-2, -2), [square])).toBe(false);
    expect(shadeModel.isInShadow(lngLat(1, 1), [triangle])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(-5, -5), [triangle])).toBe(false);
    expect(shadeModel.isInShadow(lngLat(5, 5), [ell])).toBe(true);
    expect(shadeModel.isInShadow(lngLat(-10, -10), [ell])).toBe(false);
    expect(ell.estimated).toBe(true);
    const first = square.ring[0];
    const last = square.ring[square.ring.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first === undefined || last === undefined) return;
    const [firstEast, firstNorth] = toMeters(first);
    const [lastEast, lastNorth] = toMeters(last);
    expect(Math.hypot(firstEast - lastEast, firstNorth - lastNorth)).toBeGreaterThan(1e-3);
  });

  it("returns no polygon when the sun is on the horizon", () => {
    expect(shadeModel.shadowPolygons([building("square", SQUARE)], sun(90, 0))).toEqual([]);
    expect(shadeModel.isInShadow(lngLat(5, 5), [])).toBe(false);
  });
});

describe("edge sun fraction", () => {
  // Morning square, azimuth 90, elevation 45, height 10: shadow is x = -10..10, y = 0..10.
  // Edge y = 5 from x = -20 to x = 20 is 40 m, shaded for 20 m, sun fraction 20/40 = 0.5.
  it("measures the share of an edge in the morning square shadow", () => {
    const shadows = shadeModel.shadowPolygons([building("square", SQUARE)], sun(90, 45));
    expect(shadeModel.edgeSunFraction(edge([[-20, 5], [20, 5]]), shadows, sun(90, 45))).toBeCloseTo(0.5, 6);
    expect(shadeModel.edgeSunFraction(edge([[20, 5], [30, 5]]), shadows, sun(90, 45))).toBeCloseTo(1, 6);
    expect(shadeModel.edgeSunFraction(edge([[2, 5], [8, 5]]), shadows, sun(90, 45))).toBeCloseTo(0, 6);
  });

  // Morning triangle at y = 20: footprint x = 0..15 (hypotenuse from (30, 0) to (0, 40)).
  // Shadow reaches 10 m further west, so shaded x = -10..15. Edge x = -20..40 is 60 m.
  // Sun length 35 m, fraction 35/60 = 7/12.
  it("measures a diagonal footprint's shadow across a straight edge", () => {
    const shadows = shadeModel.shadowPolygons([building("triangle", TRIANGLE)], sun(90, 45));
    expect(shadeModel.edgeSunFraction(edge([[-20, 20], [40, 20]]), shadows, sun(90, 45))).toBeCloseTo(7 / 12, 6);
  });

  // Second square x = 12..22 casts west to x = 2. Union with the first shadow is x = -10..22.
  // Edge x = -20..30 is 50 m, shaded 32 m, sun fraction 18/50 = 0.36.
  it("counts overlapping shadows once", () => {
    const shadows = shadeModel.shadowPolygons(
      [building("a", SQUARE), building("b", [[12, 0], [22, 0], [22, 10], [12, 10]])],
      sun(90, 45),
    );
    expect(shadeModel.edgeSunFraction(edge([[-20, 5], [30, 5]]), shadows, sun(90, 45))).toBeCloseTo(0.36, 6);
  });

  it("keeps building-only sun when trees are present but do not reach the edge", () => {
    const shadows = shadeModel.shadowPolygons([building("square", SQUARE)], sun(90, 45));
    const buildingOnly = shadeModel.edgeSunFraction(edge([[-20, 5], [20, 5]]), shadows, sun(90, 45));
    const treeFar = shadeModel.treeShadowPolygons(
      [
        {
          id: "far",
          footprint: SQUARE.map(([e, n]) => lngLat(e + 80, n + 80)),
          crownHeightM: HEIGHT_M,
          transmittance: 0.35,
        },
      ],
      sun(90, 45),
    );
    const combined = shadeModel.edgeSunFraction(edge([[-20, 5], [20, 5]]), [...shadows, ...treeFar], sun(90, 45));
    expect(buildingOnly).toBeCloseTo(0.5, 6);
    expect(combined).toBeCloseTo(buildingOnly!, 6);
  });

  it("never raises sun when a tree shadow is added on an open edge", () => {
    const open = edge([[30, 5], [60, 5]]);
    const clear = shadeModel.edgeSunFraction(open, [], sun(90, 45));
    const tree = shadeModel.treeShadowPolygons(
      [
        {
          id: "mid",
          footprint: [
            lngLat(40, 0),
            lngLat(50, 0),
            lngLat(50, 10),
            lngLat(40, 10),
          ],
          crownHeightM: HEIGHT_M,
          transmittance: 0.35,
        },
      ],
      sun(90, 45),
    );
    const shaded = shadeModel.edgeSunFraction(open, tree, sun(90, 45));
    expect(clear).toBeCloseTo(1, 6);
    expect(shaded).not.toBeNull();
    if (shaded === null || clear === null) return;
    expect(shaded).toBeLessThanOrEqual(clear);
    expect(shaded).toBeGreaterThan(0.3);
  });

  it("takes the union of overlapping building and tree shade", () => {
    const sunNoon = sun(90, 45);
    const buildingShadows = shadeModel.shadowPolygons([building("b1", SQUARE)], sunNoon);
    const tree = shadeModel.treeShadowPolygons(
      [
        {
          id: "t1",
          footprint: SQUARE.map(([e, n]) => lngLat(e, n)),
          crownHeightM: HEIGHT_M,
          transmittance: 0.35,
        },
      ],
      sunNoon,
    );
    const combined = [...buildingShadows, ...tree];
    const walk = edge([[2, 5], [8, 5]]);
    const buildingOnly = shadeModel.edgeSunFraction(walk, buildingShadows, sunNoon);
    const both = shadeModel.edgeSunFraction(walk, combined, sunNoon);
    expect(buildingOnly).toBeCloseTo(0, 6);
    expect(both).toBeCloseTo(0, 6);
    expect(both).not.toBeGreaterThan(buildingOnly!);
  });

  it("lowers sun along an edge crossed by a partial tree shadow", () => {
    const walk = edge([[5, 0], [15, 0]]);
    const tree = shadeModel.treeShadowPolygons(
      [
        {
          id: "crown",
          footprint: SQUARE.map(([e, n]) => lngLat(e, n)),
          crownHeightM: HEIGHT_M,
          transmittance: 0.35,
        },
      ],
      sun(90, 45),
    );
    const open = shadeModel.edgeSunFraction(walk, [], sun(90, 45));
    const under = shadeModel.edgeSunFraction(walk, tree, sun(90, 45));
    expect(open).toBeCloseTo(1, 6);
    expect(under).not.toBeNull();
    if (under === null) return;
    expect(under).toBeLessThan(0.85);
  });

  // Decision 002 puts covered and bridge shading in the pipeline, not in this fraction.
  it("leaves a covered edge at its geometric fraction", () => {
    const shadows = shadeModel.shadowPolygons([building("square", SQUARE)], sun(90, 45));
    expect(shadeModel.edgeSunFraction(edge([[-20, 5], [20, 5]], true), shadows, sun(90, 45))).toBeCloseTo(0.5, 6);
    expect(shadeModel.edgeSunFraction(edge([[-20, 5], [20, 5]]), shadows, sun(90, 0))).toBeNull();
    expect(shadeModel.edgeSunFraction(edge([[0, 0]]), shadows, sun(90, 45))).toBeNull();
  });
});

describe("tree shadows", () => {
  it("casts a partial shadow with the configured transmittance", () => {
    const tree = {
      id: "tree-1",
      footprint: SQUARE.map(([east, north]) => lngLat(east, north)),
      crownHeightM: HEIGHT_M,
      transmittance: 0.35,
    };
    const sunNoon = sun(180, 60);
    const treeShadow = shadeModel.treeShadowPolygons([tree], sunNoon);
    expect(treeShadow).toHaveLength(1);
    expect(treeShadow[0]?.kind).toBe("tree");
    const ring = treeShadow[0]?.ring ?? [];
    const shadowPoint = ring[Math.floor(ring.length / 2)] ?? lngLat(5, -8);
    const buildings = shadeModel.shadowPolygons([building("b1", [[30, 0], [40, 0], [40, 10], [30, 10]])], sunNoon);
    const onlyTree = shadeModel.pointSunFraction(shadowPoint, treeShadow);
    expect(onlyTree).toBeCloseTo(0.35, 5);
    const buildingShadow = buildings[0]?.ring[0];
    if (buildingShadow === undefined) throw new Error("missing building shadow");
    const combined = [...buildings, ...treeShadow];
    expect(shadeModel.pointSunFraction(buildingShadow, combined)).toBe(0);
    const clear = lngLat(-10, 5);
    expect(shadeModel.pointSunFraction(clear, combined)).toBe(1);
  });
});

describe("transmittance", () => {
  it("passes all light until canopy exists", () => {
    expect(shadeModel.transmittance(ORIGIN)).toBe(1);
    expect(shadeModel.transmittance(lngLat(4, -3))).toBe(1);
  });
});
