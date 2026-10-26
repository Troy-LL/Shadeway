import { SLOT_GRID, isSlotIndex, nearestSlot, slotStartMinutes, type SlotIndex } from "@shadeway/contract";
import { COPY } from "./copy";

export interface TimeScrubberOptions {
  readonly slot: SlotIndex;
  readonly departureIsNow: boolean;
  readonly onSlotChange: (slot: SlotIndex) => void;
  readonly onSnapNow: () => void;
}

function formatSlotLabel(slot: SlotIndex): string {
  const total = slotStartMinutes(slot);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function renderTimeScrubber(options: TimeScrubberOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = "time-scrubber";

  const nowButton = document.createElement("button");
  nowButton.type = "button";
  nowButton.className = "time-scrubber__now chip";
  nowButton.textContent = COPY.leaveNow;
  nowButton.addEventListener("click", () => options.onSnapNow());

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "time-scrubber__slider";
  slider.min = "0";
  slider.max = String(SLOT_GRID.count - 1);
  slider.step = "1";
  slider.value = String(options.slot);
  slider.setAttribute("aria-valuetext", formatSlotLabel(options.slot));

  slider.addEventListener("input", () => {
    const raw = Number(slider.value);
    if (!isSlotIndex(raw)) return;
    slider.setAttribute("aria-valuetext", formatSlotLabel(raw));
    options.onSlotChange(raw);
  });

  const label = document.createElement("span");
  label.className = "time-scrubber__label";
  label.textContent = options.departureIsNow ? COPY.leaveNow : formatSlotLabel(options.slot);

  root.append(nowButton, slider, label);
  return root;
}

export function snapToNowSlot(nowMinutes: number): SlotIndex {
  const slot = nearestSlot(nowMinutes);
  if (slot !== null) return slot;
  if (nowMinutes < SLOT_GRID.startMinutes) return 0;
  return SLOT_GRID.count - 1;
}
