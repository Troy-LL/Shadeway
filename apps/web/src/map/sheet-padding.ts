export function phoneMapPadding(
  safeTopPx: number,
  safeBottomPx: number,
  sheetHeightPx: number,
): { top: number; right: number; bottom: number; left: number } {
  return { top: 64 + safeTopPx, right: 16, bottom: sheetHeightPx + 16 + safeBottomPx, left: 16 };
}

export function computeSheetPadding(): { top: number; right: number; bottom: number; left: number } {
  const sheet = document.querySelector(".shadeway-sheet");
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const root = document.documentElement;
  const safeTop = Number.parseFloat(getComputedStyle(root).getPropertyValue("--safe-top")) || 0;
  const safeBottom = Number.parseFloat(getComputedStyle(root).getPropertyValue("--safe-bottom")) || 0;
  if (wide) return { top: 32 + safeTop, right: 32, bottom: 32 + safeBottom, left: 416 };
  const rect = sheet instanceof HTMLElement ? sheet.getBoundingClientRect() : null;
  // Measured height already includes --safe-bottom on the sheet.
  const sheetHeight = rect ? Math.round(rect.height) : 176 + safeBottom;
  return phoneMapPadding(safeTop, 0, sheetHeight);
}
