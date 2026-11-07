// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { COPY, ROUTE_ESTIMATE_LABEL } from "./copy";
import { defaultUiState } from "./fixtures";
import { renderUiState, renderUiStateById } from "./render";
import { suggestionPlaces } from "./screens/search";
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
  it("lists Shadiest and Fastest with sun minutes as the headline", () => {
    const root = renderUiStateById("compare-default");
    document.body.append(root);
    const titles = [...root.querySelectorAll(".route-card__title")].map((el) => el.textContent);
    expect(titles).toEqual([COPY.shadiest, COPY.fastest]);
    expect(root.querySelectorAll(".route-card__badge").length).toBe(0);
    expect(root.querySelectorAll(".sheet-estimate-label").length).toBe(1);
    expect(root.textContent).toContain(ROUTE_ESTIMATE_LABEL);
    document.body.replaceChildren();
  });

  it("says when the shadiest walk matches the fastest", () => {
    const routes = defaultUiState().routes.map((route) =>
      route.weight === "shadiest" ? { ...route, note: COPY.shadiestAndFastest } : route,
    );
    const root = renderUiState(defaultUiState({ screen: "compare", detent: "half", routes }));
    document.body.append(root);
    const meta = root.querySelector(".route-card .route-card__meta");
    expect(meta?.textContent).toContain(COPY.shadiestAndFastest);
    document.body.replaceChildren();
  });

  it("shows shade hours when estimates are unavailable", () => {
    const root = renderUiStateById("compare-shade-unavailable");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.shadeHours);
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
});

describe("Search", () => {
  it("shows From and To fields with swap", () => {
    const root = renderUiStateById("search-half");
    document.body.append(root);
    expect(root.querySelectorAll(".search-field").length).toBe(2);
    expect(root.querySelector(".search-swap")).toBeTruthy();
    document.body.replaceChildren();
  });

  it("shows resting suggestions while editing with an empty query", () => {
    const places = [
      { name: "Market! Market!", at: [121.056, 14.549] as const },
      { name: "Bonifacio High Street", at: [121.05, 14.551] as const },
    ];
    const suggestions = suggestionPlaces(
      defaultUiState({ editingField: true, focusedField: "to", places, toQuery: "" }),
      "",
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps a dropped pin label instead of the no-match copy", () => {
    const root = renderUiState(
      defaultUiState({
        screen: "search",
        detent: "half",
        editingField: true,
        focusedField: "from",
        fromQuery: COPY.droppedPin,
        start: { name: COPY.droppedPin, at: [121.04862, 14.55148] },
      }),
    );
    document.body.append(root);
    const msg = root.querySelector(".status-message--secondary");
    expect(msg === null || (msg as HTMLElement).hidden).toBe(true);
    document.body.replaceChildren();
  });

  it("shows no matching place for an unmatched query", () => {
    const root = renderUiState(
      defaultUiState({
        screen: "search",
        detent: "half",
        editingField: true,
        focusedField: "to",
        toQuery: "zzzzz-no-place",
        places: [{ name: "Market! Market!", at: [121.056, 14.549] }],
      }),
    );
    document.body.append(root);
    const noMatch = root.querySelector(".status-message--secondary");
    expect(noMatch?.textContent).toBe(COPY.noMatchingPlace);
    expect((noMatch as HTMLElement).hidden).toBe(false);
    document.body.replaceChildren();
  });

  it("filters named places from the query", () => {
    const root = renderUiState(
      defaultUiState({
        screen: "search",
        detent: "half",
        editingField: true,
        focusedField: "to",
        toQuery: "market",
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
});

describe("In-route", () => {
  it("shows the route overview and one sheet label", () => {
    const root = renderUiStateById("in-route-peek");
    document.body.append(root);
    expect(root.textContent).toContain(COPY.routeOverview);
    expect(root.textContent).toContain(ROUTE_ESTIMATE_LABEL);
    expect(root.textContent).not.toContain("Keep going");
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
