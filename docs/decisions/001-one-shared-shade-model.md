# 001 One shared shade model

Status: Accepted

## Context

The route cost and the shadows drawn on the map can disagree if they come from two codepaths. A route that is called shady while the map shows it in the sun destroys trust. Both need the same sun position, the same obstacles, and the same slot grid.

## Decision

We will compute shade in one package, `packages/shade-model`, pure TypeScript with no DOM and no Node-only imports, so the offline pipeline and the browser run identical code.

- Sun: solar position for a date and time at the pilot location, in Asia/Manila local time.
- Buildings are opaque. A building's shadow is its footprint swept along the sun azimuth by height divided by tan(elevation).
- Canopy (phase two) is partial transmittance, a value between 0 and 1 per canopy cell, never opaque.
- Slot grid: 30 minute slots from 06:00 to 18:00 local, 25 slots a day.
- Reference days: one equinox, the June solstice, the December solstice. Other dates interpolate on solar declination between the reference days.
- Missing building heights are estimated from `building:levels` and a per-type default, and each building carries a height source: measured, levels, or default. Estimated heights are drawn with a dashed shadow edge.
- Edge cost is distance plus weight times sun-seconds, where sun-seconds is edge length divided by walking speed times the sun fraction in the slot the walker arrives.

Pipeline output (a sun fraction per edge per slot) and the polygons drawn for the chosen route both come from this package. A fixture test fails if they differ by more than 0.10 sun fraction on any fixture edge.

## Consequences

- Shade logic changes in one place, with fixtures, and both consumers get it.
- The package must stay fast enough for the browser to draw a route corridor, and exact enough for the pipeline to sample whole edges.
- Interpolating between three days is an approximation. The error against a direct computation on a non-reference date is measured in the pipeline report, not assumed.
- Any new shade source, such as canopy, enters through this package or not at all.
