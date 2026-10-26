import { describe, expect, it } from "vitest";
import { TOKEN_HEX, contrastRatio } from "./contrast";

const MIN_CONTRAST = 4.5;

describe("token contrast", () => {
  it("meets WCAG AA for primary text on light surface", () => {
    expect(contrastRatio(TOKEN_HEX.text, TOKEN_HEX.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("meets WCAG AA for secondary text on light surface", () => {
    expect(contrastRatio(TOKEN_HEX.textSecondary, TOKEN_HEX.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("meets WCAG AA for ink numbers on light surface", () => {
    expect(contrastRatio(TOKEN_HEX.ink, TOKEN_HEX.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("meets WCAG AA for text on dark surface", () => {
    expect(contrastRatio(TOKEN_HEX.textOnDark, TOKEN_HEX.surfaceDark)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("meets WCAG AA for secondary text on dark surface", () => {
    expect(contrastRatio(TOKEN_HEX.textSecondaryOnDark, TOKEN_HEX.surfaceDark)).toBeGreaterThanOrEqual(
      MIN_CONTRAST,
    );
  });
});
