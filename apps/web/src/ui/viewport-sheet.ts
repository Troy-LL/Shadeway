export function bindVisualViewport(onChange: (heightPx: number) => void): () => void {
  const apply = () => {
    if (window.matchMedia("(min-width: 900px)").matches) {
      onChange(0);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) {
      onChange(Math.max(164, window.innerHeight - 48));
      return;
    }
    const topInset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0;
    onChange(Math.max(164, viewport.height - topInset - 8));
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
