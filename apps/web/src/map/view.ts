import type { LngLat } from "@shadeway/contract";
import { GeoJSONSource, Map, Marker, setWorkerUrl, type EaseToOptions } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(maplibreWorkerUrl);
import type { RouteDraw, ShadowDraw } from "./scene";

const SHADOW = [20, 32, 43, 255] as const;
const SHADOW_DARK = [0, 0, 0, 255] as const;
const EDGE = [20, 32, 43, 255] as const;
const EDGE_DARK = [255, 255, 255, 255] as const;
const EDGE_EST = [20, 32, 43, 255] as const;
const EDGE_EST_DARK = [255, 255, 255, 255] as const;
const SUN_LINE = [245, 165, 36, 255] as const;
const SUN_LINE_DARK = [255, 184, 77, 255] as const;
const SHADE_LINE = [31, 122, 140, 255] as const;
const SHADE_LINE_DARK = [58, 160, 179, 255] as const;
const CASING_LIGHT = [20, 32, 43, 255] as const;
const CASING_DARK = [255, 255, 255, 255] as const;
const INACTIVE_LIGHT = [122, 131, 140, 255] as const;
const INACTIVE_DARK = [163, 172, 182, 255] as const;
const INACTIVE_CASING_DARK = [20, 24, 29, 255] as const;
const BUILDING_LIGHT = [228, 222, 211, 255] as const;
const BUILDING_DARK = [34, 39, 46, 255] as const;
const TICK = SHADE_LINE;

export interface CameraMove {
  readonly pitch: number;
  readonly bearing: number;
  readonly center?: LngLat;
  readonly zoom?: number;
}

export interface MapScene {
  readonly shadows: readonly ShadowDraw[];
  readonly route: RouteDraw;
  readonly inactiveLine: readonly LngLat[];
  readonly buildingFootprints: readonly (readonly LngLat[])[];
  readonly showShadowFill: boolean;
}

export interface MapLayerDiagnostics {
  readonly pitch: number;
  readonly bearing: number;
  readonly layerVisibility: Readonly<Record<string, string>>;
  readonly symbolLayerIds: readonly string[];
}

export interface MapView {
  setRoads(roads: readonly (readonly LngLat[])[]): void;
  setLand(areas: readonly { kind: "park" | "water"; ring: readonly LngLat[] }[]): void;
  setScene(scene: MapScene): void;
  ease(camera: CameraMove, durationMs: number): void;
  fit(
    bounds: readonly [number, number, number, number],
    padding: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number },
    camera: CameraMove,
    durationMs: number,
  ): void;
  setMarkers(
    start: LngLat | null,
    end: LngLat | null,
    labels?: { readonly startLabel?: string; readonly endLabel?: string },
  ): void;
  setOutline(ring: readonly LngLat[] | null): void;
  setPilotVeil(bbox: readonly [number, number, number, number] | null): void;
  setRouteMidpointLabels(labels: readonly { readonly text: string; readonly at: LngLat }[]): void;
  onTap(listener: (position: LngLat) => void): void;
  mapDiagnostics(): MapLayerDiagnostics | null;
}

export function shadowLayerVisibility(showShadowFill: boolean): Readonly<Record<string, "visible" | "none">> {
  return {
    shadows: showShadowFill ? "visible" : "none",
    "shadow-edge": "none",
    "shadow-edge-estimated": showShadowFill ? "visible" : "none",
  };
}

const SCENE_SOURCES = [
  "buildings",
  "shadows",
  "shadow-edge",
  "shadow-edge-estimated",
  "route-inactive-casing",
  "route-inactive",
  "route-casing",
  "route-sun",
  "route-shade-casing",
  "route-shade",
  "route-ticks",
] as const;

