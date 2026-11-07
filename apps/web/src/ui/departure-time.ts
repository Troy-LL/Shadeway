import { SLOT_GRID, isSlotIndex, nearestSlot, slotStartMinutes as contractSlotStartMinutes, type SlotIndex } from "@shadeway/contract";

export const slotStartMinutes = contractSlotStartMinutes;
import { COPY } from "./copy";

const SHADE_START = 6 * 60;
const SHADE_END = 18 * 60;

export function manilaNowMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function snapToNowSlot(nowMinutes: number): SlotIndex {
  const slot = nearestSlot(nowMinutes);
  if (slot !== null) return slot;
  if (nowMinutes < SLOT_GRID.startMinutes) return 0;
  return SLOT_GRID.count - 1;
}

export function formatSlotLabel(slot: SlotIndex): string {
  const total = slotStartMinutes(slot);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function formatDepartureChip(departureIsNow: boolean, slot: SlotIndex): string {
  if (departureIsNow) return COPY.leaveNow;
  return `Leave ${formatSlotLabel(slot)}`;
}

export function shadeDepartureAvailable(nowMinutes: number): boolean {
  return nowMinutes >= SHADE_START && nowMinutes <= SHADE_END;
}

export function listedDepartureSlots(): readonly SlotIndex[] {
  const slots: SlotIndex[] = [];
  for (let index = 0; index < SLOT_GRID.count; index += 1) {
    if (!isSlotIndex(index)) continue;
    const minutes = slotStartMinutes(index);
    if (minutes < SHADE_START || minutes > SHADE_END) continue;
    slots.push(index);
  }
  return slots;
}

export interface DeparturePickerOptions {
  readonly slot: SlotIndex;
  readonly departureIsNow: boolean;
  readonly shadeAvailable: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onPickNow: () => void;
  readonly onPickSlot: (slot: SlotIndex) => void;
}

export function renderDepartureChip(options: DeparturePickerOptions): HTMLElement {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "departure-chip";
  chip.textContent = formatDepartureChip(options.departureIsNow, options.slot);
  chip.setAttribute("aria-expanded", options.open ? "true" : "false");
  chip.addEventListener("click", options.onToggle);
  return chip;
}

export function renderDeparturePicker(options: DeparturePickerOptions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "departure-picker";
  panel.hidden = !options.open;

  if (!options.shadeAvailable) {
    const notice = document.createElement("p");
    notice.className = "departure-picker__notice";
    notice.textContent = COPY.shadeHours;
    panel.append(notice);
  }

  const list = document.createElement("div");
  list.className = "departure-picker__list";
  list.setAttribute("role", "listbox");

  const nowRow = document.createElement("button");
  nowRow.type = "button";
  nowRow.className = "departure-picker__option";
  nowRow.textContent = COPY.now;
  nowRow.setAttribute("role", "option");
  nowRow.setAttribute("aria-selected", options.departureIsNow ? "true" : "false");
  nowRow.addEventListener("click", () => options.onPickNow());
  list.append(nowRow);

  for (const slot of listedDepartureSlots()) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "departure-picker__option";
    row.textContent = formatSlotLabel(slot);
    row.setAttribute("role", "option");
    const selected = !options.departureIsNow && slot === options.slot;
    row.setAttribute("aria-selected", selected ? "true" : "false");
    row.addEventListener("click", () => options.onPickSlot(slot));
    list.append(row);
  }

  panel.append(list);
  return panel;
}
