import type { Map } from "maplibre-gl";

export const FLAT_MAP_OPTIONS = {
  pitch: 0,
  bearing: 0,
  maxPitch: 0,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
} as const;

export function applyFlatMapGestures(map: Map): void {
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.setMaxPitch(0);
  if (map.getPitch() !== 0) map.setPitch(0);
}

export function readGestureDiagnostics(map: Map): {
  readonly maxPitch: number;
  readonly dragRotateEnabled: boolean;
  readonly touchRotationEnabled: boolean;
  readonly pitch: number;
  readonly bearing: number;
} {
  const touch = map.touchZoomRotate as unknown as { _rotationDisabled?: boolean };
  const touchRotationEnabled = touch._rotationDisabled !== true;
  return {
    maxPitch: map.getMaxPitch(),
    dragRotateEnabled: map.dragRotate.isEnabled(),
    touchRotationEnabled,
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
}
