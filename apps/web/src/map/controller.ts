import { ATTRIBUTION, isSlotIndex, slotStartMinutes, type LngLat, type RouteWeight, type SlotIndex } from "@shadeway/contract";
import { shadeModel } from "@shadeway/shade-model";
import { runDemo } from "./demo";
import { loadPilot, PilotDataMissing, type PilotData } from "./pilot";
import {
  buildingsNearRoute,
  paintRoute,
  pointAlong,
  routeBounds,
  shadowDraws,
  type RouteDraw,
} from "./scene";
import { createMapLibreView, type CameraMove, type MapView } from "./view";
import { COPY } from "../ui/copy";

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
  setSlot(slot: SlotIndex): void;
  fitRoute(): void;
  followPosition(enabled: boolean): void;
  setFollowFraction(fraction: number): void;
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

  let slot: SlotIndex = 12;
  let pilot: PilotData | null = options.pilot ?? null;
  let activeWeight: RouteWeight = "shadiest";
  const stored = new Map<RouteWeight, readonly LngLat[]>();
  let following = false;
  let followFraction = 0;
  let start: LngLat | null = null;
  let end: LngLat | null = null;

  const attribution = document.createElement("div");
  attribution.className = "shadeway-attribution";
  let attributionLines: readonly string[] = ATTRIBUTION;
  const paintAttribution = () => renderAttribution(attribution, attributionLines);
  paintAttribution();
  window.matchMedia("(max-width: 720px)").addEventListener("change", paintAttribution);
  const message = document.createElement("div");
  message.className = "shadeway-map-message";
  message.hidden = true;
  root.append(attribution, message);
  root.append(styleElement());
  watchSheet(attribution, () => {
    if (!following) moveCamera(true);
  });

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
      const changed = following !== enabled;
      following = enabled;
      if (!enabled) followFraction = 0;
      if (changed) moveCamera(false);
    },
    setFollowFraction(fraction) {
      followFraction = Math.min(1, Math.max(0, fraction));
      if (following) moveCamera(false);
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
    attributionLines = pilot.attribution;
    paintAttribution();
    view.setRoads(pilot.roads);
    view.setLand(pilot.land);
    view.setLabels(spacedLabels(pilot.places));
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
    view.setScene({ shadows, route });
  }

  function moveCamera(fit: boolean): void {
    const coordinates = stored.get(activeWeight) ?? [];
    const overview = overviewCamera();
    if (following && coordinates.length >= 2) {
      const along = pointAlong(coordinates, followFraction);
      if (!along) return;
      const camera: CameraMove = { center: along.at, bearing: along.bearing, pitch: 0, zoom: 16.6 };
      view.ease(camera, motionMs());
      return;
    }
    if (fit) {
      const bounds = routeBounds(coordinates);
      if (!bounds) return;
      view.fit(bounds, sheetPadding(), frameCamera(coordinates), motionMs());
      return;
    }
    view.ease(overview, motionMs());
  }
}

