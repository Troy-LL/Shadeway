export interface ViewportLayout {
  readonly editHeightPx: number;
  readonly keyboardOffsetPx: number;
}

export function layoutFromVisualViewport(input: {
  readonly innerHeight: number;
  readonly safeTopPx: number;
  readonly viewportHeight: number | null;
  readonly viewportOffsetTop: number;
  readonly desktop: boolean;
}): ViewportLayout {
  if (input.desktop) {
    return { editHeightPx: 0, keyboardOffsetPx: 0 };
  }
  if (input.viewportHeight === null) {
    return {
      editHeightPx: Math.max(176, input.innerHeight - 48),
      keyboardOffsetPx: 0,
    };
  }
  const keyboardOffsetPx = Math.max(0, input.innerHeight - input.viewportHeight - input.viewportOffsetTop);
  const editHeightPx = Math.max(176, input.viewportHeight - input.safeTopPx - 8);
  return { editHeightPx, keyboardOffsetPx };
}
