# Design

Proposals, not yet checked against renders. A build that departs from this file updates it in place.

Feel: Apple Maps. The map is the screen. Text is minimal and navigation is obvious. 3D is the default, 2D is one tap away and shows the shadows along the route.

## Principles

- Full-bleed map. One bottom sheet. One primary action per screen.
- Fewest words. Numbers over sentences.
- Sun and shade are never told by color alone.
- Amber and teal are data colors for sun and shade only. The blue is the only interface accent.
- Text never uses amber on a light surface. Numbers stay ink.
- The accuracy label is always visible on a route. See [decisions/002-honest-data-labels.md](decisions/002-honest-data-labels.md).

## Layout

- Bottom sheet with three detents: peek, half, full. Drag, tap the grabber, or press Up and Down when it has focus.
- Floating controls over the map, top right: view toggle, then a locate button.
- Attribution bottom left of the map, text from the tile manifest (see decision 004).

## Screens

### Search

- Map shows BGC, 3D, pitched.
- Sheet at peek: a field with the placeholder "Where to?".
- The field filters named places from the pilot build. The first pick is the start. The next pick, a chip, or a map tap sets the end and opens Compare.
- Half detent: two pilot chips, "Bonifacio High Street" and "Market! Market!", then recents.
- A chip "Leave now" opens a time picker on the 30 minute slot grid.
- Primary action: choose a destination, which opens Compare.

### Compare

- Sheet at half. Three route cards, in this order: Shadiest, Balanced, Fastest. Shadiest is selected.
- Card: total time, minutes in sun (largest number), a shade strip, and the badge "Building-only estimate, no trees".
- Shade strip: one bar for the route length. Shaded stretches are solid teal. Sunny stretches are amber with a diagonal hatch.
- Selected route is drawn on the map with its shadows. Tapping another card swaps it in under 200 ms.
- Under the cards, a slim time scrubber on the 30 minute slot grid. It starts at the chosen departure and snaps to Now. Dragging it recolors the shade strip and the shadows from precomputed slots, with no new fetch. Outside the precomputed slots it stops at the nearest one.
- When the shadiest walk is the same route as the fastest, the Shadiest card says "Same route as Fastest".
- Primary action: "Start". "Leave now" and the other chips are secondary.

### In-route

- Camera follows the position. 3D pitches behind the walker. 2D is heading up.
- Top banner: next turn and distance.
- Sheet at peek: minutes left, minutes in sun left, and "End".
- Sheet text is 15 or larger. Minutes in sun stays at 34.
- Off route: banner "Off route" with the action "Reroute", which reruns the router from the current position.
- Does not recompute shade live. It uses the slot of the departure time, shifted by elapsed time.

## 3D and 2D

- Toggle is a two-segment control: "3D" and "2D". Selected segment is filled. The choice persists.
- 3D: extruded buildings, sun light from the slot, soft shadows on the ground, route ribbon above the road.
- 2D: flat map, building footprints, shadow polygons under the route corridor only, route line on top.
- Switching animates the camera pitch in 350 ms or less. With reduced motion it cuts.
- When WebGL is unavailable the app opens in 2D and hides the toggle.

## Shade styling

- Route line, sunny stretch: amber, thick, with a white casing.
- Route line, shaded stretch: teal, thinner, no casing.
- Shadow polygons: ink at low opacity. Edge dashed where the building height is estimated.
- Canopy (phase two): green tint at lower opacity than building shadow, never the same fill. Card detail row says tree data may be out of date.
- Covered walkways and bridges: drawn as a teal line with a thin roof tick, and counted as shade.
- Estimated height is never hidden: dashed edge in the map, and a count in the card's detail row.

## States

- Loading tiles: map is visible, sheet shows a shimmer card. Copy: "Loading shade".
- No route: "No walking route found".
- Outside the pilot box: "Outside the pilot area". Shows the pilot box outline.
- Night or before sunrise: "Sun is down. Showing the shortest walk." Only the Fastest card shows.
- Offline: "Offline". Cached tiles still route if loaded.
- Location denied: the locate button shows disabled, Search still works.
- Tile failed: "Could not load shade" with the action "Try again".
- Confidence: badge values `Estimate`, `Estimate + canopy`, `Checked`, as set by decision 002.

## Copy

All strings, exact. No em dashes.

- "Where to?"
- "Leave now"
- "Shadiest", "Balanced", "Fastest"
- "{n} min", "{n} min in sun"
- "Building-only estimate, no trees"
- "Start", "End", "Reroute", "Try again"
- "Loading shade", "Offline", "Off route"
- "No walking route found"
- "Outside the pilot area"
- "Sun is down. Showing the shortest walk."
- "Could not load shade"
- "Same route as Fastest"

## Tokens

- Color: sun amber `#F5A524`, shade teal `#1F7A8C`, ink `#14202B`, surface `rgba(255,255,255,0.82)` with background blur, surface dark `rgba(28,32,38,0.82)`, text `#111418`, text secondary `#5B6570`, accent blue `#0A84FF` for primary buttons and the selected route card outline.
- Type: system font stack. Sizes 34, 22, 17, 15, 13. Minutes in sun uses 34, semibold.
- Radius: 14 for cards, 20 for the sheet top corners, full for the toggle.
- Spacing: 4 point grid.
- Motion: sheet and camera use a spring of about 300 ms. Honor reduced motion.
- Touch targets: 44 px or larger.
- Contrast: text 4.5 to 1 or better against its surface. Amber and teal are for lines and fills, checked against the map in both modes on the first render.
- Dark mode data colors are proposals: lift teal and amber one step lighter and lower shadow opacity. Unverified until rendered.
- Dark mode follows the system.

## Focus and keyboard

- Tab order: toggle, locate, sheet grabber, sheet content, primary action.
- Cards are a radio group. Arrow keys move the selection.
- Escape drops the sheet one detent.
- Visible focus ring in accent blue, 2 px.