export function createNoopMapController(): MapController {
  return {
    setRoute() {},
    setSlot() {},
    fitRoute() {},
    followPosition() {},
    setFollowFraction() {},
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

function spacedLabels(places: PilotData["places"]): { name: string; at: LngLat }[] {
  const ranked = [...places].sort((a, b) => labelRank(a.name) - labelRank(b.name) || a.name.localeCompare(b.name));
  const picked: { name: string; at: LngLat }[] = [];
  for (const place of ranked) {
    if (picked.some((kept) => labelNear(kept.at, place.at))) continue;
    picked.push({ name: place.name, at: place.at });
    if (picked.length >= 14) break;
  }
  return picked;
}

function labelRank(name: string): number {
  const key = name.toLowerCase();
  if (key === "bonifacio high street") return 0;
  if (key === "market! market!") return 1;
  return 2;
}

function labelNear(a: LngLat, b: LngLat): boolean {
  const dx = (a[0] - b[0]) * Math.cos((14.55 * Math.PI) / 180);
  const dy = a[1] - b[1];
  return dx * dx + dy * dy < 0.0007 * 0.0007;
}

function overviewCamera(): CameraMove {
  return { center: BGC, zoom: 15.2, pitch: 0, bearing: 0 };
}

function frameCamera(_coordinates: readonly LngLat[]): CameraMove {
  return { pitch: 0, bearing: 0 };
}

function motionMs(): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350;
}

function sheetPadding(): { top: number; right: number; bottom: number; left: number } {
  const sheet = document.querySelector(".shadeway-sheet");
  if (!(sheet instanceof HTMLElement)) return { top: 72, right: 28, bottom: 120, left: 28 };
  const rect = sheet.getBoundingClientRect();
  const floating = rect.width < window.innerWidth - 48;
  if (floating) return { top: 72, right: 28, bottom: 24, left: Math.round(rect.right + 16) };
  return { top: 72, right: 28, bottom: Math.round(rect.height + 24), left: 28 };
}

function renderAttribution(host: HTMLElement, lines: readonly string[]): void {
  const narrow = window.matchMedia("(max-width: 720px)").matches;
  host.replaceChildren();
  if (!narrow) {
    host.textContent = lines.join(" · ");
    return;
  }
  const line = document.createElement("span");
  line.textContent = COPY.attributionShort;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shadeway-attribution__info";
  button.textContent = "i";
  button.setAttribute("aria-label", COPY.sources);
  button.setAttribute("aria-expanded", "false");
  const full = document.createElement("p");
  full.className = "shadeway-attribution__full";
  full.hidden = true;
  full.textContent = lines.join(" · ");
  button.addEventListener("click", () => {
    full.hidden = !full.hidden;
    button.setAttribute("aria-expanded", full.hidden ? "false" : "true");
  });
  host.append(line, button, full);
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

function watchSheet(attribution: HTMLElement, onDetent: () => void): void {
  const place = () => {
    const sheet = document.querySelector(".shadeway-sheet");
    const height = sheet instanceof HTMLElement ? sheet.getBoundingClientRect().height : 0;
    const floating = sheet instanceof HTMLElement && sheet.getBoundingClientRect().width < window.innerWidth - 48;
    const rect = sheet instanceof HTMLElement ? sheet.getBoundingClientRect() : null;
    attribution.style.bottom = floating || !rect ? "16px" : `${Math.round(height + 10)}px`;
    attribution.style.left = floating && rect ? `${Math.round(rect.right + 12)}px` : "10px";
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
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: min(420px, 70vw);
  margin: 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #5b6570;
  font: 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif;
  pointer-events: none;
}
@media (max-width: 720px) {
  .shadeway-attribution {
    max-width: min(280px, calc(100vw - 24px));
    font-size: 12px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .shadeway-attribution__info {
    pointer-events: auto;
    width: 44px;
    height: 44px;
    margin: -10px -6px -10px 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: 600 15px/44px system-ui, -apple-system, 'Segoe UI', sans-serif;
    cursor: pointer;
  }
  .shadeway-attribution__full {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    width: min(280px, 70vw);
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.94);
    color: #14202b;
    font: 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif;
    white-space: normal;
    pointer-events: none;
  }
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
  font: 17px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
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
.shadeway-place-label {
  font: 600 12px/1.2 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #14202b;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: -1px 0 #fff, 1px 0 #fff, 0 -1px #fff, 0 1px #fff, 0 0 3px #fff;
}
@media (prefers-color-scheme: dark) {
  .shadeway-attribution, .shadeway-map-message, .shadeway-attribution__full {
    background: rgba(28, 32, 38, 0.92);
    color: #f5f7fa;
  }
  .shadeway-place-label {
    color: #f5f7fa;
    text-shadow: -1px 0 #14181d, 1px 0 #14181d, 0 -1px #14181d, 0 1px #14181d, 0 0 3px #14181d;
  }
}
`;
