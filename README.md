# Shadeway

A walking router that spends less of your walk in the sun. It picks the route with the least time in direct sun, using shadows from buildings and, when pilot tiles include canopy, a satellite tree map. The map is a flat 2D view that draws building and tree shadows along the route you chose.

Pilot area: Bonifacio Global City (BGC), Taguig, Metro Manila. A walkable grid of towers, covered walkways, and tree-lined streets.

## Status

6 of 8 phase one bars met. The six met bars are engineering bars. The only truth bar, walked segments scored, is unmet. Bars are listed in [docs/architecture.md](docs/architecture.md). No walked match rate is claimed: the log at `data/walks/bgc.json` has 0 segments.

Met:

- The Data sources section holds the 9 measured BGC counts.
- The 3 pilot walks each return Fastest, Balanced, and Shadiest. At noon on 2026-10-26 the covered High Street walk and the Uptown footbridge are 0 min in sun because the way is tagged covered or bridge in OSM, not because a shadow pass found shade. The tree-lined High Street walk is 6 minutes in sun on Fastest (6 min, 518 m) and 4 minutes in sun on Shadiest (9 min, 784 m).
- With canopy-built tiles, the label "Estimate from buildings and a satellite tree map, not field-checked" appears once per Compare and In-route sheet, with the Estimate + canopy badge when trees loaded. Building-only tiles still show "Building-only estimate, no trees".
- Router p95 is under 500 ms. Headless Chromium, 4x CPU throttle, one warmup, then 20 worker round trips per walk at noon. p95 is the 19th sorted sample: covered walk 18.9 ms, tree-lined walk 19.1 ms, footbridge 15.0 ms.
- Search, Compare, and In-route run on the pilot tiles. Screenshots are in `apps/web/screenshots/`.
- Fixture shadow polygons and tile bytes agree inside 0.10 sun fraction (`packages/pipeline` build test, compared to 0.01).
- Built page load plus pilot files transfer under 5 MB. `vite preview` in headless Chromium, `transferSize` about 1.50 MB with a canopy pilot build. The dev server serves unminified modules and is not the bar.

Not met:

- `build:pilot` succeeds locally. It has not been run in CI. The manual workflow `.github/workflows/pilot-build.yml` has no completed run, and the pull-request `check` job does not build tiles.
- 20 walked segments are not logged. 0 segments scored. No match rate is claimed.

A hand comparison of the 3 walks with undercover.ph is in [docs/prior-art-comparison.md](docs/prior-art-comparison.md).

## Read this before trusting a route

Pilot tiles may include building-only shade or building plus satellite tree canopy (`build:pilot -- --canopy path.tif`). The UI label matches what loaded: building-only copy until canopy is in the manifest, then the approved estimate string in decision 002. Tree imagery may be out of date. BGC shade is also made by things OpenStreetMap can miss: covered walkways, skybridges, overpasses, and awnings. No accuracy figure is published until 20 walked segments have been scored. See [docs/decisions/002-honest-data-labels.md](docs/decisions/002-honest-data-labels.md).

## Who it is for

Students and commuters who walk in Manila heat and want the shadiest sensible route, not the fastest one.

## Run locally

Shadeway is not deployed. Install, build the pilot tiles, then start the dev server.

- Install: `pnpm install` (Node 22, pnpm 10)
- Check: `pnpm -r typecheck` and `pnpm -r test`
- Pilot tiles: `pnpm --filter @shadeway/pipeline build:pilot`
- App: `pnpm --filter @shadeway/web dev` (http://127.0.0.1:5173)

`build:pilot` reads OpenStreetMap, Overture building footprints, and the Google Open Buildings height raster, optionally a local canopy height GeoTIFF (`--canopy`), then writes `data/build/bgc/` (graph, shade tiles, basemap, place names). Optional CHM comes from `scripts/canopy-model/run_canopy.py` on RGB imagery. That directory is not committed. The dev server serves it at `/data/bgc/`. A symlink `data/build/pilot` points at the same files for the manual pilot-build workflow. Walk notes for a future scored sample live in `data/walks/bgc.json` (empty; no match rate is claimed).

## Limits

- Pilot bounding box (BGC) only. Outside it the app says so and does not route.
- Shade is precomputed for 30 minute slots from 06:00 to 18:00 Asia/Manila on three reference days and interpolated between them.
- Data licenses and required attribution are in [docs/decisions/004-data-sources-and-licenses.md](docs/decisions/004-data-sources-and-licenses.md). Attribution is required on the map.

## Docs

- [docs/architecture.md](docs/architecture.md)
- [docs/design.md](docs/design.md)
- [docs/decisions/](docs/decisions/) (001 shade model, 002 honest labels, 003 static precompute, 004 data and licenses, 005 prior art)
