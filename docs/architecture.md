# Architecture

Shadeway is a static web app plus an offline data pipeline. Stack and hosting are decided in [003](decisions/003-static-precompute-no-backend.md). Shade rules are in [001](decisions/001-one-shared-shade-model.md). Labels and claims are in [002](decisions/002-honest-data-labels.md).

## Context

- A walker opens the web app on a phone or laptop, picks a start and end inside the pilot area (BGC, Taguig), and gets three routes with their time in the sun.
- The app loads static files from the local dev server: the web bundle, the basemap, and the shade tiles.
- A local `build:pilot` run, or the manual pilot-build workflow, writes the shade tiles. Nothing else talks to the network at runtime.

## Packages

- `packages/contract` - types, tile codec, slot grid helpers. The schema owner. Read `packages/contract/src/index.ts` for field details.
- `packages/shade-model` - sun position, shadow polygons, edge sun fraction. Pure TypeScript, runs in Node and the browser.
- `packages/pipeline` - Node CLI. Output is `data/build/<area>/`, served with the local app.
- `packages/router` - tile loader and A* in a Web Worker. No DOM.
- `apps/web` - MapLibre GL JS and deck.gl map in `src/map`, screens in `src/ui`.

## Data flow

1. Pipeline downloads the pilot extract (OpenStreetMap, Overture buildings), builds the walking graph, joins buildings and heights per [004](decisions/004-data-sources-and-licenses.md), applies covered and bridge tags and overrides, and reads the canopy raster in phase two.
2. For each edge and each slot, it samples points along the edge, tests each against the shade model, and stores the sun fraction as one byte: 0 to 254 scaled, 255 no data. Tiles are tiled by area, one file set per reference day.
3. It writes a build report: edge count, buildings by height source (`osm`, `levels`, `raster`, `default`, `override`), covered edges, bridge edges, override edges, and the mean absolute error of sun fraction at 12:00 Asia/Manila on 2026-05-01 against the reference-day interpolation, on edges that are not forced to full shade.
4. The web app fetches the tile manifest, loads tiles that cover the corridor between start and end, and hands them to the router worker.
5. The worker runs A* with cost from [001](decisions/001-one-shared-shade-model.md) at three weights: fastest, balanced, shadiest. The slot used for an edge is the slot the walker reaches it, from the chosen departure time.
6. The map draws the chosen route and, for the corridor around it, shadow polygons computed by `packages/shade-model` for the departure slot. 3D uses extruded buildings and sun lighting from the same sun position.

Basemap: `build:pilot` writes `data/build/bgc/basemap.geojson`, one static GeoJSON file of the walking graph and the building footprints for the pilot box. It is not a vector-tile archive. A PMTiles or MVT extract was not built: the pipeline does not download a planet basemap and has no vector-tile encoder. `apps/web` can load this GeoJSON, or keep a public OpenStreetMap-based style in dev. Attribution is shown on the map from the tile manifest.

## Data sources

Sources, order, and licenses are decided in [004](decisions/004-data-sources-and-licenses.md). Coverage over the pilot box was measured on 2026-10-26 by the pipeline `measure` command.

