import { layoutFromVisualViewport, type ViewportLayout } from "./viewport-layout";

export function bindVisualViewport(onChange: (layout: ViewportLayout) => void): () => void {
  const apply = () => {
    const desktop = window.matchMedia("(min-width: 900px)").matches;
    const viewport = window.visualViewport;
    const topInset =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0;
    onChange(
      layoutFromVisualViewport({
        innerHeight: window.innerHeight,
        safeTopPx: topInset,
        viewportHeight: viewport?.height ?? null,
        viewportOffsetTop: viewport?.offsetTop ?? 0,
        desktop,
      }),
    );
  };
  apply();
  window.visualViewport?.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
  return () => {
    window.visualViewport?.removeEventListener("resize", apply);
    window.visualViewport?.removeEventListener("scroll", apply);
    window.removeEventListener("resize", apply);
  };
}
