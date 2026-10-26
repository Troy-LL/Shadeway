import { SLOT_GRID, nearestSlot, slotStartMinutes, type SlotIndex } from "@shadeway/contract";

export function walkRemaining(
  elapsedS: number,
  durationS: number,
  distanceM: number,
  sunMinutes: number,
): { fraction: number; distanceM: number; minutes: number; sunMinutes: number } {
  const duration = durationS > 0 ? durationS : 1;
  const fraction = Math.min(1, Math.max(0, elapsedS / duration));
  const left = 1 - fraction;
  return {
    fraction,
    distanceM: Math.max(0, distanceM * left),
    minutes: Math.max(0, Math.round((durationS / 60) * left)),
    sunMinutes: Math.max(0, Math.round(sunMinutes * left)),
  };
}

export function slotAfterElapsed(slot: SlotIndex, elapsedS: number): SlotIndex {
  const minutes = slotStartMinutes(slot) + elapsedS / 60;
  const next = nearestSlot(minutes);
  if (next !== null) return next;
  if (minutes <= SLOT_GRID.startMinutes) return 0;
  return SLOT_GRID.count - 1;
}
