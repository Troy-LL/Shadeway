import { ATTRIBUTION, isSlotIndex, slotStartMinutes, type LngLat, type RouteWeight, type SlotIndex } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { runDemo } from "./demo";
import { loadPilot, PilotDataMissing, type PilotData } from "./pilot";
import {
  buildingsNearRoute,
  offsetBehind,
  paintRoute,
  pointAlong,
  routeBounds,
  shadowDraws,
  sunLightDirection,
  type RouteDraw,
} from "./scene";
import { createMapLibreView, type CameraMove, type MapView } from "./view";

export type MapViewMode = "2d" | "3d";

export interface RouteGeometry {
  readonly weight: RouteWeight;
  readonly coordinates: readonly LngLat[];
}

/**
 * What Track 5 calls. `setRoute` with an empty coordinate list keeps the
 * geometry already stored for that weight: the sheet sends the weight before
 * it has a line.
 */
export interface MapController {
  setRoute(route: RouteGeometry | null): void;
  setViewMode(mode: MapViewMode): void;
  setSlot(slot: SlotIndex): void;
  fitRoute(): void;
  followPosition(enabled: boolean): void;
  setStartMarker(position: LngLat | null): void;
  setEndMarker(position: LngLat | null): void;
  setPilotBox(visible: boolean): void;
  whenReady(): Promise<PilotData | null>;
  subscribeMapTap(listener: (position: LngLat) => void): () => void;
}

export interface MapControllerOptions {
  readonly dataUrl?: string;
  readonly fetch?: typeof fetch;
  readonly date?: string;
  readonly demo?: boolean;
  readonly pilot?: PilotData;
  readonly createView?: (root: HTMLElement) => MapView;
}

const VIEW_KEY = "shadeway-view";
export const MAP_SUN_DATE = "2026-10-26";
const BGC: LngLat = [121.051, 14.5522];
const EMPTY_ROUTE: RouteDraw = { sunny: [], shaded: [], ticks: [] };

