import { AmbientLight, DirectionalLight, LightingEffect, type Layer } from "@deck.gl/core";
import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Building, LngLat } from "@shadeway/contract";
import { GeoJSONSource, Map, Marker, setWorkerUrl, type EaseToOptions } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(maplibreWorkerUrl);
import type { RouteDraw, ShadowDraw } from "./scene";

const BUILDING = [214, 206, 194, 255] as const;
const BUILDING_LINE = [196, 190, 180, 255] as const;
const SHADOW_EDGE = [20, 32, 43, 190] as const;
const SUN_LINE = [245, 165, 36, 255] as const;
const SHADE_LINE = [31, 122, 140, 255] as const;
const CASING = [255, 255, 255, 235] as const;
const TICK = [31, 122, 140, 255] as const;

const dash = new PathStyleExtension({ dash: true });

export interface CameraMove {
  readonly pitch: number;
  readonly bearing: number;
  readonly center?: LngLat;
  readonly zoom?: number;
}

export interface DeckScene {
  readonly buildings: readonly Building[];
  readonly extruded: boolean;
  readonly shadows: readonly ShadowDraw[];
  readonly route: RouteDraw;
  readonly light: readonly [number, number, number];
}

export interface MapView {
  setRoads(roads: readonly (readonly LngLat[])[]): void;
  setDeck(scene: DeckScene): void;
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

export function createMapLibreView(root: HTMLElement): MapView {
  const map = new Map({
    container: root,
    style: {
      version: 8,
      sources: {},
      layers: [{ id: "land", type: "background", paint: { "background-color": "#E7E1D6" } }],
    },
    center: [121.051, 14.5522],
    zoom: 15.6,
    pitch: 38,
    bearing: -28,
    attributionControl: false,
    maxPitch: 67,
    fadeDuration: 0,
  });
  baseMap = map;
  const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);
  let loaded = false;
  const queue: Array<() => void> = [];
  const whenLoaded = (job: () => void) => {
    if (loaded) job();
    else queue.push(job);
  };
  map.once("load", () => {
    map.addSource("roads", { type: "geojson", data: emptyCollection() });
    map.addSource("outline", { type: "geojson", data: emptyCollection() });
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
    paintBase();
    loaded = true;
    for (const job of queue) job();
    queue.length = 0;
    map.resize();
  });

  let startMarker: Marker | null = null;
  let endMarker: Marker | null = null;
  let lastScene: DeckScene | null = null;
  const theme = window.matchMedia("(prefers-color-scheme: dark)");
  const repaint = () => {
    paintBase();
    if (!lastScene) return;
    overlay.setProps({ effects: [lighting(lastScene.light)], layers: layersFor(lastScene) });
  };
  theme.addEventListener("change", repaint);

  const view: MapView = {
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
    setDeck(scene) {
      lastScene = scene;
      overlay.setProps({
        effects: [lighting(scene.light)],
        layers: layersFor(scene),
      });
    },
    ease(camera, durationMs) {
      whenLoaded(() => map.easeTo(easeOptions(camera, durationMs)));
    },
    fit(bounds, padding, camera, durationMs) {
      whenLoaded(() => map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding,
          duration: durationMs,
          pitch: camera.pitch,
          bearing: camera.bearing,
          maxZoom: camera.pitch > 0 ? 16.6 : 17,
        },
      ));
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

function palette() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    dark,
    building: (dark ? [78, 82, 88, 255] : BUILDING) as [number, number, number, number],
    buildingLine: (dark ? [96, 102, 110, 255] : BUILDING_LINE) as [number, number, number, number],
    shadow: [20, 32, 43, dark ? 48 : 88] as [number, number, number, number],
    sun: (dark ? [255, 184, 77, 255] : SUN_LINE) as [number, number, number, number],
    shade: (dark ? [58, 160, 179, 255] : SHADE_LINE) as [number, number, number, number],
    land: dark ? "#14181d" : "#E7E1D6",
    road: dark ? "#4a5562" : "#FFFFFF",
    roadCasing: dark ? "#2a3038" : "#D9D3C7",
  };
}

function paintBase(): void {
  const colors = palette();
  const map = baseMap;
  if (!map) return;
  if (map.getLayer("land")) map.setPaintProperty("land", "background-color", colors.land);
  if (map.getLayer("roads")) map.setPaintProperty("roads", "line-color", colors.road);
  if (map.getLayer("roads-casing")) map.setPaintProperty("roads-casing", "line-color", colors.roadCasing);
}

