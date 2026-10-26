import type { RouteWeight } from "@shadeway/contract";
import { COPY, ROUTE_ESTIMATE_LABEL, formatMinutes, formatMinutesInSun } from "../copy";
import { renderShadeStrip } from "../shade-strip";
import { renderTimeScrubber } from "../time-scrubber";
import type { RouteCardModel, UiState } from "../types";
import { renderStatusBlock } from "./status";

const WEIGHT_LABEL: Record<RouteWeight, string> = {
  shadiest: COPY.shadiest,
  balanced: COPY.balanced,
  fastest: COPY.fastest,
};

export interface CompareHandlers {
  readonly onSelectWeight: (weight: RouteWeight) => void;
  readonly onSlotChange: (slot: number) => void;
  readonly onSnapNow: () => void;
  readonly onStart: () => void;
  readonly onTryAgain: () => void;
}

function visibleRoutes(state: UiState): readonly RouteCardModel[] {
  if (state.status === "night") {
    return state.routes.filter((route) => route.weight === "fastest");
  }
  return state.routes;
}

export function renderCompareContent(state: UiState, handlers: CompareHandlers): HTMLElement {
  const container = document.createElement("div");
  container.className = "compare-screen";

  const status = renderStatusBlock(state, handlers.onTryAgain);
  if (status && state.status !== "night") {
    container.append(status);
    return container;
  }

  if (state.status === "loading-tiles") {
    const loading = renderStatusBlock(state);
    if (loading) container.append(loading);
    return container;
  }

  if (status) container.append(status);

  const group = document.createElement("div");
  group.className = "route-cards";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Routes");

  const routes = visibleRoutes(state);
  for (const route of routes) {
    group.append(renderRouteCard(route, route.weight === state.selectedWeight, handlers.onSelectWeight));
  }

  container.append(group);

  if (state.status === "normal" || state.status === "night") {
    container.append(
      renderTimeScrubber({
        slot: state.slot,
        departureIsNow: state.departureIsNow,
        onSlotChange: handlers.onSlotChange,
        onSnapNow: handlers.onSnapNow,
      }),
    );

    const start = document.createElement("button");
    start.type = "button";
    start.className = "primary-action";
    start.textContent = COPY.start;
    start.addEventListener("click", handlers.onStart);
    container.append(start);
  }

  return container;
}

function renderRouteCard(
  route: RouteCardModel,
  selected: boolean,
  onSelect: (weight: RouteWeight) => void,
): HTMLElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "route-card";
  card.setAttribute("role", "radio");
  card.setAttribute("aria-checked", selected ? "true" : "false");
  card.tabIndex = selected ? 0 : -1;
  card.addEventListener("click", () => onSelect(route.weight));

  const badge = document.createElement("span");
  badge.className = "confidence-badge";
  badge.textContent = route.confidence;

  const title = document.createElement("h3");
  title.className = "route-card__title";
  title.textContent = WEIGHT_LABEL[route.weight];

  const total = document.createElement("p");
  total.className = "route-card__total";
  total.textContent = formatMinutes(route.totalMinutes);

  const sun = document.createElement("p");
  sun.className = "route-card__sun";
  sun.textContent = formatMinutesInSun(route.sunMinutes);

  const strip = renderShadeStrip(route.segments);

  const estimate = document.createElement("span");
  estimate.className = "route-card__badge";
  estimate.textContent = ROUTE_ESTIMATE_LABEL;

  card.append(badge, title);
  if (route.note) {
    const note = document.createElement("p");
    note.className = "route-card__note";
    note.textContent = route.note;
    card.append(note);
  }
  card.append(total, sun, strip, estimate);
  return card;
}

export function moveRouteSelection(
  state: UiState,
  direction: "next" | "prev",
): RouteWeight | null {
  const routes = visibleRoutes(state);
  const index = routes.findIndex((route) => route.weight === state.selectedWeight);
  if (index < 0) return routes[0]?.weight ?? null;
  const nextIndex = direction === "next" ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= routes.length) return null;
  return routes[nextIndex]?.weight ?? null;
}
