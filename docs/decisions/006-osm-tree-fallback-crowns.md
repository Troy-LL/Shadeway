# 006 OSM tree fallback crowns

Status: Accepted (supersedes decision 004, canopy OSM tree points line only)

## Context

The Meta and WRI canopy raster does not resolve every street tree in BGC. OSM lists individual `natural=tree` and `tree_row` nodes in the pilot area. Decision 004 said OSM tree points are not used. ENG-022 needs a fallback when the raster has no crown over a mapped tree.

## Decision

When building pilot tiles with canopy enabled, the pipeline may add fallback tree crowns from OpenStreetMap `natural=tree` and `tree_row` points when no raster crown covers that location. Fallback crowns use a fixed small footprint, a default height, and a higher transmittance than raster crowns so they remain partial shade. Raster crowns stay the primary source; the build report counts raster crowns and OSM fallback crowns separately.

This supersedes only decision 004 line 29 ("OSM tree points are not used"). All other 004 rules, including the out-of-date tree imagery copy in the UI, stay in force.

## Consequences

- Fallback count is reported in the build report and must stay visible to reviewers.
- A later decision is required before using OSM trees without the raster layer or before changing the fallback height rule.