export function createMapLibreView(root: HTMLElement): MapView {
  const map = new Map({
    container: root,
    style: {
      version: 8,
      sources: {},
      layers: [{ id: "land", type: "background", paint: { "background-color": "#F3EFE8" } }],
    },
    center: [121.051, 14.5522],
    zoom: 15.2,
    pitch: 0,
    bearing: 0,
    attributionControl: false,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    fadeDuration: 0,
  });
  baseMap = map;
  let loaded = false;
  const queue: Array<() => void> = [];
  const whenLoaded = (job: () => void) => {
    if (loaded) job();
    else queue.push(job);
  };
  map.once("load", () => {
    map.addSource("parks", { type: "geojson", data: emptyCollection() });
    map.addSource("water", { type: "geojson", data: emptyCollection() });
    map.addSource("roads", { type: "geojson", data: emptyCollection() });
    map.addSource("outline", { type: "geojson", data: emptyCollection() });
    map.addSource("pilot-veil", { type: "geojson", data: emptyCollection() });
    for (const id of SCENE_SOURCES) {
      map.addSource(id, { type: "geojson", data: emptyCollection() });
    }
    map.addLayer({
      id: "pilot-veil",
      type: "fill",
      source: "pilot-veil",
      paint: { "fill-color": "#F3EFE8", "fill-opacity": 0.6 },
      layout: { visibility: "none" },
    });
    map.addLayer({
      id: "parks",
      type: "fill",
      source: "parks",
      paint: { "fill-color": "#D5E4CF" },
    });
    map.addLayer({
      id: "water",
      type: "fill",
      source: "water",
      paint: { "fill-color": "#C5D8EA" },
    });
    map.addLayer({
      id: "roads-casing",
      type: "line",
      source: "roads",
      paint: { "line-color": "#D9D3C7", "line-width": 5 },
    });
    map.addLayer({
      id: "roads",
      type: "line",
      source: "roads",
      paint: { "line-color": "#FFFFFF", "line-width": 2.5 },
    });
    map.addLayer({
      id: "outline",
      type: "line",
      source: "outline",
      paint: { "line-color": "#0A84FF", "line-width": 2, "line-dasharray": [1.5, 1.2] },
    });
    map.addLayer({
      id: "buildings",
      type: "fill",
      source: "buildings",
      paint: { "fill-color": rgba(BUILDING_LIGHT), "fill-opacity": 1 },
    });
    map.addLayer({
      id: "shadows",
      type: "fill",
      source: "shadows",
      paint: { "fill-color": rgba(SHADOW), "fill-opacity": 0.18 },
    });
    map.addLayer({
      id: "shadow-edge",
      type: "line",
      source: "shadow-edge",
      paint: { "line-color": rgba(EDGE), "line-width": 1 },
    });
    map.addLayer({
      id: "shadow-edge-estimated",
      type: "line",
      source: "shadow-edge-estimated",
      paint: { "line-color": rgba(EDGE_EST), "line-width": 1, "line-dasharray": [3, 2] },
    });
    map.addLayer({
      id: "route-inactive-casing",
      type: "line",
      source: "route-inactive",
      layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
      paint: { "line-color": rgba(INACTIVE_CASING_DARK), "line-width": 7 },
    });
    map.addLayer({
      id: "route-inactive",
      type: "line",
      source: "route-inactive",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(INACTIVE_LIGHT), "line-width": 4 },
    });
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route-casing",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(CASING_LIGHT), "line-width": 11 },
    });
    map.addLayer({
      id: "route-sun",
      type: "line",
      source: "route-sun",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(SUN_LINE), "line-width": 8 },
    });
    map.addLayer({
      id: "route-shade-casing",
      type: "line",
      source: "route-shade-casing",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(CASING_LIGHT), "line-width": 8 },
    });
    map.addLayer({
      id: "route-shade",
      type: "line",
      source: "route-shade",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(SHADE_LINE), "line-width": 5 },
    });
    map.addLayer({
      id: "route-ticks",
      type: "line",
      source: "route-ticks",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(TICK), "line-width": 3 },
    });
    paintBase();
    paintSceneColors();
    loaded = true;
    for (const job of queue) job();
    queue.length = 0;
    map.resize();
  });

  let startMarker: Marker | null = null;
  let endMarker: Marker | null = null;
  let midpointMarkers: Marker[] = [];
  let lastScene: MapScene | null = null;
  const theme = window.matchMedia("(prefers-color-scheme: dark)");
  const repaint = () => {
    paintBase();
    paintSceneColors();
    if (lastScene) applyScene(lastScene);
  };
  theme.addEventListener("change", repaint);

  const view: MapView = {
    setLand(areas) {
      const parks = areas.filter((area) => area.kind === "park").map((area) => area.ring);
      const water = areas.filter((area) => area.kind === "water").map((area) => area.ring);
      whenLoaded(() => {
        const parkSource = map.getSource("parks");
        if (isGeoJsonSource(parkSource)) parkSource.setData(ringsCollection(parks));
        const waterSource = map.getSource("water");
        if (isGeoJsonSource(waterSource)) waterSource.setData(ringsCollection(water));
      });
    },
    setRoads(roads) {
      const data = {
        type: "FeatureCollection" as const,
        features: roads.map((coordinates) => ({
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: positions(coordinates) },
        })),
      };
      whenLoaded(() => {
        const source = map.getSource("roads");
        if (isGeoJsonSource(source)) source.setData(data);
      });
    },
    setScene(scene) {
      lastScene = scene;
      whenLoaded(() => applyScene(scene));
    },
    ease(camera, durationMs) {
      whenLoaded(() => map.easeTo(easeOptions(camera, durationMs)));
    },
    fit(bounds, padding, camera, durationMs) {
      whenLoaded(() =>
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          {
            padding,
            duration: durationMs,
            pitch: 0,
            bearing: camera.bearing,
            maxZoom: 17,
          },
        ),
      );
    },
    setMarkers(start, end, labels) {
      startMarker = placeMarker(map, startMarker, start, "start", labels?.startLabel);
      endMarker = placeMarker(map, endMarker, end, "end", labels?.endLabel);
    },
    setPilotVeil(bbox) {
      const data =
        bbox === null
          ? emptyCollection()
          : ringsCollection(veilOutsideBbox(bbox));
      whenLoaded(() => {
        const source = map.getSource("pilot-veil");
        if (isGeoJsonSource(source)) source.setData(data);
        if (map.getLayer("pilot-veil")) {
          map.setLayoutProperty("pilot-veil", "visibility", bbox === null ? "none" : "visible");
        }
        paintPilotVeil();
      });
    },
    setRouteMidpointLabels(labels) {
      whenLoaded(() => {
        for (const marker of midpointMarkers) marker.remove();
        midpointMarkers = labels.map((label) => {
          const element = document.createElement("div");
          element.className = "shadeway-route-tag";
          element.textContent = label.text;
          return new Marker({ element, anchor: "center" }).setLngLat([label.at[0], label.at[1]]).addTo(map);
        });
      });
    },
    setOutline(ring) {
      const data =
        ring && ring.length >= 2
          ? {
              type: "FeatureCollection" as const,
              features: [
                {
                  type: "Feature" as const,
                  properties: {},
                  geometry: { type: "LineString" as const, coordinates: positions(ring) },
                },
              ],
            }
          : emptyCollection();
      whenLoaded(() => {
        const source = map.getSource("outline");
        if (isGeoJsonSource(source)) source.setData(data);
      });
    },
    onTap(listener) {
      map.on("click", (event) => listener([event.lngLat.lng, event.lngLat.lat]));
    },
    mapDiagnostics() {
      return readMapDiagnostics(map);
    },
  };
  return view;
}

