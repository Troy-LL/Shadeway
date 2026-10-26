/** Exact UI strings from docs/design.md Copy section and screen specs. */

export const ROUTE_ESTIMATE_LABEL = "Building-only estimate, no trees";

export const COPY = {
  whereTo: "Where to?",
  leaveNow: "Leave now",
  shadiest: "Shadiest",
  balanced: "Balanced",
  fastest: "Fastest",
  start: "Start",
  end: "End",
  reroute: "Reroute",
  tryAgain: "Try again",
  loadingShade: "Loading shade",
  offline: "Offline",
  offRoute: "Off route",
  noWalkingRoute: "No walking route found",
  outsidePilot: "Outside the pilot area",
  sunIsDown: "Sun is down. Showing the shortest walk.",
  couldNotLoadShade: "Could not load shade",
} as const;

export const PILOT_DESTINATIONS = {
  bonifacioHighStreet: "Bonifacio High Street",
  marketMarket: "Market! Market!",
} as const;

export type ConfidenceBadge = "Estimate" | "Estimate + canopy" | "Checked";

export function formatMinutes(totalMinutes: number): string {
  return `${totalMinutes} min`;
}

export function formatMinutesInSun(sunMinutes: number): string {
  return `${sunMinutes} min in sun`;
}
