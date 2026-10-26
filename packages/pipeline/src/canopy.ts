export type CanopyGrid = {
  originX: number;
  originY: number;
  pixelSizeX: number;
  pixelSizeY: number;
  width: number;
  height: number;
  values: Uint8Array;
  box: { minX: number; minY: number; maxX: number; maxY: number };
};

export function countCanopyPixels(grid: CanopyGrid): { pixels: number; atLeast3m: number } {
  let pixels = 0;
  let atLeast3m = 0;
  for (let row = 0; row < grid.height; row += 1) {
    const y = grid.originY - (row + 0.5) * grid.pixelSizeY;
    if (y < grid.box.minY || y >= grid.box.maxY) continue;
    for (let col = 0; col < grid.width; col += 1) {
      const x = grid.originX + (col + 0.5) * grid.pixelSizeX;
      if (x < grid.box.minX || x >= grid.box.maxX) continue;
      pixels += 1;
      const height = grid.values[row * grid.width + col] ?? 0;
      if (height >= 3) atLeast3m += 1;
    }
  }
  return { pixels, atLeast3m };
}
