// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { defaultUiState } from "./fixtures";
import { renderDeparturePicker } from "./departure-time";
import { renderUiState, renderUiStateById } from "./render";
import { updateSearchScreen, createSearchScreen } from "./screens/search";

describe("search listbox", () => {
  it("wires listbox roles on suggestions", () => {
    const handlers = {
      onFocusField: () => {},
      onFromQuery: () => {},
      onToQuery: () => {},
      onPick: () => {},
      onSwap: () => {},
      onTryAgain: () => {},
    };
    const mount = createSearchScreen(handlers);
    updateSearchScreen(
      mount,
      defaultUiState({
        editingField: true,
        focusedField: "to",
        toQuery: "market",
        places: [{ name: "Market! Market!", at: [121.056, 14.549] }],
      }),
      handlers,
    );
    expect(mount.suggest.getAttribute("role")).toBe("listbox");
    const option = mount.suggest.querySelector("[role='option']");
    expect(option?.getAttribute("aria-selected")).toBe("false");
    expect(mount.to.getAttribute("aria-activedescendant")).toBeTruthy();
  });
});

describe("departure picker", () => {
  it("marks the selected time with a visible check", () => {
    const panel = renderDeparturePicker({
      slot: 12,
      departureIsNow: false,
      shadeAvailable: true,
      open: true,
      onToggle: () => {},
      onPickNow: () => {},
      onPickSlot: () => {},
    });
    const selected = panel.querySelector("[aria-selected='true']");
    expect(selected?.querySelector(".departure-picker__check")).toBeTruthy();
  });
});

describe("route radiogroup", () => {
  it("exposes radio checked state on cards", () => {
    const root = renderUiState(defaultUiState({ screen: "compare", detent: "half" }));
    document.body.append(root);
    const group = root.querySelector("[role='radiogroup']");
    expect(group).toBeTruthy();
    const checked = root.querySelector(".route-card[aria-checked='true']");
    expect(checked?.getAttribute("role")).toBe("radio");
    document.body.replaceChildren();
  });
});

describe("shade unavailable copy", () => {
  it("never shows Shadiest on compare cards when shade is unavailable", () => {
    const root = renderUiStateById("compare-shade-unavailable");
    document.body.append(root);
    expect(root.textContent).not.toContain(COPY.shadiest);
    expect(root.textContent).toContain(COPY.fastestWalk);
    document.body.replaceChildren();
  });
});
