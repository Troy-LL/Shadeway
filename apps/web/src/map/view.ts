import type { LngLat } from "@shadeway/contract";
import { GeoJSONSource, Map, Marker, setWorkerUrl, type EaseToOptions } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(maplibreWorkerUrl);
import type { RouteDraw, ShadowDraw } from "./scene";

const SHADOW = [20, 32, 43, 46] as const;
const SHADOW_DARK = [20, 32, 43, 32] as const;
const EDGE = [20, 32, 43, 55] as const;
const EDGE_DARK = [20, 32, 43, 40] as const;
const EDGE_EST = [20, 32, 43, 90] as const;
const EDGE_EST_DARK = [20, 32, 43, 70] as const;
const SUN_LINE = [245, 165, 36, 255] as const;
const SUN_LINE_DARK = [255, 184, 77, 255] as const;
const SHADE_LINE = [31, 122, 140, 255] as const;
const SHADE_LINE_DARK = [58, 160, 179, 255] as const;
const CASING = [255, 255, 255, 235] as const;
const TICK = [31, 122, 140, 255] as const;
const ROUTE_INK = [20, 32, 43, 230] as const;

export interface CameraMove {
  readonly pitch: number;
  readonly bearing: number;
  readonly center?: LngLat;
  readonly zoom?: number;
}

export interface MapScene {
  readonly shadows: readonly ShadowDraw[];
  readonly route: RouteDraw;
}

export interface MapView {
  setRoads(roads: readonly (readonly LngLat[])[]): void;
  setLand(areas: readonly { kind: "park" | "water"; ring: readonly LngLat[] }[]): void;
  setLabels(labels: readonly { name: string; at: LngLat }[]): void;
  setScene(scene: MapScene): void;
  ease(camera: CameraMove, durationMs: number): void;
  fit(
    bounds: readonly [number, number, number, number],
    padding: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number },
    camera: CameraMove,
    durationMs: number,
  ): void;
  setMarkers(start: LngLat | null, end: LngLat | null): void;
  setOutline(ring: readonly LngLat[] | null): void;
  onTap(listener: (position: LngLat) => void): void;
}

const SCENE_SOURCES = [
  "shadows",
  "shadow-edge",
  "shadow-edge-estimated",
  "route-ink",
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
    for (const id of SCENE_SOURCES) {
      map.addSource(id, { type: "geojson", data: emptyCollection() });
    }
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
      id: "shadows",
      type: "fill",
      source: "shadows",
      paint: { "fill-color": rgba(SHADOW), "fill-opacity": 1 },
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
      id: "route-ink",
      type: "line",
      source: "route-ink",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(ROUTE_INK), "line-width": 14 },
    });
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route-casing",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": rgba(CASING), "line-width": 12 },
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
      paint: { "line-color": rgba(CASING), "line-width": 7 },
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
  let labelMarkers: Marker[] = [];
  let labelKey = "";
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
    setLabels(labels) {
      const key = labels.map((label) => `${label.name}@${label.at[0]},${label.at[1]}`).join(";");
      if (key === labelKey) return;
      labelKey = key;
      whenLoaded(() => {
        for (const marker of labelMarkers) marker.remove();
        labelMarkers = labels.map((label) => {
          const element = document.createElement("div");
          element.className = "shadeway-place-label";
          element.textContent = label.name;
          return new Marker({ element, anchor: "center" }).setLngLat([label.at[0], label.at[1]]).addTo(map);
        });
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
    setMarkers(start, end) {
      startMarker = placeMarker(map, startMarker, start, "start");
      endMarker = placeMarker(map, endMarker, end, "end");
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
  };
  return view;
}

function applyScene(scene: MapScene): void {
  const map = baseMap;
  if (!map) return;
  const estimated = scene.shadows.filter((shadow) => shadow.estimated);
  const measured = scene.shadows.filter((shadow) => !shadow.estimated);
  setSourceData(map, "shadows", ringsCollection(scene.shadows.map((shadow) => shadow.ring)));
  setSourceData(map, "shadow-edge", linesCollection(measured.map((shadow) => shadow.ring)));
  setSourceData(map, "shadow-edge-estimated", linesCollection(estimated.map((shadow) => shadow.ring)));
  setSourceData(map, "route-ink", linesCollection(scene.route.sunny));
  setSourceData(map, "route-casing", linesCollection(scene.route.sunny));
  setSourceData(map, "route-sun", linesCollection(scene.route.sunny));
  setSourceData(map, "route-shade-casing", linesCollection(scene.route.shaded));
  setSourceData(map, "route-shade", linesCollection(scene.route.shaded));
  setSourceData(map, "route-ticks", linesCollection(scene.route.ticks));
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
    land: dark ? "#14181d" : "#F3EFE8",
    park: dark ? "#243028" : "#D5E4CF",
    water: dark ? "#1C3344" : "#C5D8EA",
    road: dark ? "#4a5562" : "#FFFFFF",
    roadCasing: dark ? "#2a3038" : "#D9D3C7",
  };
}

function paintBase(): void {
  const colors = palette();
  const map = baseMap;
  if (!map) return;
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
  if (map.getLayer("shadows")) map.setPaintProperty("shadows", "fill-color", rgba(colors.shadow));
  if (map.getLayer("shadow-edge")) map.setPaintProperty("shadow-edge", "line-color", rgba(colors.edge));
  if (map.getLayer("shadow-edge-estimated")) map.setPaintProperty("shadow-edge-estimated", "line-color", rgba(colors.edgeEst));
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

function placeMarker(map: Map, current: Marker | null, position: LngLat | null, kind: "start" | "end"): Marker | null {
  current?.remove();
  if (!position) return null;
  const element = document.createElement("div");
  element.className = kind === "start" ? "shadeway-marker shadeway-marker--start" : "shadeway-marker shadeway-marker--end";
  return new Marker({ element }).setLngLat([position[0], position[1]]).addTo(map);
}

function isGeoJsonSource(source: unknown): source is GeoJSONSource {
  return typeof source === "object" && source !== null && "setData" in source;
}
