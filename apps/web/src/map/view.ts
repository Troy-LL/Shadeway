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
const SHADOW = [20, 32, 43, 88] as const;
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
    zoom: 15.2,
    pitch: 56,
    bearing: -24,
    attributionControl: false,
    maxPitch: 67,
    fadeDuration: 0,
  });
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
    loaded = true;
    for (const job of queue) job();
    queue.length = 0;
    map.resize();
  });

  let startMarker: Marker | null = null;
  let endMarker: Marker | null = null;

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
          maxZoom: 16.8,
        },
      ));
    },
    setMarkers(start, end) {
      startMarker = placeMarker(map, startMarker, start, "start");
      endMarker = placeMarker(map, endMarker, end, "end");
    },
    onTap(listener) {
      map.on("click", (event) => listener([event.lngLat.lng, event.lngLat.lat]));
    },
  };
  return view;
}

function layersFor(scene: DeckScene): Layer[] {
  const estimated = scene.shadows.filter((shadow) => shadow.estimated);
  const measured = scene.shadows.filter((shadow) => !shadow.estimated);
  const flat = !scene.extruded;
  return [
    polygonLayer("shadows", scene.shadows.map((shadow) => shadow.ring), [...SHADOW], flat),
    lineLayer("shadow-edge", measured.map((shadow) => shadow.ring), [...SHADOW_EDGE], 1, false, flat),
    lineLayer("shadow-edge-estimated", estimated.map((shadow) => shadow.ring), [20, 32, 43, 150], 1, true, flat),
    new GeoJsonLayer({
      id: "buildings",
      data: buildingCollection(scene.buildings),
      stroked: !scene.extruded,
      filled: true,
      extruded: scene.extruded,
      wireframe: false,
      getElevation: (feature: { properties?: { heightM?: number } }) => feature.properties?.heightM ?? 0,
      getFillColor: [...BUILDING],
      getLineColor: [...BUILDING_LINE],
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      material: {
        ambient: 0.32,
        diffuse: 0.9,
        shininess: 10,
        specularColor: [255, 248, 236],
      },
    }),
    lineLayer("route-casing", scene.route.sunny, [...CASING], 12, false, flat),
    lineLayer("route-sun", scene.route.sunny, [...SUN_LINE], 8, false, flat),
    lineLayer("route-shade", scene.route.shaded, [...SHADE_LINE], 5, false, flat),
    lineLayer("route-ticks", scene.route.ticks, [...TICK], 2, false, flat),
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
): GeoJsonLayer {
  return new GeoJsonLayer({
    id,
    data: linesCollection(lines),
    stroked: true,
    filled: false,
    getLineColor: color,
    getLineWidth: width,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: dashed ? 1 : width,
    getElevation: flat ? 0 : 1.5,
    parameters: flat ? { depthCompare: "always" } : { depthCompare: "less-equal" },
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
