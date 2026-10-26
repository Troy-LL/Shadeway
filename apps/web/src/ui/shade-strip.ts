import type { ShadeSegment } from "./types";

export function renderShadeStrip(segments: readonly ShadeSegment[]): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "shade-strip";
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", "Shade along route");

  for (const segment of segments) {
    const span = document.createElement("span");
    span.className = segment.sunny ? "shade-strip__sun" : "shade-strip__shade";
    const width = (segment.to - segment.from) * 100;
    span.style.flexBasis = `${width}%`;
    bar.append(span);
  }

  return bar;
}
