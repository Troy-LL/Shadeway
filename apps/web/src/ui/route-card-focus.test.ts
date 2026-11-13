// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { defaultUiState } from "./fixtures";
import { renderUiState } from "./render";
import { focusSelectedRouteCard } from "./route-card-focus";

describe("focusSelectedRouteCard", () => {
  it("focuses the checked route radio after arrow key selection", () => {
    const root = renderUiState(defaultUiState({ screen: "compare", detent: "half", selectedWeight: "fastest" }));
    document.body.append(root);
    focusSelectedRouteCard(root);
    const focused = document.activeElement;
    expect(focused?.classList.contains("route-card")).toBe(true);
    expect(focused?.getAttribute("aria-checked")).toBe("true");
    expect(focused?.textContent).toContain(COPY.fastest);
    document.body.replaceChildren();
  });
});
