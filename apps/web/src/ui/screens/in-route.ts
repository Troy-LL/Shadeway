import { COPY, formatMinutes, formatMinutesInSun } from "../copy";
import type { UiState } from "../types";

export interface InRouteHandlers {
  readonly onEnd: () => void;
  readonly onReroute: () => void;
}

export function renderInRouteBanner(state: UiState, handlers: InRouteHandlers): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "in-route-banner";
  banner.setAttribute("role", "status");

  if (state.offRoute) {
    const off = document.createElement("span");
    off.textContent = `${COPY.offRoute} `;
    const reroute = document.createElement("button");
    reroute.type = "button";
    reroute.className = "secondary-action";
    reroute.textContent = COPY.reroute;
    reroute.addEventListener("click", handlers.onReroute);
    banner.append(off, reroute);
    return banner;
  }

  banner.textContent = state.navigationLine;
  return banner;
}

export function renderInRouteContent(state: UiState, handlers: InRouteHandlers): HTMLElement {
  const container = document.createElement("div");
  container.className = "in-route-screen in-route-sheet__row";

  const left = document.createElement("div");
  const minutes = document.createElement("p");
  minutes.textContent = formatMinutes(state.minutesRemaining);
  const sun = document.createElement("p");
  sun.className = "in-route-sheet__sun";
  sun.textContent = formatMinutesInSun(state.sunMinutesRemaining);
  left.append(minutes, sun);

  const end = document.createElement("button");
  end.type = "button";
  end.className = "chip chip--primary";
  end.textContent = COPY.end;
  end.addEventListener("click", handlers.onEnd);

  container.append(left, end);
  return container;
}
