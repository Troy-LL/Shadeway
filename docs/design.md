# Design

Proposals, not yet checked against renders. A build that departs from this file updates it in place.

Feel: Apple Maps. The map is the screen. Text is minimal and navigation is obvious. The map is always flat 2D and shows the shadows along the route.

## Principles

- Full-bleed map. One bottom sheet. One primary action per screen.
- Fewest words. Numbers over sentences.
- Sun and shade are never told by color alone.
- Amber and teal are data colors for sun and shade only. The blue is the only interface accent.
- Text never uses amber on a light surface. Numbers stay ink.
- The accuracy label is always visible on a route. See [decisions/002-honest-data-labels.md](decisions/002-honest-data-labels.md).

## Layout

- Bottom sheet with three detents: peek, half, full. Drag, tap the grabber, or press Up and Down when it has focus.
- Floating controls over the map, top right: a locate button when added.
- Attribution bottom left of the map, text from the tile manifest (see decision 004). On a phone it is one line, "© OpenStreetMap, Overture, Google", plus an info button labeled "Sources". The button opens the full manifest text. A wide window shows that full text in place.
- On a wide window the sheet is a floating column on the left, about 420 px, instead of the full width.

## Screens

### Search

- Map shows BGC, flat, north up.
- Sheet at peek: a field with the placeholder "Where to?", then two large rows, "Bonifacio High Street" and "Market! Market!".
- The field filters named places from the pilot build. The first pick is the start. The next pick, a row, or a map tap sets the end and opens Compare.
- Full detent: "Leave now" and recents. "Leave now" opens a time picker on the 30 minute slot grid.
- Primary action: choose a destination, which opens Compare.

### Compare

- Sheet at half. Three route cards, in this order: Fastest, Balanced, Shadiest. Shadiest is selected.
- Card: minutes in sun as the headline, the route name, total time, a shade strip, and the badge "Building-only estimate, no trees".
- Shade strip: one bar for the route length. Shaded stretches are solid teal. Sunny stretches are amber with a diagonal hatch.
- Selected route is drawn on the map with its shadows. Tapping another card swaps it in under 200 ms.
- When the shadiest walk is the same route as the fastest, the Shadiest card says "Same route as Fastest".
- Under the cards, a slim time scrubber on the 30 minute slot grid. It starts at the chosen departure. A "Now" button snaps to the current slot. Dragging the scrubber recolors the shade strip and the shadows from precomputed slots, with no new fetch. Outside the precomputed slots it stops at the nearest one.
- Primary action: "Start". "Leave now" stays on Search, in the full detent.

### In-route

- Camera follows the position, flat, heading up.
- Top banner: next turn and the street name when the graph has a name. This graph does not, so the banner says "Keep going" and the distance.
- Sheet at peek: the Estimate badge, minutes left, minutes in sun left, the label "Building-only estimate, no trees", and "End". The peek fits those lines, including the safe area.
- Sheet text is 15 or larger. Minutes in sun stays at 34.
- Off route: banner "Off route" with the action "Reroute", which reruns the router from the current position.
- The position advances with elapsed time. Minutes left, minutes in sun left, and the distance shrink. The shade slot shifts by that elapsed time. The app does not fetch a new route for that shift.

## Map

- Flat basemap of roads, parks, and water from OpenStreetMap, plus place labels. No building fills or extrusions. Pitch and bearing stay at zero. Map rotation and pitch gestures are off.
- Shadow polygons for the selected slot sit as a soft translucent layer, and the route line sits on top. Shadows follow the scrubber.
- Camera moves on route fit and in-route follow animate in 350 ms or less. With reduced motion they cut.

## Shade styling

- Route line, sunny stretch: amber, thick, with a white casing.
- Route line, shaded stretch: teal, thinner, with a 1 px white casing in 2D so it reads on a shadow polygon.
- Shadow polygons: ink at low opacity. Edge dashed where the building height is estimated.
- Canopy (phase two): green tint at lower opacity than building shadow, never the same fill. Card detail row says tree data may be out of date.
- Covered walkways and bridges: drawn as a teal line with a thin roof tick, and counted as shade.
- Estimated height is never hidden: dashed edge in the map, and a count in the card's detail row.

## States

- Loading tiles: map is visible, sheet shows a shimmer card. Copy: "Loading shade".
- No route: "No walking route found". The place rows stay so another pair can be chosen.
- Outside the pilot box: "Outside the pilot area". Shows the pilot box outline. The place rows stay.
- Night or before sunrise: "Sun is down. Showing the shortest walk." Only the Fastest card shows.
- Offline: "Offline". Cached tiles still route if loaded.
- Location denied: the locate button shows disabled, Search still works.
- Tile failed: "Could not load shade" with the action "Try again".
- Confidence: badge values `Estimate`, `Estimate + canopy`, `Checked`, as set by decision 002.

## Copy

All strings, exact. No em dashes.

- "Where to?"
- "Leave now"
- "Now"
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
- "Keep going"
- "© OpenStreetMap, Overture, Google"
- "Sources"

## Tokens

- Color: sun amber `#F5A524`, shade teal `#1F7A8C`, ink `#14202B`, surface `rgba(255,255,255,0.82)` with background blur, surface dark `rgba(28,32,38,0.82)`, text `#111418`, text secondary `#5B6570`, accent blue `#0A84FF` for primary buttons and the selected route card outline.
- Type: system font stack. Sizes 34, 22, 17, 15, 13. Minutes in sun uses 34, semibold.
- Radius: 14 for cards, 20 for the sheet top corners, full for the toggle.
- Spacing: 4 point grid.
- Motion: sheet and camera use a spring of about 300 ms. Honor reduced motion.
- Touch targets: 44 px or larger.
- Contrast: text 4.5 to 1 or better against its surface. Amber and teal are for lines and fills, checked against the map in both modes on the first render.
- Dark mode data colors: lift teal and amber one step lighter, lower shadow opacity, and darken building tops one step. Amber and teal stay the data colors.
- Dark mode follows the system.

## Focus and keyboard

- Tab order: toggle, locate, sheet grabber, sheet content, primary action.
- Cards are a radio group. Arrow keys move the selection.
- Escape drops the sheet one detent.
- Visible focus ring in accent blue, 2 px.
