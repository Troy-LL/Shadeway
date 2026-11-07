function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio between two sRGB hex colors. */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(parseHex(foregroundHex));
  const l2 = relativeLuminance(parseHex(backgroundHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const TOKEN_HEX = {
  text: "#111418",
  textSecondary: "#5B6570",
  ink: "#111418",
  surface: "#FFFFFF",
  surfaceStep: "#F2F3F5",
  surfaceDark: "#1C2026",
  surfaceStepDark: "#262B32",
  textOnDark: "#F5F7FA",
  textSecondaryOnDark: "#A8B0BA",
  textOnAccentLight: "#FFFFFF",
  accentLight: "#0066CC",
  textOnAccentDark: "#0B1220",
  accentDark: "#409CFF",
} as const;