const SHADOW_LAYERS = ["shadows", "shadow-edge", "shadow-edge-estimated"] as const;

function veilOutsideBbox(bbox: readonly [number, number, number, number]): (readonly LngLat[])[] {
  const [w, s, e, n] = bbox;
  const west = w - 0.15;
  const east = e + 0.15;
  const south = s - 0.15;
  const north = n + 0.15;
  const ring = (coords: LngLat[]) => [...coords, coords[0]!];
  return [
    ring([
      [west, north],
      [east, north],
      [east, 90],
      [west, 90],
    ]),
    ring([
      [west, -90],
      [east, -90],
      [east, south],
      [west, south],
    ]),
    ring([
      [west, south],
      [w, south],
      [w, north],
      [west, north],
    ]),
    ring([
      [e, south],
      [east, south],
      [east, north],
      [e, north],
    ]),
  ];
}

function readMapDiagnostics(map: Map): MapLayerDiagnostics | null {
  const style = map.getStyle();
  if (!style) return null;
  const layerVisibility: Record<string, string> = {};
  for (const id of SHADOW_LAYERS) {
    if (!map.getLayer(id)) continue;
    const visibility = map.getLayoutProperty(id, "visibility");
    layerVisibility[id] = visibility === "none" ? "none" : "visible";
  }
  const symbolLayerIds = style.layers.filter((layer) => layer.type === "symbol").map((layer) => layer.id);
  return {
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    layerVisibility,
    symbolLayerIds,
  };
}

