import { isSlotIndex, slotStartMinutes, type LngLat } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { MAP_SUN_DATE, type MapController } from "../map/controller";
import type { PilotData } from "../map/pilot";
import { attachSheetKeyboard } from "./bottom-sheet";
import { placePickField } from "./pick-place";
import { focusSelectedRouteCard } from "./route-card-focus";
import { bindVisualViewport } from "./viewport-sheet";
import { COPY } from "./copy";
import { createNoopMapController } from "./controller-stub";
import { createRouteClient, nearestNode, type RouteClient } from "./route-client";
import { manilaNowMinutes, shadeDepartureAvailable, snapToNowSlot } from "./departure-time";
import { cardsFromResults, displayedRoutes } from "./route-model";
import { effectiveRouteWeight } from "./route-selection";
import { moveRouteSelection, renderCompareContent } from "./screens/compare";
import { renderInRouteContent } from "./screens/in-route";
import { createSearchScreen, updateSearchScreen, type SearchScreenMount } from "./screens/search";
import { segmentsForSlot } from "./slot-segments";
import type { PlacePick, RouteCardModel, UiState } from "./types";
import { UI_STYLES } from "./styles";

function routeMidpoint(line: readonly LngLat[]): LngLat | null {
  if (line.length === 0) return null;
  return line[Math.floor(line.length / 2)] ?? null;
}

function applySegmentsForSlot(routes: readonly RouteCardModel[], slot: UiState["slot"]): readonly RouteCardModel[] {
  const segments = segmentsForSlot(slot);
  return routes.map((route) => ({ ...route, segments }));
}

function emptyUiState(): UiState {
  return {
    screen: "search",
    detent: "half",
    status: "normal",
    selectedWeight: "shadiest",
    preferredWeight: "shadiest",
    slot: 12,
    departureIsNow: true,
    routes: [],
    locationDenied: false,
    tripMinutes: 0,
    tripSunMinutes: null,
    tripDistanceM: 0,
    fromQuery: "",
    toQuery: "",
    focusedField: "to",
    editingField: false,
    query: "",
    places: [],
    start: null,
    end: null,
    timePickerOpen: false,
  };
}

