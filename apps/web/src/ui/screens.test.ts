// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { COPY, ROUTE_ESTIMATE_LABEL } from "./copy";
import { defaultUiState } from "./fixtures";
import { renderUiState, renderUiStateById } from "./render";
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
  it("lists Fastest, Balanced, Shadiest with sun minutes ahead of total time", () => {
    const root = renderUiStateById("compare-default");
    document.body.append(root);
    const titles = [...root.querySelectorAll(".route-card__title")].map((el) => el.textContent);
    expect(titles).toEqual([COPY.fastest, COPY.balanced, COPY.shadiest]);
    const card = root.querySelector(".route-card");
    const sun = card?.querySelector(".route-card__sun");
    const total = card?.querySelector(".route-card__total");
    expect(sun && total && (sun.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    const badges = root.querySelectorAll(".route-card__badge");
    expect(badges.length).toBe(3);
    for (const badge of badges) {
      expect(badge.textContent).toBe(ROUTE_ESTIMATE_LABEL);
    }
    document.body.replaceChildren();
  });

  it("says when the shadiest card is the same walk as the fastest", () => {
    const routes = defaultUiState().routes.map((route) =>
      route.weight === "shadiest" ? { ...route, note: COPY.sameRouteAsFastest } : route,
    );
    const root = renderUiState(defaultUiState({ screen: "compare", detent: "half", routes }));
    document.body.append(root);
    expect(root.querySelector(".route-card__note")?.textContent).toBe(COPY.sameRouteAsFastest);
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
  it("shows the estimate badge and the building-only label in route", () => {
    const root = renderUiStateById("in-route-peek");
    document.body.append(root);
    expect(root.querySelector(".in-route-screen .confidence-badge")?.textContent).toBe("Estimate");
    expect(root.textContent).toContain(ROUTE_ESTIMATE_LABEL);
    expect(root.textContent).toContain("min in sun");
    expect(root.textContent).toContain(COPY.keepGoing);
    document.body.replaceChildren();
  });

  it("ranks the pilot chips ahead of other name matches", () => {
    const root = renderUiState(
      defaultUiState({
        screen: "search",
        detent: "half",
        query: "boni",
        places: [
          { name: "Area Formerly Occupied by Fort Bonifacio Museum", at: [121.05, 14.55] },
          { name: "Bonifacio High Street", at: [121.05, 14.551] },
          { name: "Bonifacio South Street", at: [121.049, 14.549] },
        ],
      }),
    );
    document.body.append(root);
    const suggestions = [...root.querySelectorAll(".suggest__option")].map((el) => el.textContent);
    expect(suggestions[0]).toBe("Bonifacio High Street");
    document.body.replaceChildren();
  });

  it("filters named places from the query", () => {
    const root = renderUiState(
      defaultUiState({
        screen: "search",
        detent: "peek",
        query: "market",
        places: [
          { name: "Market! Market!", at: [121.056, 14.549] },
          { name: "Bonifacio High Street", at: [121.05, 14.551] },
        ],
      }),
    );
    document.body.append(root);
    const suggestions = [...root.querySelectorAll(".suggest__option")].map((el) => el.textContent);
    expect(suggestions).toEqual(["Market! Market!"]);
    document.body.replaceChildren();
  });

  it("shows Where to at peek", () => {
    const root = renderUiStateById("search-peek");
    document.body.append(root);
    const field = root.querySelector<HTMLInputElement>(".search-field");
    expect(field?.placeholder).toBe(COPY.whereTo);
    expect(root.textContent).toContain("Bonifacio High Street");
    expect(root.textContent).toContain("Market! Market!");
    expect(root.textContent).not.toContain(COPY.leaveNow);
    document.body.replaceChildren();
  });

  it("keeps Leave now on the full sheet", () => {
    const root = renderUiStateById("search-full");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.leaveNow);
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
