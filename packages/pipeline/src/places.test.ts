import { describe, expect, it } from "vitest";
import { curatePlaces } from "./places.js";

describe("curatePlaces", () => {
  it("keeps one point per name and prefers landmarks over extra streets", () => {
    const places = curatePlaces(
      [
        {
          rank: 100,
          places: [
            { name: "Cafe", at: [121.05, 14.55] },
            { name: "  Cafe ", at: [121.06, 14.56] },
          ],
        },
        {
          rank: 30,
          places: [
            { name: "Bonifacio High Street", at: [121.048, 14.551] },
            { name: "Alley", at: [121.04, 14.54] },
          ],
        },
      ],
      2,
    );
    expect(places.map((place) => place.name)).toEqual(["Bonifacio High Street", "Cafe"]);
    expect(places[1]?.at).toEqual([121.05, 14.55]);
  });
});
