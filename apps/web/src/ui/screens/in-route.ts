import { COPY, ROUTE_ESTIMATE_LABEL, formatDistanceM, formatMinutes, formatMinutesInSun } from "../copy";
import { formatDepartureChip } from "../departure-time";
import type { UiState } from "../types";

export interface InRouteHandlers {
  readonly onEnd: () => void;
  readonly onShowRoute: () => void;
}

export function renderInRouteContent(state: UiState, handlers: InRouteHandlers): HTMLElement {
  const container = document.createElement("div");
  container.className = "in-route-screen";

  const status = document.createElement("p");
  status.className = "in-route-screen__status";
  const leave = formatDepartureChip(state.departureIsNow, state.slot);
  status.textContent = `${COPY.routeOverview} · ${leave}`;

  const sun = document.createElement("p");
  sun.className = "in-route-screen__sun";
  sun.textContent = formatMinutesInSun(state.tripSunMinutes);

  const totals = document.createElement("p");
  totals.className = "in-route-screen__totals";
  totals.textContent = `${formatMinutes(state.tripMinutes)} · ${formatDistanceM(state.tripDistanceM)}`;

  const label = document.createElement("p");
  label.className = "sheet-estimate-label";
  label.textContent = ROUTE_ESTIMATE_LABEL;

  const actions = document.createElement("div");
  actions.className = "in-route-actions";

  const showRoute = document.createElement("button");
  showRoute.type = "button";
  showRoute.className = "chip";
  showRoute.textContent = COPY.showRoute;
  showRoute.addEventListener("click", handlers.onShowRoute);

  const end = document.createElement("button");
  end.type = "button";
  end.className = "primary-action primary-action--inline";
  end.textContent = COPY.end;
  end.addEventListener("click", handlers.onEnd);

  actions.append(showRoute, end);
  container.append(status, sun, totals, label, actions);
  return container;
}
