# 005 Prior art and differentiation

Status: Accepted

## Context

Shade-aware walking routing already exists in open source, including for Metro Manila.

- undercover.ph (https://github.com/xmpuspus/undercover-ph): code MIT, data ODbL. 3D MapLibre map with moving shadows, Shaded and Sheltered modes, runs in the browser, 30 minute shade slots, OpenStreetMap heights then Google 2.5D, Meta and WRI canopy. Its area "Makati, BGC, Ortigas and Shaw" includes BGC. It says the shade model has not been field-checked. This is the closest product.
- ShadeRoute (https://github.com/eric3318/ShadeRoute): Apache-2.0. Depends on a keyed commercial shade API plus GraphHopper.
- Goofturtles/shade-route (https://github.com/Goofturtles/shade-route): MIT. Python with pvlib, OSMnx, and networkx. Demo in Portland.

The idea is not new. We cannot win by saying we route around the sun.

## Decision

We will credit prior art and differentiate on what it does not show.

- Honest shade: labels, a confidence badge, and a published match rate over walked segments ([002](002-honest-data-labels.md)).
- One shade model for route cost and drawn shadows, with a fixture test that they agree ([001](001-one-shared-shade-model.md)).
- A 3D-first map that translates to a 2D view drawing the shadows along the chosen route.
- Covered walkways, skybridges, and overpasses in BGC treated as first-class data, not a footnote.

We will not copy code from these projects. We may read their methods. Any code we do take keeps its license notice and is named in the commit that adds it.

## Consequences

- Before launch, we open undercover.ph for BGC and compare three routes by hand. If it is already equal or better on those, we revisit scope instead of shipping a copy.
- Our claims stay narrow: no "first" and no "most accurate".
- Credit goes in the README once code exists that was informed by these projects.
