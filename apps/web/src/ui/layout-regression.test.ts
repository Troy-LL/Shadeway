import { describe, expect, it } from "vitest";
import { UI_STYLES } from "./styles";
import { phoneMapPadding } from "../map/sheet-padding";

describe("layout regressions", () => {
  it("keeps compare footer safe inset and keyboard peek hooks in bundled styles", () => {
    expect(UI_STYLES).toContain("padding-bottom: calc(var(--space-4) + var(--safe-bottom))");
    expect(UI_STYLES).toContain("min(62dvh, calc(420px + var(--safe-bottom)))");
    expect(UI_STYLES).toContain("[data-keyboard='true']");
    expect(UI_STYLES).toContain("compare-peek-summary");
  });

  it("budgets map padding for the sheet and bottom safe inset together", () => {
    expect(phoneMapPadding(0, 34, 420).bottom).toBe(470);
  });
});
