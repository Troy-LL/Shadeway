# Design

Flat 2D Shadeway UI per ENG-021. Mobile-first at 390x844, desktop side panel at 1440x900.

## Principles

- Full-bleed map. One sheet. One primary action per screen.
- Fewest words. Numbers over sentences.
- Sun and shade are never told by color alone.
- The label "Building-only estimate, no trees" appears once per Compare and In-route sheet. See [decisions/002-honest-data-labels.md](decisions/002-honest-data-labels.md).
- No simulated navigation progress, no off-route reroute, no Balanced card, no 3D view.

## Layout

- `100dvh` shell, full-bleed map, flat pitch 0.
- Phone: bottom sheet, top radius 16, safe-area padding. Desktop: left panel inset 16, width 384, radius 16, no grabber.
- Attribution bottom left from the tile manifest. On phone: short line plus Sources info button.

## Search

- From and To fields with a 44px Swap control. To placeholder "Where to?".
- Typing filters pilot places (up to three suggestions). Map tap fills the focused field. Both endpoints set opens Compare.
- Location denied: From disabled, "Location off" placeholder.

## Compare

- Header: departure chip ("Leave now" or "Leave HH:MM") and Estimate badge.
- Two route cards: Shadiest (default selected), then Fastest. 88px card: "{n} min in sun" headline, route name, total time and distance, 8px shade strip.
- Selected card: accent border and check. Map draws the inactive route in grey under the selected route.
- One sheet label "Building-only estimate, no trees" below the cards. One Start button. Back returns to Search with the same pair.
- Departure chip opens an in-sheet list: Now, then 06:00–18:00 every 30 minutes.
- Outside shaded hours or sun down: "Shade estimates available 06:00–18:00". Fastest may show "Fastest walk" with "Shade unavailable" (no sun minutes).

## In-route

- Static route overview (no live position). Status: "Route overview · live position unavailable".
- "{n} min in sun" headline, "{n} min · {n} m" totals, sheet label once, Show route and End.
- End returns to Compare with the same endpoints and departure time. Map fits the route flat.

## Map

- Flat basemap, building footprints near the route, optional shadows (fill plus estimated edge only when on; all shadow layers off by default via the Shadows map control), sun/shade route styling per ENG-021 tokens.
- Phone sheet heights use content stacks (96 / 164 / 420 / 268) plus `env(safe-area-inset-bottom)` once via `--safe-bottom`.
- No place-name labels on the map; start and end markers and attribution stay.
- Pitch and bearing 0; rotation locked.

## States

- Loading, no route, outside pilot, shade unavailable (not "sun is down"), offline, tile failed, as in copy below.

## Copy

Exact strings in `apps/web/src/ui/copy.ts`, including: "Available route", "Shadiest and fastest", "Shade unavailable", "Fastest walk", "Shade estimates available 06:00–18:00", "Route overview · live position unavailable", "Location off", ROUTE_ESTIMATE_LABEL.
