/** Tag rules from decision 002. A skybridge is a bridge, and a building passage is covered. */
export function shadeFlags(tags: Record<string, string>): { covered: boolean; bridge: boolean } {
  const bridgeTag = tags.bridge;
  const bridge = bridgeTag !== undefined && bridgeTag !== "no" && bridgeTag !== "false";
  const covered = tags.covered === "yes" || tags.tunnel === "building_passage";
  return { covered, bridge };
}

export function isFullyShaded(flags: { covered: boolean; bridge: boolean }): boolean {
  return flags.covered || flags.bridge;
}
