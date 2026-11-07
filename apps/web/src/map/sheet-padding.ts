export function computeSheetPadding(): { top: number; right: number; bottom: number; left: number } {
  const sheet = document.querySelector(".shadeway-sheet");
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const root = document.documentElement;
  const safeTop = Number.parseFloat(getComputedStyle(root).getPropertyValue("--safe-top")) || 0;
  if (wide) return { top: 32 + safeTop, right: 32, bottom: 32, left: 416 };
  const rect = sheet instanceof HTMLElement ? sheet.getBoundingClientRect() : null;
  const sheetHeight = rect ? Math.round(rect.height) : 176;
  return { top: 64 + safeTop, right: 16, bottom: sheetHeight + 16, left: 16 };
}
