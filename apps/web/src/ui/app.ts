import { isSlotIndex, slotStartMinutes, type LngLat } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { MAP_SUN_DATE, type MapController } from "../map/controller";
import type { PilotData } from "../map/pilot";
import { attachSheetKeyboard } from "./bottom-sheet";
import { createNoopMapController } from "./controller-stub";
import { createRouteClient, nearestNode, type RouteClient } from "./route-client";
import { cardsFromResults } from "./route-model";
import { moveRouteSelection, renderCompareContent } from "./screens/compare";
import { renderInRouteBanner, renderInRouteContent } from "./screens/in-route";
import { renderSearchContent } from "./screens/search";
import { segmentsForSlot } from "./slot-segments";
import { manilaNowMinutes, snapToNowSlot } from "./time-scrubber";
import type { PlacePick, RouteCardModel, UiState } from "./types";
import { UI_STYLES } from "./styles";

function applySegmentsForSlot(routes: readonly RouteCardModel[], slot: UiState["slot"]): readonly RouteCardModel[] {
  const segments = segmentsForSlot(slot);
  return routes.map((route) => ({ ...route, segments }));
}

function emptyUiState(): UiState {
  return {
    screen: "search",
    detent: "peek",
    status: "normal",
    selectedWeight: "shadiest",
    slot: 12,
    departureIsNow: true,
    routes: [],
    locationDenied: false,
    minutesRemaining: 0,
    sunMinutesRemaining: 0,
    offRoute: false,
    navigationLine: "",
    recents: [],
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
  let offPoint: LngLat | null = null;

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
    if (selected && (state.screen === "compare" || state.screen === "in-route") && selected.geometry.length >= 2) {
      map.setRoute({ weight: selected.weight, coordinates: selected.geometry });
      const key = `${selected.weight}:${selected.edgeKey}`;
      if (state.screen === "compare" && framed !== key) {
        framed = key;
        map.fitRoute();
      }
    }
    map.followPosition(state.screen === "in-route");
  };

  const render = () => {
    sheet.dataset.detent = state.detent;
    sheet.dataset.screen = state.screen;
    bannerHost.replaceChildren();
    body.replaceChildren();

    if (state.screen === "in-route") {
      bannerHost.append(
        renderInRouteBanner(state, {
          onEnd: () => setState({ screen: "search", detent: "peek", offRoute: false }),
          onReroute: () => {
            if (live && state.start && state.end && offPoint) {
              void routeBetween(state.start, state.end, offPoint);
              return;
            }
            setState({ offRoute: false });
          },
        }),
      );
      body.append(
        renderInRouteContent(state, {
          onEnd: () => setState({ screen: "search", detent: "peek", offRoute: false }),
          onReroute: () => {
            if (live && state.start && state.end && offPoint) {
              void routeBetween(state.start, state.end, offPoint);
              return;
            }
            setState({ offRoute: false });
          },
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
            if (!live) {
              setState({ slot, departureIsNow: false, routes: applySegmentsForSlot(state.routes, slot) });
              return;
            }
            setState({ slot, departureIsNow: false });
            if (state.start && state.end) void routeBetween(state.start, state.end);
          },
          onSnapNow: () => {
            const nowSlot = snapToNowSlot(live ? manilaNowMinutes() : 12 * 60);
            if (!live) {
              setState({
                slot: nowSlot,
                departureIsNow: true,
                routes: applySegmentsForSlot(state.routes, nowSlot),
              });
              return;
            }
            setState({ slot: nowSlot, departureIsNow: true });
            if (state.start && state.end) void routeBetween(state.start, state.end);
          },
          onStart: () => {
            const selected = state.routes.find((route) => route.weight === state.selectedWeight);
            setState({
              screen: "in-route",
              detent: "peek",
              minutesRemaining: selected?.totalMinutes ?? state.minutesRemaining,
              sunMinutesRemaining: selected?.sunMinutes ?? state.sunMinutesRemaining,
              navigationLine: selected ? lineFor(state.end?.name ?? "", selected.distanceM) : state.navigationLine,
            });
          },
          onTryAgain: () => {
            if (live && state.status === "tile-failed") {
              window.location.reload();
              return;
            }
            setState({ status: "normal" });
          },
        }),
      );
      return;
    }

    body.append(
      renderSearchContent(state, {
        onQuery: (query) => setState({ query }),
        onPick: (place) => {
          if (live) choose(place);
        },
        onDestination: (label) => {
          if (!live) {
            setState({ screen: "compare", detent: "half" });
            map.setEndMarker([121.05, 14.55]);
            return;
          }
          const place = state.places.find((item) => item.name.toLowerCase() === label.trim().toLowerCase());
          if (place) choose(place);
        },
        onLeaveNow: () =>
          setState({
            timePickerOpen: !state.timePickerOpen,
            departureIsNow: true,
            slot: snapToNowSlot(manilaNowMinutes()),
          }),
        onSlotChange: (slot) => {
          if (!isSlotIndex(slot)) return;
          setState({ slot, departureIsNow: false });
        },
        onSnapNow: () => setState({ slot: snapToNowSlot(manilaNowMinutes()), departureIsNow: true }),
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

  function lineFor(name: string, distanceM: number): string {
    const meters = `${Math.round(distanceM)} m`;
    if (!name || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(name)) return meters;
    return `${name} · ${meters}`;
  }

  function inside(pilot: PilotData, point: LngLat): boolean {
    const [west, south, east, north] = pilot.manifest.bbox;
    return point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
  }

  function choose(place: PlacePick): void {
    const pilot = livePilot;
    if (!pilot) return;
    if (!inside(pilot, place.at)) {
      map.setPilotBox(true);
      setState({ status: "outside-pilot", screen: "compare", detent: "half" });
      return;
    }
    map.setPilotBox(false);
    if (!state.start) {
      map.setStartMarker(place.at);
      setState({ start: place, query: "", status: "normal", screen: "search", detent: "half" });
      return;
    }
    map.setEndMarker(place.at);
    const loading = state.routes.length === 0;
    const start = state.start;
    setState({
      end: place,
      query: "",
      screen: "compare",
      detent: "half",
      status: loading ? "loading-tiles" : "normal",
    });
    void routeBetween(start, place);
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
        setState({ status: "no-route", routes: [], screen: "compare", detent: "half" });
        return;
      }
      const sun = shadeModel.sunPosition(departure, origin);
      const night = sun.elevationDeg <= 0;
      const selectedWeight = night ? "fastest" : state.status === "night" ? "shadiest" : state.selectedWeight;
      const picked = cards.find((card) => card.weight === selectedWeight) ?? cards[0];
      if (!picked) return;
      const screen = state.screen === "in-route" ? "in-route" : "compare";
      setState({
        status: night ? "night" : "normal",
        routes: cards,
        selectedWeight: picked.weight,
        screen,
        detent: screen === "in-route" ? state.detent : "half",
        minutesRemaining: picked.totalMinutes,
        sunMinutesRemaining: picked.sunMinutes,
        navigationLine: lineFor(end.name, picked.distanceM),
        offRoute: false,
        recents: [end.name, ...state.recents.filter((name) => name !== end.name)].slice(0, 4),
      });
      document.documentElement.dataset.route = "ready";
    } catch {
      if (generation !== routeGeneration) return;
      setState({ status: "tile-failed", screen: "compare", detent: "half" });
    }
  }

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
            choose({ name: `${at[1].toFixed(5)}, ${at[0].toFixed(5)}`, at: [at[0], at[1]] });
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
        if (state.screen === "in-route") {
          offPoint = position;
          setState({ offRoute: true });
          return;
        }
        choose({ name: `${position[1].toFixed(5)}, ${position[0].toFixed(5)}`, at: position });
      });
    });
  }

  return { getState: () => state, setState };
}
