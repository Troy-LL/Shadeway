// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { defaultUiState } from "./fixtures";
import { formatSlotLabel } from "./departure-time";
import { renderCompareContent } from "./screens/compare";
import type { CompareHandlers } from "./screens/compare";

describe("compare wiring", () => {
  it("routes departure slot picks to the handler", () => {
    const onSlotChange = vi.fn();
    const handlers: CompareHandlers = {
      onSelectWeight: () => {},
      onSlotChange,
      onPickNow: () => {},
      onToggleTimePicker: () => {},
      onStart: () => {},
      onTryAgain: () => {},
      onBack: () => {},
    };
    const root = renderCompareContent(
      defaultUiState({ screen: "compare", timePickerOpen: true, departureIsNow: false, slot: 10 }),
      handlers,
    );
    document.body.append(root);
    const label = formatSlotLabel(11);
    const options = [...root.querySelectorAll<HTMLButtonElement>(".departure-picker__option")];
    const target = options.find((row) => row.textContent?.includes(label));
    expect(target).toBeTruthy();
    target?.click();
    expect(onSlotChange).toHaveBeenCalledWith(11);
    document.body.replaceChildren();
  });

  it("routes route card picks to the handler", () => {
    const onSelectWeight = vi.fn();
    const handlers: CompareHandlers = {
      onSelectWeight,
      onSlotChange: () => {},
      onPickNow: () => {},
      onToggleTimePicker: () => {},
      onStart: () => {},
      onTryAgain: () => {},
      onBack: () => {},
    };
    const root = renderCompareContent(defaultUiState({ screen: "compare", selectedWeight: "shadiest" }), handlers);
    document.body.append(root);
    const fastest = root.querySelector<HTMLButtonElement>(".route-card[data-weight='fastest']");
    fastest?.click();
    expect(onSelectWeight).toHaveBeenCalledWith("fastest");
    document.body.replaceChildren();
  });
});
