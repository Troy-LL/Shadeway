# 003 Static precompute, no backend

Status: Accepted

## Context

Shading every edge for every sun slot is too heavy for a phone and for the owner's laptop. Routing over a pilot-sized graph is cheap on a phone. Hosting a server adds cost and failure modes for a product that has no user data.

## Decision

We will precompute shade offline in CI and serve static files.

- Language and tooling: TypeScript in a pnpm monorepo.
- Offline pipeline: builds the OpenStreetMap walking graph, joins building footprints with heights and a canopy raster, calls `packages/shade-model`, and writes tiled static files. One byte per edge per slot.
- Client: A* in a Web Worker over the loaded tiles. No server, no API, no database.
- Map: MapLibre GL JS for the basemap, deck.gl for 3D buildings, sun lighting, and route and shadow layers.
- Hosting: Cloudflare Pages, static only. Pipeline output is published with the site.
- The pipeline runs in CI. It is not run on the owner's laptop.

## Consequences

- Cost is hosting static files. There is nothing to keep alive.
- Data is as fresh as the last pipeline run. Rebuilds are a CI action.
- Live conditions (clouds, new construction) are out of scope.
- Adding any server or runtime fetch beyond static tiles and the basemap needs a new decision that supersedes this one.
