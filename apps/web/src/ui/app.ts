import { isSlotIndex, slotStartMinutes, type LngLat } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { MAP_SUN_DATE, type MapController } from "../map/controller";
import type { PilotData } from "../map/pilot";
import { attachSheetKeyboard } from "./bottom-sheet";
import { COPY } from "./copy";
import { createNoopMapController } from "./controller-stub";
import { createRouteClient, nearestNode, type RouteClient } from "./route-client";
import { manilaNowMinutes, shadeDepartureAvailable, snapToNowSlot } from "./departure-time";
import { cardsFromResults } from "./route-model";
import { effectiveRouteWeight } from "./route-selection";
import { moveRouteSelection, renderCompareContent } from "./screens/compare";
import { renderInRouteContent } from "./screens/in-route";
import { renderSearchContent } from "./screens/search";
import { segmentsForSlot } from "./slot-segments";
import type { PlacePick, RouteCardModel, UiState } from "./types";
import { UI_STYLES } from "./styles";

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
    tripSunMinutes: 0,
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
    const selected = state.routes.find((route) => route.weight === state.selectedWeight);
    const alternate = state.routes.find((route) => route.weight !== state.selectedWeight);
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
    body.replaceChildren();

    if (state.screen === "in-route") {
      body.append(
        renderInRouteContent(state, {
          onEnd: endToCompare,
          onShowRoute: () => map.fitRoute(),
        }),
      );
      return;
    }

    if (state.screen === "compare") {
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
              tripSunMinutes: selected?.sunMinutes ?? 0,
              tripDistanceM: selected?.distanceM ?? 0,
              timePickerOpen: false,
            });
          },
          onTryAgain: () => {
            if (live && state.status === "tile-failed") {
              window.location.reload();
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

    body.append(
      renderSearchContent(state, {
        onFocusField: (field) => setState({ focusedField: field, editingField: true, detent: "half" }),
        onFromQuery: (query) => setState({ fromQuery: query, query, focusedField: "from", editingField: true }),
        onToQuery: (query) => setState({ toQuery: query, query, focusedField: "to", editingField: true }),
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
        onPick: (place) => {
          if (live) pickPlace(place);
        },
      }),
    );
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
    const field = state.focusedField;
    if (field === "from" || !state.start) {
      map.setStartMarker(place.at, place.name);
      setState({
        start: place,
        fromQuery: place.name,
        editingField: true,
        focusedField: "to",
        toQuery: "",
        status: "normal",
        screen: "search",
        detent: "half",
      });
      return;
    }
    map.setEndMarker(place.at, place.name);
    setState({
      end: place,
      toQuery: place.name,
      editingField: false,
      screen: "compare",
      detent: "half",
      status: state.routes.length === 0 ? "loading-tiles" : "normal",
    });
    void routeBetween(state.start, place);
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
      const cards = cardsFromResults(routed, pilot.graph, pilot.tiles);
      if (cards.length === 0) {
        map.setStartMarker(null);
        map.setEndMarker(null);
        setState({ status: "no-route", routes: [], screen: "search", detent: "half", start: null, end: null });
        return;
      }
      const sun = shadeModel.sunPosition(departure, origin);
      const sunDown = sun.elevationDeg <= 0;
      const outsideHours = state.departureIsNow && !shadeDepartureAvailable(manilaNowMinutes());
      const shadeUnavailable = sunDown || outsideHours;
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
      setState({ status: "tile-failed", screen: "compare", detent: "half" });
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
    const next = state.detent === "peek" ? "half" : "peek";
    setState({ detent: next, editingField: next === "half" && state.screen === "search" });
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
          screen: offline ? "search" : "compare",
          detent: "half",
        });
        return;
      }
      livePilot = pilot;
      routeClient = createRouteClient();
      const slot = snapToNowSlot(manilaNowMinutes());
      setState({ places: pilot.places, slot, departureIsNow: true, status: "normal", screen: "search" });
      document.documentElement.dataset.places = String(pilot.places.length);
      if (import.meta.env.DEV) {
        window.__shadeway = {
          places: pilot.places,
          pick(at) {
            pickPlace({ name: `${at[1].toFixed(5)}, ${at[0].toFixed(5)}`, at: [at[0], at[1]] });
          },
          route(from, to, minutes) {
            const client = routeClient;
            if (!livePilot || !client) return Promise.reject(new Error("router is not ready"));
            return client.route(livePilot, nearestNode(livePilot.graph, from), nearestNode(livePilot.graph, to), {
              date: MAP_SUN_DATE,
              minutes,
            });
          },
        };
      }
      map.subscribeMapTap((position) => {
        if (state.screen === "in-route") return;
        pickPlace({ name: `${position[1].toFixed(5)}, ${position[0].toFixed(5)}`, at: position });
      });
    });
  }

  return { getState: () => state, setState };
}