export function createMapController(root: HTMLElement, options: MapControllerOptions = {}): MapController {
  const date = options.date ?? MAP_SUN_DATE;
  let resolveReady: (value: PilotData | null) => void = () => {};
  const ready = new Promise<PilotData | null>((resolve) => {
    resolveReady = resolve;
  });
  const view = (options.createView ?? createMapLibreView)(mountCanvas(root));
  const taps = new Set<(position: LngLat) => void>();
  view.onTap((position) => {
    for (const listener of taps) listener(position);
  });

  let mode = initialMode();
  let slot: SlotIndex = 12;
  let pilot: PilotData | null = options.pilot ?? null;
  let activeWeight: RouteWeight = "shadiest";
  const stored = new Map<RouteWeight, readonly LngLat[]>();
  let following = false;
  let start: LngLat | null = null;
  let end: LngLat | null = null;

  const attribution = document.createElement("p");
  attribution.className = "shadeway-attribution";
  attribution.textContent = ATTRIBUTION.join(" · ");
  const toggle = renderToggle(mode, (next) => controller.setViewMode(next));
  const message = document.createElement("div");
  message.className = "shadeway-map-message";
  message.hidden = true;
  root.append(attribution, toggle, message);
  root.append(styleElement());
  watchSheet(attribution, () => {
    if (!following) moveCamera(true);
  });
  if (!webglAvailable() && !options.createView) {
    mode = "2d";
    toggle.hidden = true;
  }

  const controller: MapController = {
    setRoute(route) {
      if (!route) {
        stored.clear();
        draw();
        return;
      }
      activeWeight = route.weight;
      if (route.coordinates.length >= 2) stored.set(route.weight, route.coordinates);
      draw();
    },
    setViewMode(next) {
      mode = next;
      persistMode(next);
      updateToggle(toggle, next);
      moveCamera((stored.get(activeWeight)?.length ?? 0) >= 2);
      draw();
    },
    setSlot(next) {
      if (!isSlotIndex(next)) return;
      slot = next;
      draw();
      if (following) moveCamera(false);
    },
    fitRoute() {
      following = false;
      moveCamera(true);
    },
    followPosition(enabled) {
      following = enabled;
      toggle.style.top = enabled ? "76px" : "12px";
      moveCamera(false);
    },
    setStartMarker(position) {
      start = position;
      view.setMarkers(start, end);
    },
    setEndMarker(position) {
      end = position;
      view.setMarkers(start, end);
    },
    setPilotBox(visible) {
      if (!visible || !pilot) {
        view.setOutline(null);
        return;
      }
      const [west, south, east, north] = pilot.manifest.bbox;
      view.setOutline([
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ]);
    },
    whenReady() {
      return ready;
    },
    subscribeMapTap(listener) {
      taps.add(listener);
      return () => taps.delete(listener);
    },
  };

  void boot();
  return controller;

  async function boot(): Promise<void> {
    try {
      pilot ??= await loadPilot(options.dataUrl ?? "/data/bgc/", options.fetch ?? fetch);
    } catch (error) {
      showMissing(message, error);
      resolveReady(null);
      return;
    }
    attribution.textContent = pilot.attribution.join(" · ");
    view.setRoads(pilot.roads);
    draw();
    moveCamera(false);
    resolveReady(pilot);
    if (options.demo) {
      try {
        await runDemo(controller, pilot, slot);
      } catch (error) {
        showMissing(message, error);
      }
    }
  }

  function draw(): void {
    if (!pilot) return;
    const coordinates = stored.get(activeWeight) ?? [];
    const sun = shadeModel.sunPosition({ date, minutes: slotStartMinutes(slot) }, BGC);
    const near = coordinates.length >= 2 ? buildingsNearRoute(pilot.buildings, coordinates, 280) : [];
    const shadows = shadowDraws(near, sun);
    const route = coordinates.length >= 2 ? paintRoute(coordinates, pilot.graph.edges, shadows) : EMPTY_ROUTE;
    view.setDeck({
      buildings: pilot.buildings,
      extruded: mode === "3d",
      shadows,
      route,
      light: sunLightDirection(sun),
    });
  }

  function moveCamera(fit: boolean): void {
    const coordinates = stored.get(activeWeight) ?? [];
    const overview = overviewCamera(mode);
    if (following && coordinates.length >= 2) {
      const along = pointAlong(coordinates, 0.42);
      if (!along) return;
      const camera: CameraMove =
        mode === "3d"
          ? { center: offsetBehind(along.at, along.bearing, 70), bearing: along.bearing, pitch: 46, zoom: 16.8 }
          : { center: along.at, bearing: along.bearing, pitch: 0, zoom: 16.6 };
      view.ease(camera, motionMs());
      return;
    }
    if (fit) {
      const bounds = routeBounds(coordinates);
      if (!bounds) return;
      view.fit(bounds, sheetPadding(), frameCamera(mode, coordinates), motionMs());
      return;
    }
    view.ease(overview, motionMs());
  }
}

export function createNoopMapController(): MapController {
  return {
    setRoute() {},
    setViewMode() {},
    setSlot() {},
    fitRoute() {},
    followPosition() {},
    setStartMarker() {},
    setEndMarker() {},
    setPilotBox() {},
    whenReady() {
      return Promise.resolve(null);
    },
    subscribeMapTap() {
      return () => {};
    },
  };
}

function overviewCamera(mode: MapViewMode): CameraMove {
  if (mode === "2d") return { center: BGC, zoom: 15.2, pitch: 0, bearing: 0 };
  return { center: BGC, zoom: 15.6, pitch: 38, bearing: -28 };
}

function frameCamera(mode: MapViewMode, coordinates: readonly LngLat[]): CameraMove {
  if (mode === "2d") return { pitch: 0, bearing: 0 };
  const along = pointAlong(coordinates, 0.5)?.bearing ?? -28;
  return { pitch: 32, bearing: along - 55 };
}

function initialMode(): MapViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "2d" ? "2d" : "3d";
  } catch {
    return "3d";
  }
}

function persistMode(mode: MapViewMode): void {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    // Private mode can reject storage. The toggle still works for this visit.
  }
}

