import { COPY, PILOT_DESTINATIONS } from "../copy";
import type { UiState } from "../types";
import { renderStatusBlock } from "./status";

export function renderSearchContent(state: UiState, onDestination: (label: string) => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "search-screen";

  const status = renderStatusBlock(state);
  if (status) {
    container.append(status);
    return container;
  }

  const field = document.createElement("input");
  field.className = "search-field";
  field.type = "search";
  field.placeholder = COPY.whereTo;
  field.setAttribute("aria-label", COPY.whereTo);

  container.append(field);

  if (state.detent !== "peek") {
    const chips = document.createElement("div");
    chips.className = "chip-row";

    for (const label of [PILOT_DESTINATIONS.bonifacioHighStreet, PILOT_DESTINATIONS.marketMarket]) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = label;
      chip.addEventListener("click", () => onDestination(label));
      chips.append(chip);
    }

    const leaveNow = document.createElement("button");
    leaveNow.type = "button";
    leaveNow.className = "chip";
    leaveNow.textContent = COPY.leaveNow;
    leaveNow.setAttribute("data-action", "leave-now");
    chips.append(leaveNow);

    container.append(chips);

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
        chip.addEventListener("click", () => onDestination(recent));
        list.append(chip);
      }
      recents.append(title, list);
      container.append(recents);
    }
  }

  return container;
}
