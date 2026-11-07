import type { SheetDetent } from "./types";

const DETENT_ORDER: readonly SheetDetent[] = ["peek", "half"];

export function nextDetent(current: SheetDetent, direction: "up" | "down"): SheetDetent {
  const index = DETENT_ORDER.indexOf(current);
  if (index < 0) return current;
  const delta = direction === "up" ? 1 : -1;
  const next = DETENT_ORDER[index + delta];
  return next ?? current;
}

export function attachSheetKeyboard(
  grabber: HTMLElement,
  getDetent: () => SheetDetent,
  setDetent: (detent: SheetDetent) => void,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setDetent(nextDetent(getDetent(), "up"));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setDetent(nextDetent(getDetent(), "down"));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDetent(nextDetent(getDetent(), "down"));
    }
  };
  grabber.addEventListener("keydown", onKeyDown);
  return () => grabber.removeEventListener("keydown", onKeyDown);
}
