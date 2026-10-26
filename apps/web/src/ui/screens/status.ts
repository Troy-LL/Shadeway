import { COPY } from "../copy";
import type { UiState } from "../types";

export function renderStatusBlock(state: UiState, onTryAgain?: () => void): HTMLElement | null {
  switch (state.status) {
    case "normal":
      return null;
    case "loading-tiles": {
      const wrap = document.createElement("div");
      const shimmer = document.createElement("div");
      shimmer.className = "shimmer-card";
      wrap.append(shimmer);
      const msg = document.createElement("p");
      msg.className = "status-message";
      msg.textContent = COPY.loadingShade;
      wrap.append(msg);
      return wrap;
    }
    case "no-route": {
      const msg = document.createElement("p");
      msg.className = "status-message";
      msg.textContent = COPY.noWalkingRoute;
      return msg;
    }
    case "outside-pilot": {
      const msg = document.createElement("p");
      msg.className = "status-message";
      msg.textContent = COPY.outsidePilot;
      return msg;
    }
    case "night": {
      const msg = document.createElement("p");
      msg.className = "status-message status-message--secondary";
      msg.textContent = COPY.sunIsDown;
      return msg;
    }
    case "offline": {
      const msg = document.createElement("p");
      msg.className = "status-message";
      msg.textContent = COPY.offline;
      return msg;
    }
    case "tile-failed": {
      const wrap = document.createElement("div");
      const msg = document.createElement("p");
      msg.className = "status-message";
      msg.textContent = COPY.couldNotLoadShade;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary-action";
      btn.textContent = COPY.tryAgain;
      if (onTryAgain) btn.addEventListener("click", onTryAgain);
      wrap.append(msg, btn);
      return wrap;
    }
    default: {
      const _exhaustive: never = state.status;
      return _exhaustive;
    }
  }
}