function applyScene(scene: MapScene): void {
  const map = baseMap;
  if (!map) return;
  const estimated = scene.shadows.filter((shadow) => shadow.estimated);
  const measured = scene.shadows.filter((shadow) => !shadow.estimated);
  setSourceData(map, "shadows", ringsCollection(scene.shadows.map((shadow) => shadow.ring)));
  setSourceData(map, "shadow-edge", linesCollection(measured.map((shadow) => shadow.ring)));
  setSourceData(map, "shadow-edge-estimated", linesCollection(estimated.map((shadow) => shadow.ring)));
  setSourceData(map, "buildings", ringsCollection(scene.buildingFootprints));
  const inactive =
    scene.inactiveLine.length >= 2 ? linesCollection([scene.inactiveLine]) : emptyCollection();
  setSourceData(map, "route-inactive", inactive);
  setSourceData(map, "route-casing", linesCollection([...scene.route.sunny, ...scene.route.shaded]));
  setSourceData(map, "route-sun", linesCollection(scene.route.sunny));
  setSourceData(map, "route-shade-casing", linesCollection(scene.route.shaded));
  setSourceData(map, "route-shade", linesCollection(scene.route.shaded));
  setSourceData(map, "route-ticks", linesCollection(scene.route.ticks));
  const visibility = shadowLayerVisibility(scene.showShadowFill);
  for (const [id, state] of Object.entries(visibility)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", state);
  }
}

type GeoJsonData = ReturnType<typeof ringsCollection> | ReturnType<typeof linesCollection> | ReturnType<typeof emptyCollection>;

function setSourceData(map: Map, id: string, data: GeoJsonData): void {
  const source = map.getSource(id);
  if (isGeoJsonSource(source)) source.setData(data);
}

function palette() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    dark,
    shadow: dark ? SHADOW_DARK : SHADOW,
    edge: dark ? EDGE_DARK : EDGE,
    edgeEst: dark ? EDGE_EST_DARK : EDGE_EST,
    sun: dark ? SUN_LINE_DARK : SUN_LINE,
    shade: dark ? SHADE_LINE_DARK : SHADE_LINE,
    building: dark ? BUILDING_DARK : BUILDING_LIGHT,
    casing: dark ? CASING_DARK : CASING_LIGHT,
    inactive: dark ? INACTIVE_DARK : INACTIVE_LIGHT,
    land: dark ? "#14181d" : "#F3EFE8",
    park: dark ? "#243028" : "#D5E4CF",
    water: dark ? "#1C3344" : "#C5D8EA",
    road: dark ? "#4a5562" : "#FFFFFF",
    roadCasing: dark ? "#2a3038" : "#D9D3C7",
  };
}

function paintPilotVeil(): void {
  const map = baseMap;
  if (!map?.getLayer("pilot-veil")) return;
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  map.setPaintProperty("pilot-veil", "fill-color", dark ? "#14181d" : "#f3efe8");
}

function paintBase(): void {
  const colors = palette();
  const map = baseMap;
  if (!map) return;
  paintPilotVeil();
  if (map.getLayer("land")) map.setPaintProperty("land", "background-color", colors.land);
  if (map.getLayer("parks")) map.setPaintProperty("parks", "fill-color", colors.park);
  if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", colors.water);
  if (map.getLayer("roads")) map.setPaintProperty("roads", "line-color", colors.road);
  if (map.getLayer("roads-casing")) map.setPaintProperty("roads-casing", "line-color", colors.roadCasing);
}

