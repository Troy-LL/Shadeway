import { fromUrl } from "geotiff";

export type RasterWindow = {
  originX: number;
  originY: number;
  pixelSizeX: number;
  pixelSizeY: number;
  width: number;
  height: number;
  values: Uint8Array | Float32Array | Float64Array;
  nodata: number | null;
};

export async function readRasterWindow(
  url: string,
  sample: number,
  world: { minX: number; minY: number; maxX: number; maxY: number },
): Promise<RasterWindow> {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();
  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const originX = origin[0];
  const originY = origin[1];
  const resX = resolution[0];
  const resY = resolution[1];
  if (originX === undefined || originY === undefined || resX === undefined || resY === undefined) {
    throw new Error(`raster ${url} has no geotransform`);
  }
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const col0 = clamp(Math.floor((world.minX - originX) / resX), 0, fullWidth);
  const col1 = clamp(Math.ceil((world.maxX - originX) / resX), 0, fullWidth);
  const rowAt = (y: number) => (y - originY) / resY;
  const row0 = clamp(Math.floor(Math.min(rowAt(world.minY), rowAt(world.maxY))), 0, fullHeight);
  const row1 = clamp(Math.ceil(Math.max(rowAt(world.minY), rowAt(world.maxY))), 0, fullHeight);
  if (col1 <= col0 || row1 <= row0) {
    throw new Error(`raster window missed ${url}`);
  }
  const rasters = await image.readRasters({
    window: [col0, row0, col1, row1],
    samples: [sample],
  });
  const band = Array.isArray(rasters) ? rasters[0] : rasters;
  if (!(band instanceof Uint8Array || band instanceof Float32Array || band instanceof Float64Array)) {
    throw new Error(`unexpected raster sample type from ${url}`);
  }
  const pixelSizeY = Math.abs(resY);
  const top = resY < 0 ? originY + row0 * resY : originY - row0 * pixelSizeY;
  return {
    originX: originX + col0 * resX,
    originY: top,
    pixelSizeX: Math.abs(resX),
    pixelSizeY,
    width: rasters.width,
    height: rasters.height,
    values: band,
    nodata: image.getGDALNoData(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
