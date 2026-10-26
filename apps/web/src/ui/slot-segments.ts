import type { SlotIndex } from "@shadeway/contract";
import type { ShadeSegment } from "./types";

const BASE: readonly ShadeSegment[] = [
  { from: 0, to: 0.25, sunny: true },
  { from: 0.25, to: 0.6, sunny: false },
  { from: 0.6, to: 1, sunny: true },
];

/** Demo precomputed shade strips per slot (no fetch). */
export function segmentsForSlot(slot: SlotIndex): readonly ShadeSegment[] {
  const flip = slot % 2 === 0;
  if (!flip) return BASE;
  return [
    { from: 0, to: 0.35, sunny: false },
    { from: 0.35, to: 0.5, sunny: true },
    { from: 0.5, to: 1, sunny: false },
  ];
}
