import {
  REFERENCE_DAYS,
  SLOT_GRID,
  type LngLat,
  type LocalDate,
  type LocalDateTime,
  type ReferenceDay,
  type SunDay,
  type SunPosition,
} from "@shadeway/contract";

/**
 * 2026 dates whose local-noon declination is closest to 0, the June maximum,
 * and the December minimum. Fixed so tile bytes do not drift with the calendar year.
 */
export const REFERENCE_DATES = {
  "march-equinox": "2026-03-20",
  "june-solstice": "2026-06-21",
  "december-solstice": "2026-12-22",
} as const satisfies Record<ReferenceDay, LocalDate>;

const DEG = Math.PI / 180;

function rad(degrees: number): number {
  return degrees * DEG;
}

function deg(radians: number): number {
  return radians / DEG;
}

function wrap360(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const century = Math.floor(y / 100);
  const gregorian = 2 - century + Math.floor(century / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + gregorian - 1524.5;
}

function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    throw new RangeError(`bad date: ${date}`);
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new RangeError(`bad date: ${date}`);
  }
  return { year, month, day };
}

interface Orbit {
  readonly declinationDeg: number;
  readonly eqTimeMin: number;
}

// NOAA solar calculator equations. Elevation below is geometric: no refraction term.
function orbit(year: number, month: number, day: number, minutesLocal: number): Orbit {
  const zoneHours = SLOT_GRID.utcOffsetMinutes / 60;
  const jd = julianDay(year, month, day) + minutesLocal / 1440 - zoneHours / 24;
  const t = (jd - 2451545) / 36525;
  const meanLong = wrap360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const anomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const anomalyRad = rad(wrap360(anomaly));
  const center =
    Math.sin(anomalyRad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * anomalyRad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * anomalyRad) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = meanLong + center - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const obliquitySeconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const meanObliquity = 23 + (26 + obliquitySeconds / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(omega));
  const declinationDeg = deg(Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(obliquity) / 2) ** 2;
  const longRad = rad(meanLong);
  const eqTimeMin =
    deg(
      y * Math.sin(2 * longRad) -
        2 * eccentricity * Math.sin(anomalyRad) +
        4 * eccentricity * y * Math.sin(anomalyRad) * Math.cos(2 * longRad) -
        0.5 * y * y * Math.sin(4 * longRad) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * anomalyRad),
    ) * 4;
  return { declinationDeg, eqTimeMin };
}

function sunAt(
  year: number,
  month: number,
  day: number,
  minutesLocal: number,
  latDeg: number,
  lngDeg: number,
): SunPosition & { readonly declinationDeg: number } {
  const { declinationDeg, eqTimeMin } = orbit(year, month, day, minutesLocal);
  const zoneHours = SLOT_GRID.utcOffsetMinutes / 60;
  const trueSolar = minutesLocal + eqTimeMin + 4 * lngDeg - 60 * zoneHours;
  const trueSolarMin = ((trueSolar % 1440) + 1440) % 1440;
  let hourAngle = trueSolarMin / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const lat = rad(latDeg);
  const dec = rad(declinationDeg);
  let cosZenith = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(rad(hourAngle));
  cosZenith = Math.min(1, Math.max(-1, cosZenith));
  const zenithDeg = deg(Math.acos(cosZenith));
  const elevationDeg = 90 - zenithDeg;

  const azimuthDenom = Math.cos(lat) * Math.sin(rad(zenithDeg));
  let azimuth: number;
  if (Math.abs(azimuthDenom) > 0.001) {
    let cosAz = (Math.sin(lat) * Math.cos(rad(zenithDeg)) - Math.sin(dec)) / azimuthDenom;
    cosAz = Math.min(1, Math.max(-1, cosAz));
    azimuth = 180 - deg(Math.acos(cosAz));
    if (hourAngle > 0) azimuth = -azimuth;
  } else {
    azimuth = latDeg > 0 ? 180 : 0;
  }
  if (azimuth < 0) azimuth += 360;
  return { azimuthDeg: wrap360(azimuth), elevationDeg, declinationDeg };
}

function declinationAtNoon(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return orbit(year, month, day, 12 * 60).declinationDeg;
}

export function sunDay(date: LocalDate): SunDay {
  const declinationDeg = declinationAtNoon(date);
  for (const day of REFERENCE_DAYS) {
    if (date === REFERENCE_DATES[day]) return { date, declinationDeg, from: day, to: day, t: 0 };
  }

  const refs = REFERENCE_DAYS.map((day) => ({ day, decl: declinationAtNoon(REFERENCE_DATES[day]) })).sort(
    (a, b) => a.decl - b.decl,
  );
  const low = refs[0];
  const high = refs[refs.length - 1];
  if (low === undefined || high === undefined) throw new RangeError("no reference days");
  if (declinationDeg <= low.decl) return { date, declinationDeg, from: low.day, to: low.day, t: 0 };
  if (declinationDeg >= high.decl) return { date, declinationDeg, from: high.day, to: high.day, t: 0 };

  let from = low;
  let to = refs[1] ?? high;
  for (let i = 0; i < refs.length - 1; i++) {
    const left = refs[i];
    const right = refs[i + 1];
    if (left !== undefined && right !== undefined && declinationDeg >= left.decl && declinationDeg <= right.decl) {
      from = left;
      to = right;
      break;
    }
  }
  const span = to.decl - from.decl;
  const t = span === 0 ? 0 : (declinationDeg - from.decl) / span;
  return { date, declinationDeg, from: from.day, to: to.day, t };
}

export function sunPosition(at: LocalDateTime, location: LngLat): SunPosition {
  if (!Number.isFinite(at.minutes)) throw new RangeError(`bad minutes: ${at.minutes}`);
  const lng = location[0];
  const lat = location[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new RangeError("bad location");
  const { year, month, day } = parseLocalDate(at.date);
  const position = sunAt(year, month, day, at.minutes, lat, lng);
  return { azimuthDeg: position.azimuthDeg, elevationDeg: position.elevationDeg };
}

export function interpolateSunFraction(
  values: Readonly<Record<ReferenceDay, number | null>>,
  day: SunDay,
): number | null {
  const from = values[day.from];
  const to = values[day.to];
  if (day.from === day.to || day.t <= 0) return from;
  if (day.t >= 1) return to;
  if (from === null || to === null) return null;
  return (1 - day.t) * from + day.t * to;
}
