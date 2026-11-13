// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createNoopMapController } from "./controller-stub";
import { createUiApp } from "./app";

describe("live search", () => {
  it("does not show fixture route minutes", () => {
    const root = document.createElement("div");
    createUiApp(root, createNoopMapController());
    expect(root.textContent).not.toContain("18 min");
    expect(root.textContent).not.toContain("4 min in sun");
    const fields = root.querySelectorAll<HTMLInputElement>(".search-field");
    expect(fields[1]?.placeholder).toBe("Where to?");
  });
});