export function createUiApp(
  root: HTMLElement,
  controller: MapController | undefined,
  initialState?: UiState,
): { getState: () => UiState; setState: (patch: Partial<UiState>) => void } {
  const map = controller ?? createNoopMapController();
  const live = initialState === undefined;
  const base = initialState ?? emptyUiState();
  let state: UiState = live ? base : { ...base, routes: applySegmentsForSlot(base.routes, base.slot) };
  let livePilot: PilotData | null = null;
  let routeClient: RouteClient | null = null;
  let routeGeneration = 0;
  let framed = "";
  let searchMount: SearchScreenMount | null = null;

  const shell = document.createElement("div");
  shell.className = "shadeway-ui";

  const style = document.createElement("style");
  style.textContent = UI_STYLES;
  shell.append(style);

  const sheet = document.createElement("section");
  sheet.className = "shadeway-sheet";
  sheet.setAttribute("aria-label", "Shadeway");

  const grabber = document.createElement("button");
  grabber.type = "button";
  grabber.className = "sheet-grabber";
  grabber.setAttribute("aria-label", COPY.expandSheet);
  const pill = document.createElement("span");
  pill.className = "sheet-grabber__pill";
  grabber.append(pill);

  const body = document.createElement("div");
  body.className = "sheet-body";

  sheet.append(grabber, body);
  shell.append(sheet);
  root.append(shell);

  const syncMap = () => {
    map.setSlot(state.slot);
    const routes = displayedRoutes(state);
    const selected = routes.find((route) => route.weight === state.selectedWeight) ?? routes[0];
    const alternate = selected ? routes.find((route) => route.weight !== selected.weight) : undefined;
    const showRoutes = state.screen === "compare" || state.screen === "in-route";
    if (showRoutes && selected && selected.geometry.length >= 2) {
      map.setRoute({ weight: selected.weight, coordinates: selected.geometry });
      if (state.screen === "compare" && alternate && alternate.geometry.length >= 2) {
        map.setAlternateRoute({ weight: alternate.weight, coordinates: alternate.geometry });
      } else {
        map.setAlternateRoute(null);
      }
      const key = `${selected.weight}:${selected.edgeKey}`;
      if (state.screen === "compare" && framed !== key) {
        framed = key;
        map.fitRoute();
      }
    } else if (selected && selected.geometry.length >= 2) {
      map.setRoute({ weight: selected.weight, coordinates: selected.geometry });
      map.setAlternateRoute(null);
    }
    map.followPosition(false);
    if (state.screen === "compare" && state.start && state.end) {
      const labels: { text: string; at: LngLat }[] = [];
      const labelForRoute = (route: RouteCardModel) => {
        if (state.status === "shade-unavailable" || route.shadeUnavailable) return COPY.fastestWalk;
        switch (route.weight) {
          case "shadiest":
            return COPY.shadiest;
          case "fastest":
            return COPY.fastest;
          case "balanced":
            return "Balanced";
          default: {
            const _exhaustive: never = route.weight;
            return String(_exhaustive);
          }
        }
      };
      if (selected?.geometry.length) {
        const at = routeMidpoint(selected.geometry);
        if (at) labels.push({ text: labelForRoute(selected), at });
      }
      if (alternate?.geometry.length) {
        const at = routeMidpoint(alternate.geometry);
        if (at) labels.push({ text: labelForRoute(alternate), at });
      }
      map.setRouteMidpointLabels(labels);
    } else {
      map.setRouteMidpointLabels([]);
    }
    if (state.start || state.end) {
      map.setStartMarker(state.start?.at ?? null, state.start?.name);
      map.setEndMarker(state.end?.at ?? null, state.end?.name);
    }
  };

  const render = () => {
    sheet.dataset.detent = state.detent;
    sheet.dataset.screen = state.screen;
    sheet.dataset.editing = state.editingField ? "true" : "false";
    grabber.setAttribute("aria-label", state.detent === "peek" ? COPY.expandSheet : COPY.collapseSheet);

    if (state.screen === "in-route") {
      searchMount = null;
      body.replaceChildren();
      body.append(
        renderInRouteContent(state, {
          onEnd: endToCompare,
          onShowRoute: () => map.fitRoute(),
        }),
      );
      return;
    }

    if (state.screen === "compare") {
      searchMount = null;
      body.replaceChildren();
      body.append(
        renderCompareContent(state, {
          onSelectWeight: (weight) => {
            const shadeUnavailable = state.status === "shade-unavailable";
            setState({
              preferredWeight: weight,
              selectedWeight: effectiveRouteWeight(weight, shadeUnavailable),
            });
          },
          onSlotChange: (slot) => {
            if (!isSlotIndex(slot)) return;
            if (!live) {
              setState({ slot, departureIsNow: false, routes: applySegmentsForSlot(state.routes, slot), timePickerOpen: false });
              return;
            }
            setState({ slot, departureIsNow: false, timePickerOpen: false });
            if (state.start && state.end) void routeBetween(state.start, state.end);
          },
          onPickNow: () => {
            const nowSlot = snapToNowSlot(live ? manilaNowMinutes() : 12 * 60);
            if (!live) {
              setState({
                slot: nowSlot,
                departureIsNow: true,
                routes: applySegmentsForSlot(state.routes, nowSlot),
                timePickerOpen: false,
              });
              return;
            }
            setState({ slot: nowSlot, departureIsNow: true, timePickerOpen: false });
            if (state.start && state.end) void routeBetween(state.start, state.end);
          },
          onToggleTimePicker: () => setState({ timePickerOpen: !state.timePickerOpen }),
          onStart: () => {
            const selected = state.routes.find((route) => route.weight === state.selectedWeight);
            setState({
              screen: "in-route",
              detent: "half",
              tripMinutes: selected?.totalMinutes ?? 0,
              tripSunMinutes: selected?.sunMinutes ?? null,
              tripDistanceM: selected?.distanceM ?? 0,
              timePickerOpen: false,
            });
          },
          onTryAgain: () => {
            if (live && !livePilot) {
              setState({ status: "loading-tiles" });
              void map.reloadPilot().then((pilot) => {
                if (!pilot) {
                  setState({ status: "tile-failed", screen: "search", editingField: false });
                  return;
                }
                livePilot = pilot;
                routeClient = createRouteClient();
                setState({ places: pilot.places, status: "normal", screen: "search" });
                if (state.start && state.end) void routeBetween(state.start, state.end);
              });
              return;
            }
            if (live && state.start && state.end) {
              setState({ status: "loading-tiles" });
              void routeBetween(state.start, state.end);
              return;
            }
            setState({ status: "normal" });
          },
          onBack: () =>
            setState({
              screen: "search",
              detent: "half",
              editingField: true,
              focusedField: "to",
              toQuery: state.end?.name ?? "",
              fromQuery: state.start?.name ?? "",
            }),
        }),
      );
      return;
    }

    const searchHandlers = {
      onFocusField: (field: "from" | "to") => setState({ focusedField: field, editingField: true, detent: "half" }),
      onFromQuery: (query: string) => {
        const pinned = state.start?.name.trim() ?? "";
        setState({
          fromQuery: query,
          query,
          focusedField: "from",
          editingField: true,
          start: pinned && query.trim() === pinned ? state.start : null,
        });
      },
      onToQuery: (query: string) => {
        const pinned = state.end?.name.trim() ?? "";
        setState({
          toQuery: query,
          query,
          focusedField: "to",
          editingField: true,
          end: pinned && query.trim() === pinned ? state.end : null,
        });
      },
      onSwap: () => {
        if (!state.start && !state.end) return;
        map.setStartMarker(state.end?.at ?? null, state.end?.name);
        map.setEndMarker(state.start?.at ?? null, state.start?.name);
        setState({
          start: state.end,
          end: state.start,
          fromQuery: state.end?.name ?? "",
          toQuery: state.start?.name ?? "",
        });
      },
      onPick: (place: PlacePick) => {
        if (live) pickPlace(place);
      },
      onTryAgain: () => {
        if (live && !livePilot) {
          setState({ status: "loading-tiles" });
          void map.reloadPilot().then((pilot) => {
            if (!pilot) {
              setState({ status: "tile-failed", screen: "search", editingField: false });
              return;
            }
            livePilot = pilot;
            routeClient = createRouteClient();
            setState({ places: pilot.places, status: "normal", screen: "search" });
          });
          return;
        }
        setState({ status: "normal" });
      },
    };
    if (!searchMount || !body.contains(searchMount.root)) {
      searchMount = createSearchScreen(searchHandlers);
      body.replaceChildren();
      body.append(searchMount.root);
    }
    updateSearchScreen(searchMount, state, searchHandlers);
  };

  const setState = (patch: Partial<UiState>) => {
    let next: UiState = { ...state, ...patch };
    if (!live && patch.slot !== undefined && isSlotIndex(patch.slot) && patch.routes === undefined) {
      next = { ...next, routes: applySegmentsForSlot(next.routes, patch.slot) };
    }
    state = next;
    render();
    syncMap();
    if (patch.locationDenied !== undefined) {
      shell.dataset.locationDenied = patch.locationDenied ? "true" : "false";
    }
    if (patch.locationDenied === true) {
      queueMicrotask(() => searchMount?.from.focus());
    }
  };

  function endToCompare(): void {
    setState({
      screen: "compare",
      detent: "half",
      timePickerOpen: false,
    });
  }

  function inside(pilot: PilotData, point: LngLat): boolean {
    const [west, south, east, north] = pilot.manifest.bbox;
    return point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
  }

  function pickPlace(place: PlacePick): void {
    const pilot = livePilot;
    if (!pilot) return;
    if (!inside(pilot, place.at)) {
      map.setPilotBox(true);
      setState({ status: "outside-pilot", screen: "search", detent: "half", editingField: false });
      return;
    }
    map.setPilotBox(false);
    const field = placePickField(state);
    if (field === "to") {
      map.setEndMarker(place.at, place.name);
      if (!state.start) {
        setState({
          end: place,
          toQuery: place.name,
          editingField: true,
          focusedField: "from",
          fromQuery: "",
          status: "normal",
          screen: "search",
          detent: "half",
        });
        return;
      }
      setState({
        end: place,
        toQuery: place.name,
        editingField: false,
        screen: "compare",
        detent: "half",
        status: state.routes.length === 0 ? "loading-tiles" : "normal",
      });
      void routeBetween(state.start, place);
      return;
    }
    map.setStartMarker(place.at, place.name);
    setState({
      start: place,
      fromQuery: place.name,
      editingField: true,
      focusedField: state.end ? "to" : "to",
      toQuery: state.end?.name ?? "",
      status: "normal",
      screen: state.end ? "compare" : "search",
      detent: "half",
    });
    if (state.end) void routeBetween(place, state.end);
  }

  async function routeBetween(start: PlacePick, end: PlacePick, from?: LngLat): Promise<void> {
    const pilot = livePilot;
    const client = routeClient;
    if (!pilot || !client) return;
    const generation = routeGeneration + 1;
    routeGeneration = generation;
    const slot = state.slot;
    const departure = { date: MAP_SUN_DATE, minutes: slotStartMinutes(slot) };
    const origin = from ?? start.at;
    try {
      const routed = await client.route(
        pilot,
        nearestNode(pilot.graph, origin),
        nearestNode(pilot.graph, end.at),
        departure,
      );
      if (generation !== routeGeneration) return;
      const sun = shadeModel.sunPosition(departure, origin);
      const sunDown = sun.elevationDeg <= 0;
      const outsideHours = state.departureIsNow && !shadeDepartureAvailable(manilaNowMinutes());
      const shadeUnavailable = sunDown || outsideHours;
      const cards = cardsFromResults(routed, pilot.graph, pilot.tiles, {
        shadeCoverageUnavailable: shadeUnavailable,
        canopy: pilot.manifest.canopy === true,
      });
      if (cards.length === 0) {
        map.setStartMarker(null);
        map.setEndMarker(null);
        setState({ status: "no-route", routes: [], screen: "search", detent: "half", start: null, end: null });
        return;
      }
      const selectedWeight = effectiveRouteWeight(state.preferredWeight, shadeUnavailable);
      const picked = cards.find((card) => card.weight === selectedWeight) ?? cards[0];
      if (!picked) return;
      const screen = state.screen === "in-route" ? "in-route" : "compare";
      setState({
        status: shadeUnavailable ? "shade-unavailable" : "normal",
        routes: cards,
        selectedWeight: picked.weight,
        screen,
        detent: "half",
        tripMinutes: picked.totalMinutes,
        tripSunMinutes: picked.sunMinutes,
        tripDistanceM: picked.distanceM,
      });
      document.documentElement.dataset.route = "ready";
    } catch {
      if (generation !== routeGeneration) return;
      setState({ status: "tile-failed", screen: "search", detent: "half", editingField: false });
    }
  }

  attachSheetKeyboard(grabber, () => state.detent, (detent) => setState({ detent, editingField: detent === "half" }));

  body.addEventListener("keydown", (event) => {
    if (state.screen !== "compare") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      const next = moveRouteSelection(state, "next");
      if (next) {
        event.preventDefault();
        setState({ selectedWeight: next });
        queueMicrotask(() => focusSelectedRouteCard(body));
      }
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      const prev = moveRouteSelection(state, "prev");
      if (prev) {
        event.preventDefault();
        setState({ selectedWeight: prev });
        queueMicrotask(() => focusSelectedRouteCard(body));
      }
    }
  });

  grabber.addEventListener("click", () => {
    const next = state.detent === "peek" ? "half" : "peek";
    setState({ detent: next, editingField: next === "half" && state.screen === "search" });
  });

  bindVisualViewport((layout) => {
    if (layout.editHeightPx > 0) {
      document.documentElement.style.setProperty("--sheet-edit-height", `${Math.round(layout.editHeightPx)}px`);
      document.documentElement.style.setProperty(
        "--sheet-keyboard-offset",
        `${Math.round(layout.keyboardOffsetPx)}px`,
      );
    } else {
      document.documentElement.style.removeProperty("--sheet-edit-height");
      document.documentElement.style.removeProperty("--sheet-keyboard-offset");
    }
    sheet.dataset.keyboard = layout.keyboardOffsetPx > 0 ? "true" : "false";
  });

  render();
  syncMap();
  shell.dataset.locationDenied = state.locationDenied ? "true" : "false";

  if (live) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    void map.whenReady().then((pilot) => {
      if (!pilot) {
        setState({
          status: offline ? "offline" : "tile-failed",
          screen: "search",
          detent: "half",
          editingField: false,
        });
        return;
      }
      livePilot = pilot;
      routeClient = createRouteClient();
      const slot = snapToNowSlot(manilaNowMinutes());
      setState({ places: pilot.places, slot, departureIsNow: true, status: "normal", screen: "search" });
      document.documentElement.dataset.places = String(pilot.places.length);
      const harness = import.meta.env.DEV || import.meta.env.VITE_CAPTURE === "1";
      if (harness) {
        window.__shadeway = {
          places: pilot.places,
          pick(at) {
            pickPlace({ name: COPY.droppedPin, at: [at[0], at[1]] });
          },
          route(from, to, minutes) {
            const client = routeClient;
            if (!livePilot || !client) return Promise.reject(new Error("router is not ready"));
            return client.route(livePilot, nearestNode(livePilot.graph, from), nearestNode(livePilot.graph, to), {
              date: MAP_SUN_DATE,
              minutes,
            });
          },
          mapDiagnostics() {
            return map.mapDiagnostics();
          },
        };
      }
      map.subscribeMapTap((position) => {
        if (state.screen === "in-route") return;
        pickPlace({ name: COPY.droppedPin, at: position });
      });
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => setState({ locationDenied: true, focusedField: "from", editingField: true, screen: "search", detent: "half" }),
          { timeout: 8_000, maximumAge: 60_000 },
        );
      }
    });
  }

  return { getState: () => state, setState };
}