let baseMap: Map | null = null;

function layersFor(scene: DeckScene): Layer[] {
  const colors = palette();
  const estimated = scene.shadows.filter((shadow) => shadow.estimated);
  const measured = scene.shadows.filter((shadow) => !shadow.estimated);
  const flat = !scene.extruded;
  const ribbon = [...scene.route.sunny, ...scene.route.shaded];
  const casingLines = scene.extruded ? ribbon : scene.route.sunny;
  return [
    polygonLayer("shadows", scene.shadows.map((shadow) => shadow.ring), colors.shadow, flat),
    lineLayer("shadow-edge", measured.map((shadow) => shadow.ring), [...SHADOW_EDGE], 1, false, flat),
    lineLayer("shadow-edge-estimated", estimated.map((shadow) => shadow.ring), [20, 32, 43, colors.dark ? 110 : 150], 1, true, flat),
    new GeoJsonLayer({
      id: "buildings",
      data: buildingCollection(scene.buildings),
      stroked: !scene.extruded,
      filled: true,
      extruded: scene.extruded,
      wireframe: false,
      getElevation: (feature: { properties?: { heightM?: number } }) => feature.properties?.heightM ?? 0,
      getFillColor: colors.building,
      getLineColor: colors.buildingLine,
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      material: {
        ambient: colors.dark ? 0.55 : 0.32,
        diffuse: 0.9,
        shininess: 10,
        specularColor: [255, 248, 236],
      },
    }),
    lineLayer("route-ink", casingLines, [20, 32, 43, 230], scene.extruded ? 22 : 14, false, true, true),
    lineLayer("route-casing", casingLines, [...CASING], scene.extruded ? 16 : 12, false, true, true),
    lineLayer("route-sun", scene.route.sunny, colors.sun, scene.extruded ? 10 : 8, false, true, true),
    lineLayer("route-shade", scene.route.shaded, colors.shade, scene.extruded ? 8 : 5, false, true, true),
    lineLayer("route-ticks", scene.route.ticks, [...TICK], 3, false, true, true),
  ];
}

function lighting(direction: readonly [number, number, number]): LightingEffect {
  return new LightingEffect({
    ambient: new AmbientLight({ color: [255, 250, 244], intensity: 0.38 }),
    sun: new DirectionalLight({
      color: [255, 236, 204],
      intensity: 1.7,
      direction: [direction[0], direction[1], direction[2]],
    }),
  });
}

function buildingCollection(buildings: readonly Building[]) {
  return {
    type: "FeatureCollection" as const,
      features: buildings.flatMap((building) => {
      const close = building.footprint[0];
      if (!close) return [];
      return [
        {
          type: "Feature" as const,
          properties: { heightM: building.heightM, id: building.id },
          geometry: {
            type: "Polygon" as const,
            coordinates: [positions([...building.footprint, close])],
          },
        },
      ];
    }),
  };
}

function polygonLayer(
  id: string,
  rings: readonly (readonly LngLat[])[],
  color: [number, number, number, number],
  flat: boolean,
): GeoJsonLayer {
  return new GeoJsonLayer({
    id,
    data: ringsCollection(rings),
    stroked: false,
    filled: true,
    extruded: false,
    getFillColor: color,
    parameters: flat ? { depthCompare: "always" } : { depthCompare: "less-equal" },
  });
}

function lineLayer(
  id: string,
  lines: readonly (readonly LngLat[])[],
  color: [number, number, number, number],
  width: number,
  dashed: boolean,
  flat: boolean,
  onTop = false,
): GeoJsonLayer {
  return new GeoJsonLayer({
    id,
    data: linesCollection(lines),
    stroked: true,
    filled: false,
    getLineColor: color,
    getLineWidth: width,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: onTop ? width : dashed ? 1 : width,
    lineCapRounded: onTop,
    lineJointRounded: onTop,
    getElevation: flat ? 0 : 8,
    parameters: onTop || flat ? { depthCompare: "always" } : { depthCompare: "less-equal" },
    ...(dashed
      ? {
          extensions: [dash],
          getDashArray: [3, 2] as [number, number],
          dashJustified: true,
        }
      : {}),
  });
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
    pitch: camera.pitch,
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
