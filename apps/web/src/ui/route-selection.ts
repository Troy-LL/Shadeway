import type { RouteWeight } from "@shadeway/contract";

/** Daytime user choice; shade-unavailable always surfaces fastest until coverage returns. */
export function effectiveRouteWeight(preferred: RouteWeight, shadeUnavailable: boolean): RouteWeight {
  if (shadeUnavailable) return "fastest";
  return preferred;
}
