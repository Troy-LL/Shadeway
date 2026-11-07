import { describe, expect, it } from "vitest";
import { phoneMapPadding } from "./sheet-padding";

describe("phoneMapPadding", () => {
  it("includes the top safe inset and lifts map padding for the bottom inset", () => {
    expect(phoneMapPadding(47, 34, 420)).toEqual({
      top: 111,
      right: 16,
      bottom: 470,
      left: 16,
    });
  });
});
