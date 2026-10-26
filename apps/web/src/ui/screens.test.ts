// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { COPY, ROUTE_ESTIMATE_LABEL } from "./copy";
import { renderUiStateById } from "./render";
import { UI_STATE_IDS } from "./state-fixtures";

describe("UI screen states", () => {
  for (const stateId of UI_STATE_IDS) {
    it(`renders ${stateId}`, () => {
      const root = renderUiStateById(stateId);
      document.body.append(root);
      expect(root.querySelector(".shadeway-ui")).toBeTruthy();
      document.body.replaceChildren();
    });
  }
});

describe("Compare route cards", () => {
  it("lists Shadiest, Balanced, Fastest with the estimate label on each", () => {
    const root = renderUiStateById("compare-default");
    document.body.append(root);
    const titles = [...root.querySelectorAll(".route-card__title")].map((el) => el.textContent);
    expect(titles).toEqual([COPY.shadiest, COPY.balanced, COPY.fastest]);
    const badges = root.querySelectorAll(".route-card__badge");
    expect(badges.length).toBe(3);
    for (const badge of badges) {
      expect(badge.textContent).toBe(ROUTE_ESTIMATE_LABEL);
    }
    document.body.replaceChildren();
  });

  it("shows only Fastest when the sun is down", () => {
    const root = renderUiStateById("compare-night");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.sunIsDown);
    expect(root.querySelectorAll(".route-card").length).toBe(1);
    expect(root.querySelector(".route-card__title")?.textContent).toBe(COPY.fastest);
    document.body.replaceChildren();
  });
});

describe("Status copy", () => {
  it("shows loading copy", () => {
    const root = renderUiStateById("compare-loading");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.loadingShade);
    document.body.replaceChildren();
  });

  it("shows offline copy on search", () => {
    const root = renderUiStateById("search-offline");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.offline);
    document.body.replaceChildren();
  });

  it("shows off route banner copy", () => {
    const root = renderUiStateById("in-route-off-route");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.offRoute);
    expect(root.textContent).toContain(COPY.reroute);
    document.body.replaceChildren();
  });
});

describe("Search", () => {
  it("shows Where to at peek", () => {
    const root = renderUiStateById("search-peek");
    document.body.append(root);
    const field = root.querySelector<HTMLInputElement>(".search-field");
    expect(field?.placeholder).toBe(COPY.whereTo);
    document.body.replaceChildren();
  });
});

describe("Touch targets", () => {
  it("primary actions are at least 44px tall", () => {
    const root = renderUiStateById("compare-default");
    document.body.append(root);
    const start = root.querySelector<HTMLElement>(".primary-action");
    expect(start).toBeTruthy();
    const minHeight = getComputedStyle(start!).minHeight;
    expect(Number.parseFloat(minHeight)).toBeGreaterThanOrEqual(44);
    document.body.replaceChildren();
  });
});
