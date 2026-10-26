import type { RouteWeight } from "@shadeway/contract";

/** 5 km/h, the walking speed in the decision 001 sun-seconds term. */
export const WALKING_SPEED_MPS = 1.4;

/**
 * Meters charged for one second in direct sun.
 * Fastest ignores sun. Balanced and shadiest raise that charge.
 */
export const METERS_PER_SUN_SECOND: Readonly<Record<RouteWeight, number>> = {
  fastest: 0,
  balanced: 2,
  shadiest: 20,
};

export interface EdgeWalk {
  readonly cost: number;
  readonly durationS: number;
  readonly sunSeconds: number;
  readonly noDataSeconds: number;
}

/** Distance plus weight times sun-seconds. A missing fraction costs as full sun and is not counted as sun. */
export function walkEdge(lengthM: number, sunFraction: number | null, metersPerSunSecond: number): EdgeWalk {
  const durationS = lengthM / WALKING_SPEED_MPS;
  if (sunFraction === null) {
    return {
      cost: lengthM + metersPerSunSecond * durationS,
      durationS,
      sunSeconds: 0,
      noDataSeconds: durationS,
    };
  }
  const sunSeconds = durationS * sunFraction;
  return {
    cost: lengthM + metersPerSunSecond * sunSeconds,
    durationS,
    sunSeconds,
    noDataSeconds: 0,
  };
}
