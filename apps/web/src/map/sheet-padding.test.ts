// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

describe("sheet map padding", () => {
  it("includes the top safe inset in phone padding", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("min-width: 900px") ? false : false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    document.documentElement.style.setProperty("--safe-top", "47px");
    const { computeSheetPadding } = await import("./sheet-padding");
    const padding = computeSheetPadding();
    expect(padding.top).toBe(64 + 47);
    document.documentElement.style.removeProperty("--safe-top");
    vi.unstubAllGlobals();
  });
});
