import { COPY } from "../copy";
import type { FieldFocus, PlacePick, UiState } from "../types";
import { renderStatusBlock } from "./status";

export interface SearchHandlers {
  readonly onFocusField: (field: FieldFocus) => void;
  readonly onFromQuery: (query: string) => void;
  readonly onToQuery: (query: string) => void;
  readonly onPick: (place: PlacePick) => void;
  readonly onSwap: () => void;
}

const PILOT_RANK = new Map<string, number>([
  ["bonifacio high street", 0],
  ["market! market!", 1],
]);

export function matchPlaces(places: readonly PlacePick[], query: string): readonly PlacePick[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return places
    .filter((place) => place.name.toLowerCase().includes(needle))
    .sort((a, b) => rankPlace(a.name) - rankPlace(b.name) || a.name.localeCompare(b.name))
    .slice(0, 3);
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

  const row = document.createElement("div");
  row.className = "search-fields";

  const from = document.createElement("input");
  from.className = "search-field";
  from.type = "search";
  from.placeholder = state.locationDenied ? COPY.locationOff : COPY.from;
  from.setAttribute("aria-label", COPY.from);
  from.value = state.start?.name ?? state.fromQuery;
  from.disabled = state.locationDenied;
  if (state.focusedField === "from") from.classList.add("search-field--active");
  from.addEventListener("focus", () => handlers.onFocusField("from"));
  from.addEventListener("input", () => handlers.onFromQuery(from.value));

  const swap = document.createElement("button");
  swap.type = "button";
  swap.className = "search-swap";
  swap.setAttribute("aria-label", COPY.swap);
  swap.textContent = "⇅";
  swap.addEventListener("click", handlers.onSwap);

  const to = document.createElement("input");
  to.className = "search-field";
  to.type = "search";
  to.placeholder = COPY.whereTo;
  to.setAttribute("aria-label", COPY.to);
  to.value = state.end?.name ?? state.toQuery;
  if (state.focusedField === "to") to.classList.add("search-field--active");
  to.addEventListener("focus", () => handlers.onFocusField("to"));
  to.addEventListener("input", () => handlers.onToQuery(to.value));
  to.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = matchPlaces(state.places, to.value)[0];
    if (!first) return;
    event.preventDefault();
    handlers.onPick(first);
  });

  row.append(from, swap, to);
  container.append(row);

  const query = state.focusedField === "from" ? state.fromQuery : state.toQuery;
  const matches = state.editingField ? matchPlaces(state.places, query) : [];
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
  } else if (state.editingField && query.trim()) {
    const empty = document.createElement("p");
    empty.className = "status-message status-message--secondary";
    empty.textContent = COPY.noMatchingPlace;
    container.append(empty);
  }

  if (state.status === "loading-tiles") {
    const shimmer = document.createElement("div");
    shimmer.className = "shimmer-row";
    container.append(shimmer);
  }

  return container;
}
