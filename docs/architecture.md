# Architecture

Shadeway is a static web app plus an offline data pipeline. Stack and hosting are decided in [003](decisions/003-static-precompute-no-backend.md). Shade rules are in [001](decisions/001-one-shared-shade-model.md). Labels and claims are in [002](decisions/002-honest-data-labels.md).

## Context

- A walker opens the web app on a phone or laptop, picks a start and end inside the pilot area, and gets three routes with their time in the sun.
- The app loads static files from Cloudflare Pages: the web bundle, the basemap, and the shade tiles.
- CI runs the pipeline, which reads OpenStreetMap and a canopy raster and writes the shade tiles. Nothing else talks to the network at runtime.

## Packages

- `packages/contract` - types, tile codec, slot grid helpers. The schema owner. Read `packages/contract/src/index.ts` for field details.
- `packages/shade-model` - sun position, shadow polygons, edge sun fraction. Pure TypeScript, runs in Node and the browser.
- `packages/pipeline` - Node CLI. Output is `data/build/<area>/`, published with the site.
- `packages/router` - tile loader and A* in a Web Worker. No DOM.
- `apps/web` - MapLibre GL JS and deck.gl map in `src/map`, screens in `src/ui`.

## Data flow

1. Pipeline downloads the pilot extract (OpenStreetMap), builds the walking graph, joins buildings and heights, and reads the canopy raster in phase two.
2. For each edge and each slot, it samples points along the edge, tests each against the shade model, and stores the sun fraction as one byte: 0 to 254 scaled, 255 no data. Tiles are tiled by area, one file set per reference day.
3. It writes a build report: edge count, buildings by height source (measured, levels, default), override edges, and the interpolation error on one non-reference date.
4. The web app fetches the tile manifest, loads tiles that cover the corridor between start and end, and hands them to the router worker.
5. The worker runs A* with cost from [001](decisions/001-one-shared-shade-model.md) at three weights: fastest, balanced, shadiest. The slot used for an edge is the slot the walker reaches it, from the chosen departure time.
6. The map draws the chosen route and, for the corridor around it, shadow polygons computed by `packages/shade-model` for the departure slot. 3D uses extruded buildings and sun lighting from the same sun position.

Basemap: open vector tiles for the pilot box as one static file from the pipeline. Until it exists, `apps/web` uses a public OpenStreetMap-based style in dev and records the choice here. Attribution is shown on the map.

## Data sources

Pending verification. Coverage was not measured on 2026-10-26: the public OpenStreetMap query service returned errors from the build box, and a data reality check is outstanding.

- Walking graph: OpenStreetMap highway ways. Known gap: sidewalks and informal passages in Sta. Mesa may be unmapped.
- Buildings: OpenStreetMap footprints. Height and `building:levels` coverage in the pilot box is unmeasured. Track 2 reports it before shading.
- Canopy (phase two): candidates are a 1 m global canopy height map and a 10 m land cover tree class. Manila accuracy of either is unverified. Choice becomes a decision file when made.
- Overrides: hand-mapped covered walkways, viaducts, overpasses for the pilot, in `data/overrides/pilot.geojson`, each with a source note.
- Sun position: computed, no data source.

## Phases

Each bar is counted. A phase is done when every bar is true.

### Phase one: pilot, building-only estimate

Scope: pilot area, building shadows and overrides, 2D route with shadow polygons, basic 3D view.

- 1 command, `pnpm --filter @shadeway/pipeline build:pilot`, builds pilot tiles in CI with 0 failed steps.
- 3 pilot walks (PUP Sta. Mesa to each of 2 nearest LRT-2 stations, and 1 reverse) each return 3 routes: fastest, balanced, shadiest.
- Router p95 under 500 ms over 20 runs per pilot walk with 4x CPU throttle in a desktop browser.
- 3 screens exist: Search, Compare, In-route, with the states in [design.md](design.md).
- Shadow polygons and tile values agree on every fixture edge, 0 fixture edges differ by more than 0.10 sun fraction.
- Initial page load plus pilot tiles transfer 5 MB or less.
- 20 walked segments are logged and scored. The README states the match rate, or states that no rate is claimed yet. The label "Building-only estimate, no trees" is on all 3 route cards.
- Deployed to a Cloudflare Pages preview URL that returns 200.

### Phase two: canopy and 3D polish

- 1 canopy source chosen by a decision file, with a Manila check of at least 20 sample points against photos or walked observations.
- Canopy enters through `packages/shade-model` with transmittance. 0 other files compute canopy shade.
- 20 new walked segments on tree-lined streets are scored and the README match rate is updated.
- 3D: tree volumes for canopy, smooth camera moves between 2D and 3D under 400 ms, sun lighting matches the slot.
- Badge reads `Estimate + canopy` on routes that include canopy values.

### Phase three: more areas

- 3 more areas build from the same command with no code change, only an area config.
- Each area's tiles are 5 MB or less for the pilot-sized box, or the report names the reason.
- Each area has its own overrides file, possibly empty, and its own walked-segment score before any claim for that area.

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

- Read: [003](decisions/003-static-precompute-no-backend.md), [002](decisions/002-honest-data-labels.md), `packages/contract/src/index.ts`, the Data flow and Data sources sections of this file.
- Done: `build:pilot` produces graph, tiles, manifest, basemap file, and the build report; the report counts buildings by height source and prints OpenStreetMap height and levels coverage for the pilot box; overrides file loaded and applied; the pilot box covers PUP Sta. Mesa and the 2 nearest LRT-2 stations; the walked-segment log format and scorer exist (Track 7 uses them); a small fixture area builds in under 60 seconds in a test.
- Fences: owns `packages/pipeline` and `data/overrides/`; never commit raw extracts or `data/build/`; calls shade only through `packages/shade-model`; uses the stub if Track 1 has not merged.

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

### Track 6: CI and deploy

- Read: [003](decisions/003-static-precompute-no-backend.md), README.md.
- Done: CI on pull requests runs install, typecheck, test; a manual and tagged workflow runs `build:pilot` and uploads the output; Cloudflare Pages deploy with a preview URL per pull request, using the pipeline output; the secret names the owner must set are listed in README.md.
- Fences: owns `.github/` and deploy config; no secret values in the repo; no deploy to a production domain.

### Track 7: integrate phase one

- Read: this file, [002](decisions/002-honest-data-labels.md), [design.md](design.md).
- Done: web app loads real pilot tiles and routes the 3 pilot walks; every phase one bar is checked and listed with its count in the pull request; a template for logging the 20 walked segments is committed; README Status and Run sections match what runs.
- Fences: edits across packages only to fix integration; no new feature; no accuracy statement until the scorer reports.

Later tracks, split when phase one lands: canopy ingest and shade-model transmittance, 3D polish, area config and extra areas.