function motionMs(): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function sheetPadding(): { top: number; right: number; bottom: number; left: number } {
  const sheet = document.querySelector(".shadeway-sheet");
  const bottom = sheet instanceof HTMLElement ? Math.round(sheet.getBoundingClientRect().height + 24) : 120;
  return { top: 72, right: 28, bottom, left: 28 };
}

function mountCanvas(root: HTMLElement): HTMLElement {
  const canvas = document.createElement("div");
  canvas.className = "shadeway-map-canvas";
  root.append(canvas);
  return canvas;
}

function showMissing(message: HTMLElement, error: unknown): void {
  message.hidden = false;
  const missing = error instanceof PilotDataMissing || (error instanceof Error && error.message.includes("build:pilot"));
  const command = document.createElement("code");
  command.textContent = "pnpm --filter @shadeway/pipeline build:pilot";
  message.replaceChildren();
  const title = document.createElement("p");
  title.textContent = missing ? "Pilot data is not built." : "Could not load shade";
  const hint = document.createElement("p");
  if (missing) hint.append(command);
  else hint.textContent = error instanceof Error ? error.message : "Could not load shade";
  message.append(title, hint);
}

function renderToggle(mode: MapViewMode, onChange: (mode: MapViewMode) => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "shadeway-view-toggle";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Map view");
  for (const value of ["3d", "2d"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value === "3d" ? "3D" : "2D";
    button.dataset.mode = value;
    button.setAttribute("aria-pressed", value === mode ? "true" : "false");
    button.addEventListener("click", () => onChange(value));
    bar.append(button);
  }
  return bar;
}

function updateToggle(bar: HTMLElement, mode: MapViewMode): void {
  for (const button of bar.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", button.dataset.mode === mode ? "true" : "false");
  }
}

function watchSheet(attribution: HTMLElement, onDetent: () => void): void {
  const place = () => {
    const sheet = document.querySelector(".shadeway-sheet");
    const height = sheet instanceof HTMLElement ? sheet.getBoundingClientRect().height : 0;
    attribution.style.bottom = `${Math.round(height + 10)}px`;
  };
  const seen = new WeakSet<HTMLElement>();
  const attach = () => {
    const sheet = document.querySelector(".shadeway-sheet");
    if (!(sheet instanceof HTMLElement) || seen.has(sheet)) {
      place();
      return;
    }
    seen.add(sheet);
    new ResizeObserver(place).observe(sheet);
    new MutationObserver(() => {
      place();
      onDetent();
    }).observe(sheet, { attributes: true, attributeFilter: ["data-detent"] });
    place();
  };
  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
}

function styleElement(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = MAP_CSS;
  return style;
}

const MAP_CSS = `
.shadeway-map-canvas { position: absolute; inset: 0; }
.shadeway-map-canvas .maplibregl-map { height: 100%; }
.shadeway-attribution {
  position: absolute;
  left: 10px;
  z-index: 3;
  max-width: min(420px, 70vw);
  margin: 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #5b6570;
  font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: none;
}
.shadeway-view-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  display: flex;
  height: 44px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 4px rgba(20, 32, 43, 0.18);
}
.shadeway-view-toggle button {
  min-width: 52px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: #14202b;
  font: 600 15px/44px system-ui, -apple-system, "Segoe UI", sans-serif;
  cursor: pointer;
}
.shadeway-view-toggle button[aria-pressed="true"] {
  background: #0a84ff;
  color: #fff;
}
.shadeway-map-message {
  position: absolute;
  left: 50%;
  top: 28%;
  z-index: 4;
  transform: translateX(-50%);
  width: min(420px, calc(100% - 32px));
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: #111418;
  font: 17px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.shadeway-map-message code {
  font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.shadeway-marker {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(20, 32, 43, 0.35);
}
.shadeway-marker--start { background: #14202b; }
.shadeway-marker--end { background: #0a84ff; }
@media (prefers-color-scheme: dark) {
  .shadeway-attribution, .shadeway-map-message, .shadeway-view-toggle {
    background: rgba(28, 32, 38, 0.92);
    color: #f5f7fa;
  }
  .shadeway-view-toggle button { color: #f5f7fa; }
  .shadeway-view-toggle button[aria-pressed="true"] { color: #fff; }
}
`;
