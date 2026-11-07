/** Exact UI strings from docs/design.md Copy section and screen specs. */

export const ROUTE_ESTIMATE_LABEL = "Building-only estimate, no trees";

export const COPY = {
  whereTo: "Where to?",
  from: "From",
  to: "To",
  leaveNow: "Leave now",
  now: "Now",
  shadiest: "Shadiest",
  fastest: "Fastest",
  fastestWalk: "Fastest walk",
  availableRoute: "Available route",
  shadiestAndFastest: "Shadiest and fastest",
  shadeUnavailable: "Shade unavailable",
  shadeHours: "Shade estimates available 06:00–18:00",
  routeOverview: "Route overview · live position unavailable",
  locationOff: "Location off",
  droppedPin: "Dropped pin",
  start: "Start",
  end: "End",
  back: "Back",
  showRoute: "Show route",
  swap: "Swap start and end",
  expandSheet: "Expand sheet",
  collapseSheet: "Collapse sheet",
  tryAgain: "Try again",
  loadingShade: "Loading shade",
  offline: "Offline",
  noWalkingRoute: "No walking route found",
  noMatchingPlace: "No matching place in the pilot area",
  outsidePilot: "Outside the pilot area",
  couldNotLoadShade: "Could not load shade",
  attributionShort: "© OpenStreetMap, Overture, Google",
  sources: "Sources",
} as const;

export type ConfidenceBadge = "Estimate" | "Estimate + canopy" | "Checked";

export function formatMinutes(totalMinutes: number): string {
  return `${totalMinutes} min`;
}

export function formatMinutesInSun(sunMinutes: number | null, shadeUnavailable = false): string {
  if (shadeUnavailable || sunMinutes === null) return COPY.shadeUnavailable;
  return `${sunMinutes} min in sun`;
}

export function formatDistanceM(distanceM: number): string {
  return `${Math.round(distanceM)} m`;
}
