import { describe, expect, it } from "vitest";
import { TOKEN_HEX, contrastRatio } from "./contrast";

const MIN_CONTRAST = 4.5;

describe("token contrast", () => {
  it("meets AA contrast on light surfaces", () => {
    expect(contrastRatio(TOKEN_HEX.text, TOKEN_HEX.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(TOKEN_HEX.textSecondary, TOKEN_HEX.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(TOKEN_HEX.ink, TOKEN_HEX.surfaceStep)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(TOKEN_HEX.textOnAccentLight, TOKEN_HEX.accentLight)).toBeGreaterThanOrEqual(4.5);
  });

  it("meets 3:1 for the inactive route line on dark roads and land", () => {
    expect(contrastRatio(TOKEN_HEX.inactiveRouteDark, TOKEN_HEX.roadDark)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(TOKEN_HEX.inactiveRouteDark, TOKEN_HEX.landDark)).toBeGreaterThanOrEqual(3);
  });

  it("meets AA contrast on dark surfaces", () => {
    expect(contrastRatio(TOKEN_HEX.textOnDark, TOKEN_HEX.surfaceDark)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(TOKEN_HEX.textSecondaryOnDark, TOKEN_HEX.surfaceDark)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(TOKEN_HEX.textOnAccentDark, TOKEN_HEX.accentDark)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
