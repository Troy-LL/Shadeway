# Hand comparison with undercover.ph

Compared on 2026-10-26. Shadeway numbers are the three pilot walks in `packages/pipeline/src/config.ts`, routed in the browser at 12:00 Asia/Manila on that date. undercover.ph numbers are from the live site, Shaded mode, area `metro-core`, same date at 12:00. No code or data was copied. The site searches named places, so each undercover walk uses the nearest named place to the pilot coordinates. The drawn lines were not checked street by street. Offsets below are approximate metres from the pilot point to that place.

## high-street-covered

Pilot ends: 121.04760, 14.55152 and 121.04606, 14.55202. The pipeline note is OSM way 846184128, `covered=yes`.

Shadeway: Fastest, Balanced, and Shadiest are the same walk. 2 min, 0 min in sun, 175 m, 12 edges. The Shadiest card says "Same route as Fastest".

undercover.ph: BGC Portal (about 35 m from the start) to Alab Ng Puso (about 14 m from the end).

- Shortest: 4 min, 220 m, 1.2 min in sun, 65% shaded. Roof 0%, building shade 66%, tree shade 0%.
- Recommended: 4 min, 220 m, 54 sec in sun, 74% shaded. Roof 0%, building shade 74%, tree shade 0%. It says the walk uses stairs. There is no separate most-shaded card.

Verdict: Shadeway reports no time in sun because the way is tagged covered. undercover.ph reports about a minute in sun and no roof on the nearest named places. The walks are close in length and are not the same endpoints.

## high-street-trees

Pilot ends: 121.04862, 14.55148 and 121.05303, 14.55012. The pipeline note is the tree-lined pedestrian High Street.

Shadeway: Fastest and Balanced are the same walk, 8 min, 8 min in sun, 683 m, 41 edges. Shadiest is 13 min, 7 min in sun, 1050 m, 40 edges.

undercover.ph: Harlan + Holden Coffee (about 9 m from the start) to Seda BGC (about 82 m from the end).

- Shortest: 9 min, 560 m, 8 min in sun, 5% shaded. Roof 0%, building shade 0%, tree shade 5%.
- Recommended: 10 min, 620 m, 5.3 min in sun, 44% shaded. Building shade 42%, tree shade 2%.
- Most shaded: 12 min, 770 m, 3.9 min in sun, 67% shaded. Building shade 63%, tree shade 5%.

Verdict: The shortest walks agree that this street is mostly in the sun at noon (Shadeway 8 of 8 minutes, undercover.ph 8 of 9). Shadeway's shadier walk saves 1 minute of sun and adds 5 minutes of walking, from buildings only. undercover.ph's most shaded walk cuts sun from 8 minutes to 3.9 and attributes part of the cover to trees. On this pair, undercover.ph is the more shaded recommendation. Shadeway does not claim tree shade.

## uptown-footbridge

Pilot ends: 121.05415, 14.55697 and 121.05439, 14.55879. The pipeline note is OSM way 613886961, `bridge=viaduct`.

Shadeway: Fastest, Balanced, and Shadiest are the same walk. 3 min, 0 min in sun, 255 m, 3 edges.

undercover.ph: Uptown Mall Sky Park (about 74 m from the start) to Uptown Parade (about 83 m from the end). One route, recommended and shortest: 4 min, 260 m, 2.2 min in sun, 46% shaded. Roof 0%, building shade 46%, tree shade 0%. It says the walk uses stairs, passes through a building whose cover is not checked, and that 96% of the building shade comes from estimated heights.

Verdict: Length is close. Shadeway reports no time in sun because the edge is a bridge. undercover.ph still counts 2.2 minutes in sun and no roof. The endpoints differ by tens of metres, so this is not proof the two lines are the same footbridge.

## What was not verified

- The map polylines were not overlayed. Place search was the only way to set undercover.ph ends.
- A Starbucks search near the footbridge snapped to a different Starbucks and a 14 minute walk. That result is discarded.
- Step-free mode was not part of the comparison. One try, Uptown Mall Sky Park to Uptown Parade, returned no step-free route.
- Neither product has a walked match rate for these streets.
