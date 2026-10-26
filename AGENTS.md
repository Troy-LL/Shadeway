# Map

Load this file. Then at most two others this turn. Skip unused. Cite paths. Do not paste.

- `README.md` - what Shadeway is, the accuracy caveat, how to install, run and test
- `docs/architecture.md` - packages, data flow, data sources, phases with done bars, build tracks (Read, Done, Fences); read before starting any track
- `docs/design.md` - a screen, state, copy string, token, or map style is being built or changed
- `docs/decisions/001-one-shared-shade-model.md` - route cost or shadow drawing needs shade values; read before computing them anywhere else
- `docs/decisions/002-honest-data-labels.md` - copy, a badge, or a README line talks about accuracy, trees, or shade quality; read before writing it
- `docs/decisions/003-static-precompute-no-backend.md` - a server, API, database, or runtime data fetch looks useful; read before adding one

Commands: `pnpm install`, `pnpm -r typecheck`, `pnpm -r test`. Exact scripts per package are in README.md.

Never:
- Do not add a backend, database, or runtime call beyond static files.
- Do not compute shade or draw shadows outside `packages/shade-model`.
- Do not state an accuracy figure or say "tree" shade until the measured match rate exists.
- Do not edit a package another track owns; change its contract in `packages/contract` instead.
- Do not commit secrets, raw OSM extracts, or `data/build/`.

Park thinking in `scratch/`. Do not map it, even if they asked. Do not commit it.
