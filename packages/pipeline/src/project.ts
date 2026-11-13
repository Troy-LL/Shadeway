const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;

export function toWebMercator(lon: number, lat: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lon * Math.PI) / 180) * WGS84_A,
    y: Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * WGS84_A,
  };
}

export function fromWebMercator(x: number, y: number): { lon: number; lat: number } {
  const lon = (x / WGS84_A) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / WGS84_A)) - Math.PI / 2) * (180 / Math.PI);
  return { lon, lat };
}

export function toUtm51N(lon: number, lat: number): { x: number; y: number } {
  const e2 = WGS84_F * (2 - WGS84_F);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const lon0 = (123 * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  const lonR = (lon * Math.PI) / 180;
  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const tanLat = Math.tan(latR);
  const n = WGS84_A / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const a = (lonR - lon0) * cosLat;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const m =
    WGS84_A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latR -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latR) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latR) -
      ((35 * e6) / 3072) * Math.sin(6 * latR));
  const x =
    k0 *
      n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * a ** 5) / 120) +
    500000;
  const y =
    k0 *
    (m +
      n *
        tanLat *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * a ** 6) / 720));
  return { x, y };
}
