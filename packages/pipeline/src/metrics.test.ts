import { describe, expect, it } from "vitest";

describe("canopy build sun minutes rounding", () => {
  it("uses half-minute steps so demo before/after differ", () => {
    const before = Math.round(239.2 / 30) / 2;
    const after = Math.round(214.3 / 30) / 2;
    expect(before).toBe(4);
    expect(after).toBe(3.5);
    expect(before).not.toBe(after);
  });
});
