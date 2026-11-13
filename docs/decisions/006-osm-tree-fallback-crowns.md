# 006 OSM tree fallback crowns

Status: Accepted (supersedes decision 004, canopy OSM tree points line only)

## Context

The Meta and WRI canopy raster does not resolve every street tree in BGC. OpenStreetMap lists individual `natural=tree` nodes in the pilot area. Decision 004 said OSM tree points are not used. ENG-022 needs a fallback when the raster has no crown over a mapped tree point.

## Decision

Allow OSM tree points as a fallback.

When building pilot tiles with canopy enabled, the pipeline may add one fallback crown per `natural=tree` node when no raster crown lies within the skip radius. Fallback crowns use a small circular footprint, a default height, and higher transmittance than raster crowns so they remain partial shade. Raster crowns stay the primary source; the build report counts raster crowns and OSM fallback crowns separately.

OSM tree rows, lines, and areas are not used as fallbacks.

This supersedes only decision 004 line 29 on OSM tree points. All other 004 rules, including the out-of-date tree imagery copy in the UI, stay in force.

## Consequences

- Fallback count is reported in the build report and must stay visible to reviewers.
- A later decision is required before using OSM trees without the raster layer or before changing the fallback height rule.
