# 002 Honest data labels

Status: Accepted

## Context

BGC shade is shaped by things OpenStreetMap can miss or map as plain footpaths: covered walkways, skybridges, overpasses, and awnings. Heights may be sparse and are unmeasured for BGC. BGC is also tree-lined, and until canopy is in the model sees only buildings. A confident route that is wrong on a hot afternoon costs the user real discomfort and costs the product its credibility.

## Decision

We will label what the model knows and gate every claim on measurement.

- The compare and in-route sheets show the label "Building-only estimate, no trees" once per sheet, not on each route card, until canopy is shipped and scored. After canopy is in the model but before the 20-segment field check, the label becomes "Estimate from buildings and a satellite tree map, not field-checked". That text is exact and lives in one constant. The label does not say the heights or tree map were field-checked. The 2026-10-26 build report counted 10,810 shadow casters: 339 `osm`, 126 `levels`, 9,416 `raster`, 929 `default`, 0 `override`. Raster is the source for 9,416 of them. The 929 defaults had no OSM height, no levels, and no positive sample on the 4 m grid, which can miss a footprint a 0.5 m pixel still hits. An independent check on a different box (architecture, Data sources) found that raster's mean absolute error is 26 m against 191 OSM-tagged buildings: too high on low and mid-rise, too low on towers because of the 100 m cap, with no field truth. Every height that is not an OSM `height` tag stays an estimate.
- Each route has a confidence badge with three values: `Estimate` (building shadows only), `Estimate + canopy` (phase two), `Checked` (only when walked segments on that route were scored and matched). `Checked` is never set by default.
- The pipeline treats OpenStreetMap footpath edges tagged `covered=yes`, `tunnel=building_passage`, or on a `bridge` as fully shaded. Shade that OpenStreetMap lacks goes in a hand-mapped overrides file for the pilot: covered walkways, skybridges, overpasses. Each override has a source note. The pipeline report counts edges touched by a tag rule and by an override.
- We will ground-truth 20 walked segments in BGC: sun or shade observed at a stated time, against the model's prediction for the same slot. The scorer reports the match rate and the miss list.
- Until the 20-segment field check is scored, the product may say the route uses a satellite tree map (the approved compare and in-route label) but must not claim tree shade accuracy or a match rate. After scoring, the README states the measured number, the segment count, and the date.

## Consequences

- Early users see a modest claim. That is intended.
- The walk is real work for the owner of the product, and a data file format for it must exist before the walk.
- `docs/eval.md` is created when the scorer exists and has a first scored run, not before.
- Copy changes that touch accuracy, trees, or shade quality need this file read first.
