import { COPY } from "../copy";
import type { FieldFocus, PlacePick, UiState } from "../types";
import { renderStatusBlock } from "./status";

export interface SearchHandlers {
  readonly onFocusField: (field: FieldFocus) => void;
  readonly onFromQuery: (query: string) => void;
  readonly onToQuery: (query: string) => void;
  readonly onPick: (place: PlacePick) => void;
  readonly onSwap: () => void;
  readonly onTryAgain: () => void;
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

function restingPlaces(places: readonly PlacePick[]): readonly PlacePick[] {
  return [...places].sort((a, b) => rankPlace(a.name) - rankPlace(b.name) || a.name.localeCompare(b.name)).slice(0, 5);
}

export function suggestionPlaces(state: UiState, query: string): readonly PlacePick[] {
  if (!state.editingField) return restingPlaces(state.places);
  const trimmed = query.trim();
  if (!trimmed) return restingPlaces(state.places);
  return matchPlaces(state.places, trimmed);
}

function activePickName(state: UiState): string {
  if (state.focusedField === "from") return state.start?.name.trim() ?? "";
  return state.end?.name.trim() ?? "";
}

function showNoMatchingPlace(state: UiState, query: string, matches: readonly PlacePick[]): boolean {
  const trimmed = query.trim();
  if (!state.editingField || !trimmed || matches.length > 0) return false;
  return trimmed !== activePickName(state);
}

export interface SearchScreenMount {
  readonly root: HTMLElement;
  readonly fields: HTMLElement;
  readonly from: HTMLInputElement;
  readonly to: HTMLInputElement;
  readonly suggest: HTMLElement;
  readonly noMatch: HTMLElement;
  readonly statusSlot: HTMLElement;
  readonly shimmer: HTMLElement;
}

export function createSearchScreen(handlers: SearchHandlers): SearchScreenMount {
  const root = document.createElement("div");
  root.className = "search-screen";

  const statusSlot = document.createElement("div");
  statusSlot.className = "search-screen__status";

  const fields = document.createElement("div");
  fields.className = "search-fields";
  const stack = document.createElement("div");
  stack.className = "search-fields__stack";

  const from = document.createElement("input");
  from.className = "search-field";
  from.type = "search";
  from.id = "search-from";
  from.setAttribute("aria-label", COPY.from);
  from.setAttribute("aria-controls", "search-suggestions");
  from.setAttribute("aria-autocomplete", "list");
  from.addEventListener("focus", () => handlers.onFocusField("from"));
  from.addEventListener("input", () => handlers.onFromQuery(from.value));

  const to = document.createElement("input");
  to.className = "search-field";
  to.type = "search";
  to.id = "search-to";
  to.placeholder = COPY.whereTo;
  to.setAttribute("aria-label", COPY.to);
  to.setAttribute("aria-controls", "search-suggestions");
  to.setAttribute("aria-autocomplete", "list");
  to.addEventListener("focus", () => handlers.onFocusField("to"));
  to.addEventListener("input", () => handlers.onToQuery(to.value));

  const swap = document.createElement("button");
  swap.type = "button";
  swap.className = "search-swap";
  swap.setAttribute("aria-label", COPY.swap);
  swap.textContent = "⇅";
  swap.addEventListener("click", () => handlers.onSwap());

  const suggest = document.createElement("div");
  suggest.className = "suggest";
  suggest.id = "search-suggestions";
  suggest.setAttribute("role", "listbox");
  suggest.hidden = true;

  const noMatch = document.createElement("p");
  noMatch.className = "status-message status-message--secondary";
  noMatch.textContent = COPY.noMatchingPlace;
  noMatch.hidden = true;

  const shimmer = document.createElement("div");
  shimmer.className = "shimmer-row";
  shimmer.hidden = true;

  stack.append(from, to);
  fields.append(stack, swap);
  root.append(statusSlot, fields, suggest, noMatch, shimmer);

  to.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = suggest.querySelector<HTMLButtonElement>(".suggest__option");
    first?.click();
  });

  return { root, fields, from, to, suggest, noMatch, statusSlot, shimmer };
}

export function updateSearchScreen(mount: SearchScreenMount, state: UiState, handlers: SearchHandlers): void {
  mount.statusSlot.replaceChildren();
  const status = renderStatusBlock(state, handlers.onTryAgain);
  const blockFields =
    status !== null &&
    state.status !== "no-route" &&
    state.status !== "outside-pilot" &&
    state.status !== "loading-tiles";
  if (status) mount.statusSlot.append(status);
  mount.fields.hidden = blockFields;
  mount.suggest.hidden = blockFields;
  mount.noMatch.hidden = blockFields;
  if (blockFields) {
    mount.shimmer.hidden = true;
    return;
  }

  mount.from.placeholder = COPY.from;
  if (state.locationDenied) {
    const note = document.createElement("p");
    note.className = "search-location-note";
    note.textContent = COPY.locationOff;
    mount.statusSlot.append(note);
  }
  mount.from.disabled = false;
  mount.from.classList.toggle("search-field--active", state.focusedField === "from");
  mount.to.classList.toggle("search-field--active", state.focusedField === "to");

  const fromValue =
    state.editingField && state.focusedField === "from" ? state.fromQuery : state.fromQuery || state.start?.name || "";
  const toValue =
    state.editingField && state.focusedField === "to" ? state.toQuery : state.toQuery || state.end?.name || "";
  if (document.activeElement !== mount.from) mount.from.value = fromValue;
  if (document.activeElement !== mount.to) mount.to.value = toValue;

  const query = state.focusedField === "from" ? mount.from.value : mount.to.value;
  const matches = suggestionPlaces(state, query);

  mount.suggest.replaceChildren();
  const activeField = state.focusedField === "from" ? mount.from : mount.to;
  const inactiveField = state.focusedField === "from" ? mount.to : mount.from;
  inactiveField.setAttribute("aria-expanded", "false");
  inactiveField.removeAttribute("aria-activedescendant");
  if (matches.length > 0) {
    mount.suggest.hidden = false;
    mount.suggest.setAttribute("aria-label", state.focusedField === "from" ? COPY.from : COPY.to);
    let firstId = "";
    matches.forEach((place, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "suggest__option";
      option.id = `search-suggest-${index}`;
      option.textContent = place.name;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      if (index === 0) firstId = option.id;
      option.addEventListener("click", () => handlers.onPick(place));
      mount.suggest.append(option);
    });
    activeField.setAttribute("aria-expanded", "true");
    if (firstId) activeField.setAttribute("aria-activedescendant", firstId);
  } else {
    mount.suggest.hidden = true;
    activeField.setAttribute("aria-expanded", "false");
    activeField.removeAttribute("aria-activedescendant");
  }

  mount.noMatch.hidden = !showNoMatchingPlace(state, query, matches);
  mount.shimmer.hidden = state.status !== "loading-tiles";
}

export function renderSearchContent(state: UiState, handlers: SearchHandlers): HTMLElement {
  const mount = createSearchScreen(handlers);
  updateSearchScreen(mount, state, handlers);
  return mount.root;
}
