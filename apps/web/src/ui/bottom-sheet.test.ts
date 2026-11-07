import { describe, expect, it } from "vitest";
import { nextDetent } from "./bottom-sheet";

describe("bottom sheet detents", () => {
  it("steps up and down through peek and half", () => {
    expect(nextDetent("peek", "up")).toBe("half");
    expect(nextDetent("half", "up")).toBe("half");
    expect(nextDetent("half", "down")).toBe("peek");
    expect(nextDetent("peek", "down")).toBe("peek");
  });
});
