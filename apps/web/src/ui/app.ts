import { isSlotIndex, type SlotIndex } from "@shadeway/contract";
import { attachSheetKeyboard } from "./bottom-sheet";
import type { MapController } from "../map/controller";
import { createNoopMapController } from "./controller-stub";
import { defaultUiState } from "./fixtures";
import { segmentsForSlot } from "./slot-segments";
import { moveRouteSelection, renderCompareContent } from "./screens/compare";
import { renderInRouteBanner, renderInRouteContent } from "./screens/in-route";
import { renderSearchContent } from "./screens/search";
import { snapToNowSlot } from "./time-scrubber";
import type { RouteCardModel, UiState } from "./types";
import { UI_STYLES } from "./styles";

function applySegmentsForSlot(routes: readonly RouteCardModel[], slot: SlotIndex): readonly RouteCardModel[] {
  const segments = segmentsForSlot(slot);
  return routes.map((route) => ({ ...route, segments }));
}

export function createUiApp(
  root: HTMLElement,
  controller: MapController | undefined,
  initialState?: UiState,
): { getState: () => UiState; setState: (patch: Partial<UiState>) => void } {
  const map = controller ?? createNoopMapController();
  const base = initialState ?? defaultUiState();
  let state: UiState = {
    ...base,
    routes: applySegmentsForSlot(base.routes, base.slot),
  };

  const shell = document.createElement("div");
  shell.className = "shadeway-ui";

  const style = document.createElement("style");
  style.textContent = UI_STYLES;
  shell.append(style);

  const bannerHost = document.createElement("div");
  const sheet = document.createElement("section");
  sheet.className = "shadeway-sheet";
  sheet.setAttribute("aria-label", "Shadeway");

  const grabber = document.createElement("button");
  grabber.type = "button";
  grabber.className = "sheet-grabber";
  grabber.setAttribute("aria-label", "Sheet");
  const pill = document.createElement("span");
  pill.className = "sheet-grabber__pill";
  grabber.append(pill);

  const body = document.createElement("div");
  body.className = "sheet-body";

  sheet.append(grabber, body);
  shell.append(bannerHost, sheet);
  root.append(shell);

  const syncMap = () => {
    map.setSlot(state.slot);
    const selected = state.routes.find((route) => route.weight === state.selectedWeight);
    if (selected && state.screen === "compare") {
      map.setRoute({ weight: selected.weight, coordinates: [] });
    }
    if (state.screen === "in-route") {
      map.followPosition(true);
    } else {
      map.followPosition(false);
    }
  };

  const render = () => {
    sheet.dataset.detent = state.detent;
    bannerHost.replaceChildren();
    body.replaceChildren();

    if (state.screen === "in-route") {
      bannerHost.append(
        renderInRouteBanner(state, {
          onEnd: () => setState({ screen: "search", detent: "peek" }),
          onReroute: () => setState({ offRoute: false }),
        }),
      );
      body.append(
        renderInRouteContent(state, {
          onEnd: () => setState({ screen: "search", detent: "peek" }),
          onReroute: () => setState({ offRoute: false }),
        }),
      );
      return;
    }

    if (state.screen === "compare") {
      body.append(
        renderCompareContent(state, {
          onSelectWeight: (weight) => setState({ selectedWeight: weight }),
          onSlotChange: (slot) => {
            if (!isSlotIndex(slot)) return;
            setState({ slot, departureIsNow: false, routes: applySegmentsForSlot(state.routes, slot) });
          },
          onSnapNow: () => {
            const nowSlot = snapToNowSlot(12 * 60);
            setState({
              slot: nowSlot,
              departureIsNow: true,
              routes: applySegmentsForSlot(state.routes, nowSlot),
            });
          },
          onStart: () => setState({ screen: "in-route", detent: "peek" }),
          onTryAgain: () => setState({ status: "normal" }),
        }),
      );
      return;
    }

    body.append(
      renderSearchContent(state, () => {
        setState({ screen: "compare", detent: "half" });
        map.setEndMarker([121.05, 14.55]);
      }),
    );
  };

  const setState = (patch: Partial<UiState>) => {
    let next: UiState = { ...state, ...patch };
    if (patch.slot !== undefined && isSlotIndex(patch.slot)) {
      next = { ...next, routes: applySegmentsForSlot(next.routes, patch.slot) };
    }
    state = next;
    render();
    syncMap();
  };

  const getState = () => state;

  attachSheetKeyboard(grabber, () => state.detent, (detent) => setState({ detent }));

  body.addEventListener("keydown", (event) => {
    if (state.screen !== "compare") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      const next = moveRouteSelection(state, "next");
      if (next) {
        event.preventDefault();
        setState({ selectedWeight: next });
      }
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      const prev = moveRouteSelection(state, "prev");
      if (prev) {
        event.preventDefault();
        setState({ selectedWeight: prev });
      }
    }
  });

  grabber.addEventListener("click", () => {
    const order: UiState["detent"][] = ["peek", "half", "full"];
    const index = order.indexOf(state.detent);
    const next = order[(index + 1) % order.length];
    if (next) setState({ detent: next });
  });

  render();
  syncMap();

  shell.dataset.locationDenied = state.locationDenied ? "true" : "false";

  return {
    getState,
    setState: (patch) => {
      setState(patch);
      if (patch.locationDenied !== undefined) {
        shell.dataset.locationDenied = patch.locationDenied ? "true" : "false";
      }
    },
  };
}
