import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION,
  HEIGHT_SOURCES,
  NO_DATA_BYTE,
  REFERENCE_DAYS,
  SLOT_GRID,
  decodeSunFraction,
  decodeSunTile,
  encodeSunFraction,
  encodeSunTile,
  isEstimatedHeight,
  nearestSlot,
  slotStartMinutes,
  sunByte,
  type SunTile,
} from "./index";

function sampleTile(edgeCount: number): SunTile {
  const sun = new Uint8Array(edgeCount * SLOT_GRID.count);
  sun.forEach((_, i) => (sun[i] = i % 256));
  return {
    referenceDay: "june-solstice",
    edgeIds: Uint32Array.from({ length: edgeCount }, (_, i) => (i % 2 ? 0xffffffff - i : i * 7)),
    sun,
  };
}

describe("attribution", () => {
  it("names ODbL and CC BY in one constant", () => {
    expect(HEIGHT_SOURCES).toContain("override");
    expect(isEstimatedHeight("override")).toBe(true);
    expect(isEstimatedHeight("osm")).toBe(false);
    const text = ATTRIBUTION.join("\n");
    expect(text).toContain("ODbL");
    expect(text).toContain("CC BY 4.0");
    expect(text).toContain("Meta and WRI");
  });
});

describe("slot grid", () => {
  it("has 25 slots from 06:00 to 18:00", () => {
    expect(SLOT_GRID.count).toBe(25);
    expect(slotStartMinutes(0)).toBe(360);
    expect(slotStartMinutes(24)).toBe(1080);
    expect(() => slotStartMinutes(25)).toThrow(RangeError);
    expect(() => slotStartMinutes(1.5)).toThrow(RangeError);
  });

  it("maps local times to the nearest slot", () => {
    expect(nearestSlot(360)).toBe(0);
    expect(nearestSlot(374)).toBe(0);
    expect(nearestSlot(375)).toBe(1);
    expect(nearestSlot(1080)).toBe(24);
    expect(nearestSlot(359)).toBeNull();
    expect(nearestSlot(1081)).toBeNull();
    expect(nearestSlot(Number.NaN)).toBeNull();
  });
});

describe("sun fraction byte", () => {
  it("scales 0 to 1 onto 0 to 254 and null onto 255", () => {
    expect(encodeSunFraction(0)).toBe(0);
    expect(encodeSunFraction(1)).toBe(254);
    expect(encodeSunFraction(null)).toBe(NO_DATA_BYTE);
    expect(decodeSunFraction(NO_DATA_BYTE)).toBeNull();
    expect(decodeSunFraction(254)).toBe(1);
  });

  it("round-trips within half a step", () => {
    for (let i = 0; i <= 1000; i++) {
      const f = i / 1000;
      expect(Math.abs(decodeSunFraction(encodeSunFraction(f))! - f)).toBeLessThanOrEqual(0.5 / 254);
    }
  });

  it("rejects values out of range", () => {
    expect(() => encodeSunFraction(-0.01)).toThrow(RangeError);
    expect(() => encodeSunFraction(1.01)).toThrow(RangeError);
    expect(() => encodeSunFraction(Number.NaN)).toThrow(RangeError);
    expect(() => decodeSunFraction(256)).toThrow(RangeError);
  });
});

describe("sun tile codec", () => {
  it("round-trips every reference day", () => {
    for (const referenceDay of REFERENCE_DAYS) {
      const tile = { ...sampleTile(40), referenceDay };
      const decoded = decodeSunTile(encodeSunTile(tile));
      expect(decoded.referenceDay).toBe(referenceDay);
      expect(Array.from(decoded.edgeIds)).toEqual(Array.from(tile.edgeIds));
      expect(Array.from(decoded.sun)).toEqual(Array.from(tile.sun));
    }
  });

  it("round-trips an empty tile", () => {
    const decoded = decodeSunTile(encodeSunTile(sampleTile(0)));
    expect(decoded.edgeIds.length).toBe(0);
    expect(decoded.sun.length).toBe(0);
  });

  it("decodes from an unaligned view", () => {
    const encoded = encodeSunTile(sampleTile(3));
    const padded = new Uint8Array(encoded.length + 1);
    padded.set(encoded, 1);
    const decoded = decodeSunTile(padded.subarray(1));
    expect(Array.from(decoded.edgeIds)).toEqual(Array.from(sampleTile(3).edgeIds));
  });

  it("reads one edge and slot", () => {
    const tile = decodeSunTile(encodeSunTile(sampleTile(3)));
    expect(sunByte(tile, 2, 4)).toBe((2 * 25 + 4) % 256);
    expect(() => sunByte(tile, 3, 0)).toThrow(RangeError);
    expect(() => sunByte(tile, 0, 25)).toThrow(RangeError);
  });

  it("rejects malformed input", () => {
    const tile = sampleTile(2);
    expect(() => encodeSunTile({ ...tile, sun: tile.sun.subarray(1) })).toThrow(RangeError);
    const encoded = encodeSunTile(tile);
    expect(() => decodeSunTile(encoded.subarray(0, 11))).toThrow(RangeError);
    expect(() => decodeSunTile(encoded.subarray(0, encoded.length - 1))).toThrow(RangeError);
    const badMagic = encoded.slice();
    badMagic[0] = 0;
    expect(() => decodeSunTile(badMagic)).toThrow(RangeError);
    const badVersion = encoded.slice();
    badVersion[4] = 2;
    expect(() => decodeSunTile(badVersion)).toThrow(RangeError);
    const badDay = encoded.slice();
    badDay[6] = 3;
    expect(() => decodeSunTile(badDay)).toThrow(RangeError);
  });
});
