# Shadeway

A walking router that spends less of your walk in the sun. It picks the route with the least time in direct sun, using shadows from buildings and, later, tree canopy. The map feels like Apple Maps: 3D first, with a 2D view that draws the shadows along the route you chose.

Pilot area: Bonifacio Global City (BGC), Taguig, Metro Manila. A walkable grid of towers, covered walkways, and tree-lined streets.

## Status

Docs only. No code yet. Build order and done bars are in [docs/architecture.md](docs/architecture.md).

## Read this before trusting a route

Phase one is a **building-only estimate, no trees**, and BGC has many trees that phase one ignores. Shade in BGC is also made by things OpenStreetMap can miss or map as plain footpaths: covered walkways, skybridges, overpasses, and awnings. Every route card carries the label "Building-only estimate, no trees". No accuracy figure is published until 20 walked segments have been scored. See [docs/decisions/002-honest-data-labels.md](docs/decisions/002-honest-data-labels.md).

## Who it is for

Students and commuters who walk in Manila heat and want the shadiest sensible route, not the fastest one.

## Run

Not runnable yet. Track 0 in [docs/architecture.md](docs/architecture.md) creates the workspace. These are the exact scripts it must provide:

- Install: `pnpm install` (Node 22, pnpm 10)
- Check: `pnpm -r typecheck` and `pnpm -r test`
- Build pilot data: `pnpm --filter @shadeway/pipeline build:pilot` (writes `data/build/pilot/`)
- Web dev server: `pnpm --filter @shadeway/web dev` (port 5173)

## Limits

- Pilot bounding box (BGC) only. Outside it the app says so and does not route.
- Shade is precomputed for 30 minute slots from 06:00 to 18:00 Asia/Manila on three reference days and interpolated between them.
- Data licenses and required attribution are in [docs/decisions/004-data-sources-and-licenses.md](docs/decisions/004-data-sources-and-licenses.md). Attribution is required on the map.

## Docs

- [docs/architecture.md](docs/architecture.md)
- [docs/design.md](docs/design.md)
- [docs/decisions/](docs/decisions/) (001 shade model, 002 honest labels, 003 static precompute, 004 data and licenses, 005 prior art)
