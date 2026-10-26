import { slotStartMinutes, type ShadeModel } from "@shadeway/contract";
import { estimateHeight } from "./height";
import { edgeSunFraction, isInShadow, shadowPolygons, transmittance } from "./shadow";
import { REFERENCE_DATES, interpolateSunFraction, sunDay, sunPosition } from "./sun";

export { REFERENCE_DATES };

export const shadeModel: ShadeModel = {
  sunDay,
  sunPosition,
  referenceSunPosition(day, slot, location) {
    return sunPosition({ date: REFERENCE_DATES[day], minutes: slotStartMinutes(slot) }, location);
  },
  estimateHeight,
  shadowPolygons,
  isInShadow,
  transmittance,
  edgeSunFraction,
  interpolateSunFraction,
};