function paintSceneColors(): void {
  const colors = palette();
  const map = baseMap;
  if (!map) return;
  if (map.getLayer("buildings")) map.setPaintProperty("buildings", "fill-color", rgba(colors.building));
  if (map.getLayer("shadows")) {
    map.setPaintProperty("shadows", "fill-color", rgba(colors.shadow));
    map.setPaintProperty("shadows", "fill-opacity", colors.dark ? 0.3 : 0.18);
  }
  if (map.getLayer("shadow-edge")) map.setPaintProperty("shadow-edge", "line-color", rgba(colors.edge));
  if (map.getLayer("shadow-edge-estimated")) {
    map.setPaintProperty("shadow-edge-estimated", "line-color", colors.dark ? "#ffffff" : "#14202b");
    map.setPaintProperty("shadow-edge-estimated", "line-opacity", colors.dark ? 0.25 : 0.35);
  }
  if (map.getLayer("shadow-edge")) {
    map.setPaintProperty("shadow-edge", "line-opacity", 0);
  }
  if (map.getLayer("route-inactive-casing")) {
    map.setPaintProperty("route-inactive-casing", "line-color", rgba(INACTIVE_CASING_DARK));
    map.setLayoutProperty("route-inactive-casing", "visibility", colors.dark ? "visible" : "none");
  }
  if (map.getLayer("route-inactive")) map.setPaintProperty("route-inactive", "line-color", rgba(colors.inactive));
  if (map.getLayer("route-casing")) map.setPaintProperty("route-casing", "line-color", rgba(colors.casing));
  if (map.getLayer("route-shade-casing")) map.setPaintProperty("route-shade-casing", "line-color", rgba(colors.casing));
  if (map.getLayer("route-sun")) map.setPaintProperty("route-sun", "line-color", rgba(colors.sun));
  if (map.getLayer("route-shade")) map.setPaintProperty("route-shade", "line-color", rgba(colors.shade));
  if (map.getLayer("route-ticks")) map.setPaintProperty("route-ticks", "line-color", rgba(colors.shade));
}

let baseMap: Map | null = null;

function rgba(color: readonly [number, number, number, number]): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

function ringsCollection(rings: readonly (readonly LngLat[])[]) {
  return {
    type: "FeatureCollection" as const,
    features: rings.map((ring) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [positions(ring)] },
    })),
  };
}

function linesCollection(lines: readonly (readonly LngLat[])[]) {
  return {
    type: "FeatureCollection" as const,
    features: lines
      .filter((line) => line.length >= 2)
      .map((coordinates) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: positions(coordinates) },
      })),
  };
}

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function positions(line: readonly LngLat[]): [number, number][] {
  return line.map((point) => [point[0], point[1]]);
}

function easeOptions(camera: CameraMove, durationMs: number): EaseToOptions {
  const options: EaseToOptions = {
    pitch: 0,
    bearing: camera.bearing,
    duration: durationMs,
    essential: true,
  };
  if (camera.center) options.center = [camera.center[0], camera.center[1]];
  if (camera.zoom !== undefined) options.zoom = camera.zoom;
  return options;
}

function placeMarker(
  map: Map,
  current: Marker | null,
  position: LngLat | null,
  kind: "start" | "end",
  label?: string,
): Marker | null {
  current?.remove();
  if (!position) return null;
  const element = document.createElement("div");
  element.className = kind === "start" ? "shadeway-marker shadeway-marker--start" : "shadeway-marker shadeway-marker--end";
  element.setAttribute("role", "img");
  if (label) element.setAttribute("aria-label", label);
  return new Marker({ element, anchor: kind === "end" ? "bottom" : "center" }).setLngLat([position[0], position[1]]).addTo(map);
}

function isGeoJsonSource(source: unknown): source is GeoJSONSource {
  return typeof source === "object" && source !== null && "setData" in source;
}
