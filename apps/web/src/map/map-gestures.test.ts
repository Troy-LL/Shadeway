import { describe, expect, it, vi } from "vitest";
import { FLAT_MAP_OPTIONS, applyFlatMapGestures, readGestureDiagnostics } from "./map-gestures";

describe("map gestures", () => {
  it("keeps pitch locked with rotation disabled", () => {
    expect(FLAT_MAP_OPTIONS.maxPitch).toBe(0);
    expect(FLAT_MAP_OPTIONS.dragRotate).toBe(false);
    expect(FLAT_MAP_OPTIONS.touchPitch).toBe(false);

    const map = {
      dragRotate: { disable: vi.fn(), isEnabled: () => false },
      touchZoomRotate: { disableRotation: vi.fn(), _rotationDisabled: true },
      setMaxPitch: vi.fn(),
      getMaxPitch: () => 0,
      getPitch: () => 0,
      setPitch: vi.fn(),
      getBearing: () => 0,
    };

    applyFlatMapGestures(map as never);
    expect(map.dragRotate.disable).toHaveBeenCalled();
    expect(map.touchZoomRotate.disableRotation).toHaveBeenCalled();
    expect(map.setMaxPitch).toHaveBeenCalledWith(0);

    const diag = readGestureDiagnostics(map as never);
    expect(diag.maxPitch).toBe(0);
    expect(diag.dragRotateEnabled).toBe(false);
    expect(diag.touchRotationEnabled).toBe(false);
  });

  it("fails diagnostics when maxPitch is not locked", () => {
    const map = {
      dragRotate: { isEnabled: () => false },
      touchZoomRotate: { _rotationDisabled: true },
      getMaxPitch: () => 60,
      getPitch: () => 0,
      getBearing: () => 0,
    };
    expect(readGestureDiagnostics(map as never).maxPitch).not.toBe(0);
  });
});
