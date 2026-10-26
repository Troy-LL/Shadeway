import { COPY, PILOT_DESTINATIONS } from "../copy";
import { renderTimeScrubber } from "../time-scrubber";
import type { PlacePick, UiState } from "../types";
import { renderStatusBlock } from "./status";

export interface SearchHandlers {
  readonly onQuery: (query: string) => void;
  readonly onPick: (place: PlacePick) => void;
  readonly onDestination: (label: string) => void;
  readonly onLeaveNow: () => void;
  readonly onSlotChange: (slot: number) => void;
  readonly onSnapNow: () => void;
}

const PILOT_RANK = new Map<string, number>([
  [PILOT_DESTINATIONS.bonifacioHighStreet.toLowerCase(), 0],
  [PILOT_DESTINATIONS.marketMarket.toLowerCase(), 1],
]);

export function matchPlaces(places: readonly PlacePick[], query: string): readonly PlacePick[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return places
    .filter((place) => place.name.toLowerCase().includes(needle))
    .sort((a, b) => rankPlace(a.name) - rankPlace(b.name) || a.name.localeCompare(b.name))
    .slice(0, 6);
}

function rankPlace(name: string): number {
  return PILOT_RANK.get(name.toLowerCase()) ?? 2;
}

export function renderSearchContent(state: UiState, handlers: SearchHandlers): HTMLElement {
  const container = document.createElement("div");
  container.className = "search-screen";

  const status = renderStatusBlock(state);
  if (status && state.status !== "no-route" && state.status !== "outside-pilot") {
    container.append(status);
    return container;
  }
  if (status) container.append(status);

  if (state.start) {
    const from = document.createElement("p");
    from.className = "search-picked";
    from.textContent = state.start.name;
    container.append(from);
  }

  const field = document.createElement("input");
  field.className = "search-field";
  field.type = "search";
  field.placeholder = COPY.whereTo;
  field.setAttribute("aria-label", COPY.whereTo);
  field.value = state.query;
  field.addEventListener("input", () => handlers.onQuery(field.value));
  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = matchPlaces(state.places, field.value)[0];
    if (!first) return;
    event.preventDefault();
    handlers.onPick(first);
  });
  container.append(field);

  const matches = matchPlaces(state.places, state.query);
  if (matches.length > 0) {
    const list = document.createElement("div");
    list.className = "suggest";
    list.setAttribute("role", "listbox");
    for (const place of matches) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "suggest__option";
      option.textContent = place.name;
      option.addEventListener("click", () => handlers.onPick(place));
      list.append(option);
    }
    container.append(list);
  }

  const chips = document.createElement("div");
  chips.className = "chip-row";
  for (const label of [PILOT_DESTINATIONS.bonifacioHighStreet, PILOT_DESTINATIONS.marketMarket]) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = label;
    chip.addEventListener("click", () => handlers.onDestination(label));
    chips.append(chip);
  }
  container.append(chips);

  if (state.detent === "full") {
    const extra = document.createElement("div");
    extra.className = "chip-row";
    const leaveNow = document.createElement("button");
    leaveNow.type = "button";
    leaveNow.className = "chip";
    leaveNow.textContent = COPY.leaveNow;
    leaveNow.setAttribute("data-action", "leave-now");
    leaveNow.addEventListener("click", handlers.onLeaveNow);
    extra.append(leaveNow);
    container.append(extra);

    if (state.timePickerOpen) {
      container.append(
        renderTimeScrubber({
          slot: state.slot,
          departureIsNow: state.departureIsNow,
          onSlotChange: handlers.onSlotChange,
          onSnapNow: handlers.onSnapNow,
        }),
      );
    }

    if (state.recents.length > 0) {
      const recents = document.createElement("div");
      recents.className = "recents";
      const title = document.createElement("p");
      title.className = "recents__title sr-only";
      title.textContent = "Recents";
      const list = document.createElement("div");
      list.className = "chip-row";
      for (const recent of state.recents) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = recent;
        chip.addEventListener("click", () => handlers.onDestination(recent));
        list.append(chip);
      }
      recents.append(title, list);
      container.append(recents);
    }
  }

  return container;
}
