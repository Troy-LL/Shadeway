import { describe, expect, it } from "vitest";
import { SLOT_GRID, encodeSunFraction, type Edge, type ReferenceDay, type SunTile } from "@shadeway/contract";
import { route } from "./index";

const COLS = 71;
const ROWS = 71;
const STEP_M = 20;

function gridEdges(): { edges: Edge[]; count: number } {
  const edges: Edge[] = [];
  let id = 0;
  const node = (col: number, row: number) => row * COLS + col;
  const add = (fromCol: number, fromRow: number, toCol: number, toRow: number) => {
    const from = node(fromCol, fromRow);
    const to = node(toCol, toRow);
    edges.push({
      id,
      from,
      to,
      lengthM: STEP_M,
      geometry: [
        [fromCol / 10_000, fromRow / 10_000],
        [toCol / 10_000, toRow / 10_000],
      ],
      covered: false,
      bridge: false,
    });
    id += 1;
  };
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (col + 1 < COLS) {
        add(col, row, col + 1, row);
        add(col + 1, row, col, row);
      }
      if (row + 1 < ROWS) {
        add(col, row, col, row + 1);
        add(col, row + 1, col, row);
      }
    }
  }
  const gridCount = edges.length;
  while (edges.length < 20_000) {
    edges.push({
      id,
      from: 0,
      to: 1,
      lengthM: 1_000_000,
      geometry: [
        [0, 0],
        [1 / 10_000, 0],
      ],
      covered: false,
      bridge: false,
    });
    id += 1;
  }
  return { edges, count: gridCount };
}

function tilesFor(edges: readonly Edge[]): SunTile[] {
  const days: ReferenceDay[] = ["march-equinox", "june-solstice", "december-solstice"];
  return days.map((referenceDay, dayIndex) => {
    const sun = new Uint8Array(edges.length * SLOT_GRID.count);
    for (let index = 0; index < edges.length; index++) {
      const fraction = ((index + dayIndex) % 5) / 4;
      const byte = encodeSunFraction(fraction);
      for (let slot = 0; slot < SLOT_GRID.count; slot++) sun[index * SLOT_GRID.count + slot] = byte;
    }
    return { referenceDay, edgeIds: Uint32Array.from(edges.map((item) => item.id)), sun };
  });
}

describe("timing", () => {
  it("routes a graph of 20000 edges", () => {
    const { edges, count } = gridEdges();
    expect(edges).toHaveLength(20_000);
    expect(count).toBe(19_880);
    const started = performance.now();
    const routes = route({
      graph: { version: 1, area: "timing", edges },
      tiles: tilesFor(edges),
      day: {
        date: "2026-04-15",
        declinationDeg: 9.5,
        from: "march-equinox",
        to: "june-solstice",
        t: 0.4,
      },
      departure: { date: "2026-04-15", minutes: 12 * 60 },
      start: 0,
      end: ROWS * COLS - 1,
    });
    const elapsedMs = performance.now() - started;
    console.log(`router 20000 edges ${elapsedMs.toFixed(1)} ms`);
    const hops = COLS - 1 + (ROWS - 1);
    expect(routes.fastest?.distanceM).toBe(hops * STEP_M);
    expect(routes.balanced).not.toBeNull();
    expect(routes.shadiest).not.toBeNull();
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
