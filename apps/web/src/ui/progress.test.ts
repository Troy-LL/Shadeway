import { describe, expect, it } from "vitest";
import { slotAfterElapsed, walkRemaining } from "./progress";

describe("walk progress", () => {
  it("shrinks distance and minutes as time elapses and shifts the shade slot", () => {
    const start = walkRemaining(0, 600, 1000, 8);
    expect(start).toMatchObject({ fraction: 0, distanceM: 1000, minutes: 10, sunMinutes: 8 });
    const mid = walkRemaining(300, 600, 1000, 8);
    expect(mid.distanceM).toBe(500);
    expect(mid.minutes).toBe(5);
    expect(mid.sunMinutes).toBe(4);
    expect(slotAfterElapsed(12, 0)).toBe(12);
    expect(slotAfterElapsed(12, 30 * 60)).toBe(13);
    expect(slotAfterElapsed(18, 60 * 60)).toBe(20);
    expect(slotAfterElapsed(24, 60 * 60)).toBe(24);
  });
});