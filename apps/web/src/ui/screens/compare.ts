import type { RouteWeight } from "@shadeway/contract";
import {
  COPY,
  ROUTE_ESTIMATE_LABEL,
  formatDistanceM,
  formatMinutes,
  formatMinutesInSun,
} from "../copy";
import {
  manilaNowMinutes,
  renderDepartureChip,
  renderDeparturePicker,
  shadeDepartureAvailable,
  slotStartMinutes,
} from "../departure-time";
import { displayedRoutes } from "../route-model";
import { renderShadeStrip } from "../shade-strip";
import type { RouteCardModel, UiState } from "../types";
import { renderStatusBlock } from "./status";

export interface CompareHandlers {
  readonly onSelectWeight: (weight: RouteWeight) => void;
  readonly onSlotChange: (slot: number) => void;
  readonly onPickNow: () => void;
  readonly onToggleTimePicker: () => void;
  readonly onStart: () => void;
  readonly onTryAgain: () => void;
  readonly onBack: () => void;
}

function visibleRoutes(state: UiState): readonly RouteCardModel[] {
  return displayedRoutes(state);
}

export function renderCompareContent(state: UiState, handlers: CompareHandlers): HTMLElement {
  const container = document.createElement("div");
  container.className = "compare-screen";

  const peek = document.createElement("p");
  peek.className = "compare-peek-summary";
  const selected = state.routes.find((route) => route.weight === state.selectedWeight);
  if (selected) {
    peek.textContent = `${compareCardTitle(selected)} · ${formatMinutes(selected.totalMinutes)} · ${formatDistanceM(selected.distanceM)}`;
  }
  container.append(peek);

  const header = document.createElement("div");
  header.className = "compare-header";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "icon-button";
  back.textContent = "←";
  back.setAttribute("aria-label", COPY.back);
  back.addEventListener("click", handlers.onBack);

  const chips = document.createElement("div");
  chips.className = "compare-header__chips";
  const shadeAvailable = shadeDepartureAvailable(
    state.departureIsNow ? manilaNowMinutes() : slotStartMinutes(state.slot),
  );
  chips.append(
    renderDepartureChip({
      slot: state.slot,
      departureIsNow: state.departureIsNow,
      shadeAvailable,
      open: state.timePickerOpen,
      onToggle: handlers.onToggleTimePicker,
      onPickNow: handlers.onPickNow,
      onPickSlot: (slot) => handlers.onSlotChange(slot),
    }),
  );
  const badge = document.createElement("span");
  badge.className = "confidence-badge";
  badge.textContent = state.routes.some((route) => route.confidence === "Estimate + canopy")
    ? "Estimate + canopy"
    : "Estimate";
  chips.append(badge);
  header.append(back, chips);
  container.append(header);

  const status = renderStatusBlock(state, handlers.onTryAgain);
  if (status && state.status !== "shade-unavailable") {
    container.append(status);
    return container;
  }

  if (state.status === "loading-tiles") {
    const loading = renderStatusBlock(state);
    if (loading) container.append(loading);
    return container;
  }

  if (status) container.append(status);

  const scroll = document.createElement("div");
  scroll.className = "compare-screen__scroll";

  if (state.timePickerOpen) {
    scroll.append(
      renderDeparturePicker({
        slot: state.slot,
        departureIsNow: state.departureIsNow,
        shadeAvailable,
        open: true,
        onToggle: handlers.onToggleTimePicker,
        onPickNow: handlers.onPickNow,
        onPickSlot: (slot) => handlers.onSlotChange(slot),
      }),
    );
  }

  const group = document.createElement("div");
  group.className = "route-cards";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Routes");
  group.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("route-card")) return;
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    const weight = target.dataset.weight;
    if (weight === "shadiest" || weight === "fastest") {
      handlers.onSelectWeight(weight);
      target.focus();
    }
  });

  const routes = visibleRoutes(state);
  for (const route of routes) {
    group.append(renderRouteCard(route, route.weight === state.selectedWeight, handlers.onSelectWeight));
  }

  scroll.append(group);
  container.append(scroll);

  const footer = document.createElement("div");
  footer.className = "compare-screen__footer";
  const estimate = document.createElement("p");
  estimate.className = "sheet-estimate-label";
  estimate.textContent = ROUTE_ESTIMATE_LABEL;
  footer.append(estimate);

  if (state.status === "normal" || state.status === "shade-unavailable") {
    const start = document.createElement("button");
    start.type = "button";
    start.className = "primary-action";
    start.textContent = COPY.start;
    start.addEventListener("click", handlers.onStart);
    footer.append(start);
  }
  container.append(footer);

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
  card.dataset.weight = route.weight;
  card.setAttribute("role", "radio");
  card.setAttribute("aria-checked", selected ? "true" : "false");
  card.tabIndex = selected ? 0 : -1;
  card.addEventListener("click", () => onSelect(route.weight));

  const title = document.createElement("h3");
  title.className = "route-card__title sr-only";
  title.textContent = cardTitle(route);

  const meta = document.createElement("p");
  meta.className = "route-card__meta";
  meta.textContent = `${cardTitle(route)} · ${formatMinutes(route.totalMinutes)} · ${formatDistanceM(route.distanceM)}`;

  const sun = document.createElement("p");
  sun.className = "route-card__sun";
  if (route.shadeUnavailable) {
    sun.textContent = COPY.shadeUnavailable;
    sun.classList.add("route-card__sun--muted");
  } else {
    sun.textContent = formatMinutesInSun(route.sunMinutes, route.sunMinutes === null);
  }

  const strip = route.shadeUnavailable ? null : renderShadeStrip(route.segments);

  card.append(title, sun, meta);
  if (strip) card.append(strip);
  if (selected) {
    const mark = document.createElement("span");
    mark.className = "route-card__check";
    mark.textContent = "✓";
    mark.setAttribute("aria-hidden", "true");
    card.append(mark);
  }
  return card;
}

export function compareCardTitle(route: RouteCardModel): string {
  if (route.shadeUnavailable) return COPY.fastestWalk;
  if (route.note === COPY.availableRoute) return COPY.availableRoute;
  if (route.note === COPY.shadiestAndFastest) return COPY.shadiestAndFastest;
  if (route.weight === "shadiest") return COPY.shadiest;
  return COPY.fastest;
}

function cardTitle(route: RouteCardModel): string {
  return compareCardTitle(route);
}

export function moveRouteSelection(state: UiState, direction: "next" | "prev"): RouteWeight | null {
  const routes = visibleRoutes(state);
  const index = routes.findIndex((route) => route.weight === state.selectedWeight);
  if (index < 0) return routes[0]?.weight ?? null;
  const nextIndex = direction === "next" ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= routes.length) return null;
  return routes[nextIndex]?.weight ?? null;
}
