import { describe, expect, it } from "vitest";
import { nextDetent } from "./bottom-sheet";

describe("bottom sheet detents", () => {
  it("steps up and down through peek, half, full", () => {
    expect(nextDetent("peek", "up")).toBe("half");
    expect(nextDetent("half", "up")).toBe("full");
    expect(nextDetent("full", "up")).toBe("full");
    expect(nextDetent("full", "down")).toBe("half");
    expect(nextDetent("peek", "down")).toBe("peek");
  });
});
