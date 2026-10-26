# 004 Data sources and licenses

Status: Accepted

## Context

Shade quality is set by building heights and canopy, and BGC data coverage is not measured yet. Sources differ in license: some require attribution, one requires share-alike, one forbids commercial use. Numbers below that come from Sta. Mesa, a different area, are context only and say nothing about BGC.

## Decision

We will use these sources, in this order, and no others without a new decision.

Footprints and graph
- Footprints: Overture Maps buildings, which conflate OpenStreetMap, Google Open Buildings, and Microsoft footprints. The theme is ODbL because it includes OpenStreetMap.
- Walking graph and tags (`covered`, `bridge`, `tunnel`, `layer`, `highway`): OpenStreetMap, ODbL.

Heights, first match wins
1. OSM `height`.
2. OSM `building:levels` times 3.74 m. The multiplier is reported by undercover.ph from Makati buildings and is unmeasured for BGC. We tune it after the BGC check.
3. Google Open Buildings 2.5D Temporal, a 4 m raster, median inside the footprint. Philippines is in its covered list. The pipeline measure found the raster present over the pilot box. It caps at 100 m and underestimates towers. An independent check on a different box (architecture, Data sources) measured mean absolute error of 26 m against 191 OSM-tagged buildings: too high on low and mid-rise, too low on towers because of the cap. That error has no field truth.
4. A default per building type, flagged `default`. The pipeline calls `estimateHeight` in `packages/shade-model` for this chain. The default that function returns is 3.74 m for every building, not a second per-type table.

Overrides
- BGC is full of towers, so the pilot keeps a hand-fixed height list for the tallest buildings, each with a source note, in `data/overrides/`. A listed height replaces the chain result. Its height source is `override`. It is not an OSM `height` tag, so decision 001 still draws it as an estimate.

Canopy (phase two)
- Meta and WRI 1 m canopy height. Threshold near 3 m. The imagery is about 2018 to 2020, so the UI says tree data may be out of date. BGC has had construction since, so the pilot walks check it.
- ETH 10 m, ESA WorldCover 10 m, and Hansen 30 m are too coarse for a street and are not used.
- OSM tree points are not used. Sta. Mesa had 12 in a 2 km box. The BGC count is measured by the pipeline and reported, and does not change this decision unless it is large.

Excluded
- GlobalBuildingAtlas: CC BY-NC 4.0, so no commercial path, and it underestimated tall buildings in a 17-building check. Not used, not as a fallback.

Licenses and attribution
- OpenStreetMap and Overture buildings: ODbL. Attribution "OpenStreetMap contributors" on the map. Tiles and graph files we publish are a derived database, so we publish them under ODbL and say so in the manifest.
- Google Open Buildings 2.5D Temporal: the page offers CC BY 4.0 or ODbL. We use CC BY 4.0 and credit Google. Compatibility with the ODbL tiles is to be confirmed before a public launch.
- Meta and WRI canopy: CC BY 4.0. Credit both.
- Microsoft footprints arrive through Overture: CDLA-Permissive-2.0.
- The attribution text lives in one constant in `packages/contract` and is written into the tile manifest. The app shows it from the manifest.

## Consequences

- Heights are the weak layer. The pipeline report counts buildings by height source, and phase one treats every non-`osm` height as an estimate on screen.
- The 100 m cap means BGC's tallest towers need the override list or they cast short shadows.
- Share-alike obliges us to publish derived data. That fits a static site and a public repo, but the repo is private today, so this is checked before launch. This is a working reading, not legal advice.
- Changing a source or license needs a new decision that supersedes this one.