- Pilot box: BGC, Taguig. Bounding box lat 14.5415 to 14.5628, lon 121.0417 to 121.0603, set in the pipeline config. Checked against the OpenStreetMap walkable grid on 2026-10-26. The north edge moved from 14.5598 to 14.5628 so the rectangle reaches Kalayaan Avenue, which bends north through the numbered avenues. The south edge moved from 14.5418 to 14.5415 so the south end of 5th Avenue is inside. The rectangle also includes some streets north of Kalayaan where that avenue bends south. McKinley Hill stays outside.
- Graph: OpenStreetMap footpaths, crossings, covered and bridge tags. Measured 2026-10-26 from https://overpass-api.de/api/interpreter (OSM timestamp 2026-10-26T12:01:36Z): 1,974 footpath edges, 24 `covered=yes` edges, 41 pedestrian bridge edges. Footpath edges are linear ways tagged `highway` footway, sidewalk, pedestrian, path, steps, crossing, or corridor, excluding `access=private` and `area=yes`, split at junctions, and kept when the segment meets the box.
- Buildings: Overture footprints, release 2026-10-21.0 (https://docs.overturemaps.org/blog/2026/10/21/release-notes/, OSM cutoff 2026-09-12), from `s3://overturemaps-us-west-2/release/2026-10-21.0/theme=buildings/type=building/`. Measured 2026-10-26, centroid in the box: 10,643 buildings, 191 with `height`, 302 with `num_floors` (Overture's field for OSM `building:levels`), 10,397 with a Google raster height.
- Google 2.5D Temporal raster over BGC: present. Tile https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/3397c_2023_06_30/tile_IQqvgG9RLG4.tif (manifest https://storage.googleapis.com/open-buildings-temporal-data/v1/manifests/33_EPSG_32651_2023_06_30.json, inference 2023-06-30, imagery 2023-01-01 to 2023-12-27). 10,397 of 10,643 footprints contain a height pixel above 0. Caps at 100 m, and the sampled window reaches 100 m.
- Canopy (phase two): Meta and WRI 1 m raster, https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/132303122.tif (object last modified 2024-04-10). Measured 2026-10-26: 292,158 pixels at 3 m or more, out of 3,556,434 pixels whose centers fall in the box (8.2%). Whether canopy lands inside building footprints is still unmeasured.
- OpenStreetMap tree points: 479 nodes tagged `natural=tree` in the box, same Overpass extract, measured 2026-10-26.
- Context from a different area, not BGC: in a 2 km box around PUP Sta. Mesa, OpenStreetMap had 9,409 buildings, 15 with `height` and 86 with `building:levels`. Expect BGC to differ. That is why measuring comes first.
- Overrides: tag rules plus `data/overrides/` for covered walkways, skybridges, overpasses, and the tallest tower heights, each with a source note.
- Sun position: computed, no data source.

Counts measured in place by Track 2 part A: buildings 10,643, with `height` 191, with `building:levels` 302, with raster height 10,397, footpath edges 1,974, `covered=yes` edges 24, pedestrian bridge edges 41, canopy pixels at 3 m or more 292,158, tree points 479.

### Independent cross-check

A second measurement, not a replacement for the nine counts above. Bori, 2026-10-26, box lat 14.5418 to 14.5598, lon 121.0417 to 121.0603, centred on the OpenStreetMap Nominatim point for Bonifacio Global City (14.5508 N, 121.0510 E). Our box is the pipeline config: lat 14.5415 to 14.5628, lon 121.0417 to 121.0603. The north edge is 14.5628 so the rectangle reaches Kalayaan Avenue, and the south edge is 14.5415. We count an Overture building when its centroid is inside the box. Bori counted OSM ways that touch the box, and Overture buildings fully inside the box.

- Google raster heights have mean absolute error 26 m against 191 OSM-tagged buildings (tag `height`, otherwise `building:levels` times 3.74 m, after dropping footprints the raster barely sees). Too high on low and mid-rise, too low on towers because of the 100 m cap. Unverified without field truth. Our measure did not repeat that error. It counted presence: 10,397 of 10,643 footprints contain a height pixel above 0. Presence is not accuracy. The 2026-10-26 build report counted 10,810 shadow casters (10,643 building rows, 163 `building_part` rows, multipolygons split): height source `osm` 339, `levels` 126, `raster` 9,416, `default` 929, `override` 0. The 339 `osm` casters are more than the 191 building rows with `height` because parts carry their own OSM heights. The 929 defaults had no OSM height, no levels, and no positive sample on the about-4 m grid. That grid can miss a footprint the 0.5 m presence test still hits, so 929 is not a count of buildings absent from the raster.
- Covered walkways are mostly missing from OSM. Only 1.0% of the pedestrian network (0.73 km of 75.6 km) is tagged `covered=yes`. Our 24 `covered=yes` edges are graph edges in the larger box (ways split at junctions, `access=private` and `area=yes` dropped), not a length, so 24 of 1,974 is not that 1.0%.
- OSM tree nodes sit near canopy only 28% of the time (398 nodes in Bori's box, max canopy in a roughly 6 m neighbourhood). We counted 479 tree nodes in the larger box and did not repeat the canopy match. Bori's share of pixels at 3 m or more is 8.6%. Ours is 8.2% (292,158 of 3,556,434 pixel centers). Different box, different pixel test.
- undercover.ph already covers BGC. Its `metro-core` area and its `bgc` neighbourhood bbox (lon 121.040 to 121.062, lat 14.533 to 14.563) contain both boxes.
- Building totals differ for those reasons. Bori: 6,790 OSM building ways touching the box (177 with `height`, 246 with `building:levels`); 7,494 Overture buildings fully inside (168 with `height`). Ours: 10,643 Overture buildings with centroid in the larger box (191 with `height`, 302 with `num_floors`). Overture also includes Google Open Buildings and Microsoft footprints with no OSM height. Both used Overture release 2026-10-21.0. Bori counted 154 `building_part` rows fully inside the smaller box. This build kept 163 part rows with centroid in our box.
- This build's walking graph came from https://overpass.openstreetmap.fr/api/interpreter, OSM timestamp 2026-08-10T00:10:23Z, not the 2026-10-26 extract the measure used. It still counted 1,974 footpath edges, 24 `covered=yes` edges, and 41 bridge edges, the same as that measure. The report's 25 covered edges are those 24 plus 1 `tunnel=building_passage` edge. The interpolation error on 2026-05-01 at 12:00 was 0.107 sun fraction over 1,910 edges that are not forced to full shade. That number is the reference-day approximation, not a walked match rate.

## Phases

Each bar is counted. A phase is done when every bar is true.

### Phase one: pilot, building-only estimate

Scope: BGC, building shadows plus covered and bridge handling, 2D route with shadow polygons, basic 3D view.

- The Data sources section above holds 9 measured BGC counts. The independent cross-check is a second measurement over a different box and does not replace those counts.
- 1 command, `pnpm --filter @shadeway/pipeline build:pilot`, builds pilot tiles in CI with 0 failed steps.
- 3 pilot walks inside BGC, listed in the pipeline config, each return 3 routes: fastest, balanced, shadiest. At least 1 walk uses a covered walkway or overpass and at least 1 runs along a tree-lined street.
- Router p95 under 500 ms over 20 runs per pilot walk with 4x CPU throttle in a desktop browser.
- 3 screens exist: Search, Compare, In-route, with the states in [design.md](design.md).
- Shadow polygons and tile values agree on every fixture edge, 0 fixture edges differ by more than 0.10 sun fraction.
- Initial page load plus pilot tiles transfer 5 MB or less.
- 20 walked segments are logged and scored. The README states the match rate, or states that no rate is claimed yet. The label "Building-only estimate, no trees" is on all 3 route cards.

### Phase two: canopy and 3D polish

- Canopy from the Meta and WRI raster per [004](decisions/004-data-sources-and-licenses.md), with a BGC check of at least 20 sample points against photos or walked observations, including newer construction.
- Canopy enters through `packages/shade-model` with transmittance. 0 other files compute canopy shade.
- 20 new walked segments on tree-lined streets are scored and the README match rate is updated.
- 3D: tree volumes for canopy, smooth camera moves between 2D and 3D under 400 ms, sun lighting matches the slot.
- Badge reads `Estimate + canopy` on routes that include canopy values.

### Phase three: more areas

- 3 more areas build from the same command with no code change, only an area config.
- Each area's tiles are 5 MB or less for the pilot-sized box, or the report names the reason.
- Each area has its own overrides, possibly empty, and its own walked-segment score before any claim for that area.

## Build tracks

Track 0 runs first. Tracks 1 to 6 start after Track 0 merges and run in parallel. Track 7 runs last. Each track works on its own branch, owns the paths listed, and does not edit another track's paths. Contract changes go through `packages/contract` and are flagged in the track's return note.

### Track 0: workspace and contract

- Read: `README.md`, this file, [001](decisions/001-one-shared-shade-model.md).
- Done: pnpm workspace with the five packages above as empty buildable shells; strict TypeScript base config; test runner; `packages/contract` with the edge, tile manifest, slot grid, sun day, building, and route result types and the tile codec with a round-trip test; the `ShadeModel` function signatures that Tracks 1, 2 and 6 code against; root scripts `typecheck` and `test` green on `pnpm install && pnpm -r typecheck && pnpm -r test`.
- Fences: no feature code outside `packages/contract` and config files; no new runtime dependency beyond the test runner and TypeScript.

### Track 1: shade model

- Read: [001](decisions/001-one-shared-shade-model.md), [002](decisions/002-honest-data-labels.md), `packages/contract/src/index.ts`.
- Done: sun position and the slot and reference-day interpolation; building shadow polygon by sweeping footprints; point-in-shadow and edge sun fraction; height estimation with height source tags; fixtures for 3 sun positions (morning, noon, late afternoon) and 3 building shapes, each checked against hand-computed shadow tips; runs under Node and in a browser bundle with no DOM or Node-only imports.
- Fences: owns `packages/shade-model` only; no network; no canopy yet (accept a `transmittance` hook that returns 1, no more).

### Track 2: pipeline

Part A runs first and merges before part B starts shading.

- Read: [003](decisions/003-static-precompute-no-backend.md), [004](decisions/004-data-sources-and-licenses.md), [002](decisions/002-honest-data-labels.md), `packages/contract/src/index.ts`, the Data flow and Data sources sections of this file.
- Done, part A (measure BGC): a `measure` command over the provisional BGC box that prints the 9 counts listed under Data sources, including the Google raster height presence over BGC (download the raster tile once and count footprints with a value); the counts patched into this file's Data sources section in place, replacing the unverified lines they measure; the provisional box adjusted to the real walkable grid if it is wrong.
- Done, part B: `build:pilot` produces graph, tiles, manifest with attribution, basemap file, and the build report under `data/build/bgc/` (a symlink `data/build/pilot` points at that directory so the Pages script can copy it); the report counts buildings by height source and covered, bridge, and override edges; the height chain from 004 applied; tag rules and overrides loaded and applied; the 3 pilot walks and the walked-segment log format and scorer exist (Track 7 uses them); a small fixture area builds in under 60 seconds in a test. A walked-segment log is version 1 JSON: `id`, `date`, `minutes` since Asia/Manila midnight, `observed` and `predicted` of `sun` or `shade`, optional `edgeId`. `predicted` is `shade` when the sun fraction is below 0.5. `pnpm --filter @shadeway/pipeline score -- <file>` prints `match_rate`. An empty log prints `match_rate=none`.
- Fences: owns `packages/pipeline` and `data/overrides/`; never commit raw extracts, rasters, or `data/build/`; no non-commercial dataset; calls shade only through `packages/shade-model`; uses the stub if Track 1 has not merged.

### Track 3: router

- Read: [001](decisions/001-one-shared-shade-model.md), `packages/contract/src/index.ts`, the Data flow section of this file.
- Done: tile loader for a corridor; A* with cost from 001 and slot by arrival time; three weights returning fastest, balanced, shadiest; Web Worker entry with a typed message API; unit tests on a synthetic graph where the shadiest route is known and differs from the fastest; a timing test on a graph of 20,000 edges.
- Fences: owns `packages/router`; no DOM; no map code; no shade computation (reads tile bytes only).

### Track 4: web map

- Read: [design.md](design.md), [001](decisions/001-one-shared-shade-model.md), `packages/contract/src/index.ts`.
- Done: MapLibre basemap with attribution; deck.gl extruded buildings with sun lighting; 3D and 2D views and the toggle with a camera transition; route layer with sun and shade styling per design; shadow polygons for the route corridor from `packages/shade-model`; estimated-height buildings drawn with the dashed shadow edge; a `MapController` interface in `apps/web/src/map/controller.ts` that Track 5 calls (set route, set view mode, set slot, fit route, follow position).
- Fences: owns `apps/web/src/map`; no UI sheet code; no shade computation outside `packages/shade-model`.

### Track 5: web screens

- Read: [design.md](design.md), [002](decisions/002-honest-data-labels.md), `apps/web/src/map/controller.ts` (use a stub until Track 4 merges).
- Done: bottom sheet with three detents and keyboard access; Search, Compare, In-route screens; every state and copy string in design.md; tokens as CSS variables; the label constant and badge; reduced motion respected; touch targets 44 px or larger; a render test or screenshot for each screen and each state, 3 screens plus the listed states.
- Fences: owns `apps/web/src/ui`; copy strings come only from design.md; no accuracy claims; no map layer code.

### Track 6: CI

- Read: [003](decisions/003-static-precompute-no-backend.md), README.md.
- Done: CI on pull requests runs install, typecheck, test; a manual and tagged workflow runs `build:pilot` and uploads the output. There is no deploy.
- Fences: owns `.github/`; no secret values in the repo; no deploy.

### Track 7: integrate phase one

- Read: this file, [002](decisions/002-honest-data-labels.md), [005](decisions/005-prior-art-and-differentiation.md), [design.md](design.md).
- Done: web app loads real pilot tiles and routes the 3 pilot walks; every phase one bar is checked and listed with its count in the pull request; a template for logging the 20 walked segments is committed; the hand comparison of 3 BGC routes against undercover.ph from decision 005 is written up in the pull request; README Status and Run sections match what runs.
- Fences: edits across packages only to fix integration; no new feature; no accuracy statement until the scorer reports.

Later tracks, split when phase one lands: canopy ingest and shade-model transmittance, 3D polish, area config and extra areas.

## History

- 2026-10-26: Phase one dropped the bar "Deployed to a Cloudflare Pages preview URL that returns 200". Shadeway runs locally and is not deployed. The preview workflow and its Cloudflare secrets are removed. Eight phase one bars remain.
