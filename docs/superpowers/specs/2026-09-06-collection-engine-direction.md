# Collection / Lab: a collection you can manipulate

Status: working interaction prototype, September 6, 2026. Supersedes the museum website direction.

The owner wants something unusual to play with and show off, inspired by interactive 3D models. The collection occupies the screen. No “Family guide” label: everyone gets the same clear object record.

## Implemented experiment

The scene contains **498 owned objects: 355 comics, 51 PSA cards (49 in the Vault), 80 TAG cards, 11 CGC cards and one Arena Club card**. Case #2 contains the 57 newly verified TAG cards and 114 exact front/back scans, including a Pristine 10 and one explicitly reported 960 score. All / Comics / Cards filters the collection. Four formations preserve grader/cert identity: orbital bands, a curved wall, container stacks and **04 Spotlight**, inspired by the original wall spotlight.

Spotlight opens onto a stable wall with a restrained warm atmosphere. Drag or scroll
to explore horizontally and vertically; pinch, the zoom buttons, or Ctrl/Command
plus wheel changes distance. Picking a copy preserves the wall position and order.
Scrolling or dragging the background returns the copy and continues browsing.
Recenter gives a quick way back to the selected row. An optional tour selects the
next object every 6.5 seconds. Manual interaction, search, record opening, changing
formation, motion-off or hiding the tab stops the tour.

Every formation has separate, outward-facing front and back scan surfaces. The
reverse uses the same copy's recorded back image, reads correctly, and participates
in picking. Picking from behind keeps the back facing the viewer. Missing reverse
scans show a labeled placeholder. Rotation pivots through the collection's depth
so turning the arrangement does not swing its rear rows through the camera.

Selecting a slab lifts it into a separate foreground pass. This fixes the reported Longbox defect where positive-depth slabs covered the selected comic. The inspector has its own camera and cleared depth buffer; the collection stays behind it. Picking uses the actual scan/holder surfaces, excluding decorative frame lines whose wide raycast threshold previously stole clicks intended for adjacent covers.

**Study replaces decorative explosion.** The source images already include grading holders, so pretending to separate manufactured parts added little. Study places the actual front and reverse scans side by side, with 100–260% zoom and drag-to-pan. Rotation and Turn over remain available in the assembled view. Scans retain their aspect ratio and original content. Glass framing does not claim to reconstruct a grader's holder geometry.

## PSA collection and source integrity

`npm run vault -- "data/incoming/My Collection CSV - 49.csv"` imports the committed export into `data/cards/psa-vault.json`. Reimport preserves scan enrichment and retains records absent from the next export for reconciliation. Cross-container duplicate ownership is rejected.

All 49 public cert pages were loaded and checked after scrolling for lazy-loaded images. Their actual viewers supplied **48 front/reverse pairs, 96 scan files**. Cert **62837377** supplied no scans. Its metadata remains with an unavailable notice; Study and Turn over are disabled for it.

`data/incoming/psa-cert-images.json` retains the discovered URLs. The scan importer only accepts the official PSA cert-image host and stores source page, URL, side basis, timestamps, dimensions and local checksum. Internal IDs are read from the page, never constructed from a cert. Similar-sale eBay images are rejected.

The export contains 45 PSA estimates and four unknown values. Its valuation date is unspecified and displayed that way; import time is separate. Acquisition cost and private notes remain local, outside the portable payload. The Vault is explicitly external storage at PSA.

The shared model and source validator recognize TAG and CGC Cards. All 14 TAG records have 28 exact MAIN scans; two earlier 404 responses resolved on retry. Case #1 contains 11 CGC cards with 22 verified scans, including reviewed side corrections for two older certificates. Current cert grades remain distinct from a legacy physical slab label. Reviewed imports and physical-case print outputs are implemented; automated report capture and production catalogue integration remain follow-on work in the [graded-cards spec](2026-09-06-graded-cards-design.md).

The owner also confirmed **Authority soft-sleeve comics** with QR-linked records.
The first ID, `1700597971`, is imported with verified front/reverse scans in `data/comics/comic-case-12.json`;
the signed-in record identifies Deathlok #1, Miller Variant, RAW Authentic. Keep
the provider ID, holder format, grading and authentication distinct. These remain
comics, and must not inherit the legacy default CGC grade/cert handling. See the
[Authority extraction checkpoint](2026-09-06-authority-soft-sleeve-comics.md).

## Desktop and phone behavior

The home scene has a compact recorded-value instrument with a trend line. It opens
a scrub-able history with dated totals, valuation coverage, comics/cards breakdown,
an accessible observations table and a shortcut to missing values. Find adds **All
values / No value yet**, combining the latter with existing character, keyword and
cert searches. Numeric zero is a recorded value, not missing.

History lives in `data/value-history.json` and is included in Admin backup. Each
review build captures the current records, skipping unchanged builds on the same
local date. Eight complete saved inventory states, observed from August 16 through
August 30, seed the chart; the September 6 collection records $18,763 across 208 of
319 copies, with 111 unvalued. These observations describe saved inventory, including
additions and newly recorded valuations. They do not infer past market prices or
turn price-fetch dates into collection totals. The 45 undated PSA estimates remain
explicitly undated. No live price fetching occurs during builds.

Desktop reserves the main stage for the object with metadata beside it. Phone controls occupy the lower reach zone, with compact metadata and explicit actions. Drag rotates in Orbit, Wall and Longbox; Study drag pans. Spotlight background drag/scroll pans the wall, while dragging a held copy turns it. In the Spotlight overview, keyboard arrows and Page Up/Down pan, +/− zoom and Home recenters. Keyboard controls support selection, Study, search and scene return. Motion preferences, focus states, native dialogs, visibility pause and a searchable non-WebGL fallback are included.

The implementation uses pinned Three.js modules, front/reverse atlases, instanced collection geometry and a separately textured inspector with a bounded cache. Portable HTML includes every record, all PSA pairs and six featured comic pairs at 640px detail height. Local PSA inspection uses 1000px medium scans. Other comics load locally or from the published collection. Rendering modules still need network access; installation and full offline support are separate work.

## Verification and remaining ideas

The main suite includes import, source integrity, raw-status, admin persistence and local-server checks. Ten layout tests cover all four formations across desktop and portrait, all collection objects, stable ordering, container grouping and stable Spotlight positions. Four navigation checks cover reaching every edge on desktop/phone, zoom anchoring and empty collections. Browser checks cover desktop and 390×844 layouts, original scans, direct selection, exact-cert search, Study, zoom/pan, missing scans and the tour. Physical handset GPU, battery and multi-touch performance still require device testing.

Possible next experiments: tangible longbox dividers and pull-to-fan browsing; saved personal showpiece sequences; evidence-backed TAG centering/defect overlays; and an installed desktop/phone shell with local scans and record export. Deepen the object interaction before adding conventional pages.

## September 7 verification

Case #12 contains all 111 unique softslabs and 222 verified scans. The office wall contains 11 cards with 22 scans. Admin supports all 15 physical containers, with stable case QR links. Local app output loads scan images on demand; the portable design artifact retains embedded images. Five additional CGC cards remain in the intake queue awaiting security verification. The local preview has not been published.

## Approved immersive expansion — September 7

The owner approved building both **Inside the Case** and **Singularity**.

Longbox selection now enters one container. Its contents unfold in inventory order
into a horseshoe around the selected copy, with staggered depth and partially
overlapping neighbors. Portrait uses a curved vertical ribbon. Background swipes,
wheel scrolling and previous/next navigate only that case, wrapping at its ends.
Dragging the held copy turns it; its back remains the real reverse scan. Leave case
or Escape returns to the saved overview rotation and zoom. A faint box outline,
case name and in-case count keep the experience connected to physical storage.

05 Singularity now follows the owner's selected **Event Horizon** direction,
inspired by [ThreeUI's Hyperspace reference](https://threeui.com/three-js/warp-field/hyperspace).
The earlier stationary mosaic scene has been replaced with an authored flight.
Real front/back scans stream past in a deep tunnel with accelerating light streaks.
The camera moves toward a world-space black hole, widens its field of view and
banks slightly, crosses its growing photon ring, then reveals the selected copy
from depth. Cover colors tint the surrounding light.

Each 11.2-second active sequence includes 3.4 seconds of approach, .8 crossing,
1.2 reveal, **five full seconds holding the intact scan**, and .8 departure.
A stable mixed queue visits each scanned copy once per cycle and respects
All / Comics / Cards; unscanned records remain accessible through Find.
Replay flight restarts the current journey. Pause or direct interaction immediately
settles the selected copy for inspection; Resume starts with the full viewing hold.

Touching the canvas, navigating manually, opening Find/record/Admin/history, or
hiding the tab pauses arrivals. Resume is explicit. Motion off also stops automatic
arrivals and scene motion. Ambient hides controls, removes their keyboard focus,
and enlarges the copy; Show controls or Escape returns them. Direct entry uses
`/review/?view=singularity`, optionally `&ambient=1`. This prepares a display mode;
it does not install an operating-system screensaver or offline app.

Implementation is in `engine-immersive.mjs/html/css` and `engine-singularity.mjs`,
integrated by the existing builder. The flight uses bounded instanced batches
(up to 96 copies and 1,500 streaks on desktop; 44 and 650 on phone), existing
front/reverse atlases, and the existing detail scan cache. No new image sources
or external renderer packages are required. The ordinary collection instance
updates are skipped while the flight is active.

Eight immersive tests cover case boundaries, 111-copy portrait/desktop layouts,
deterministic scan queues, pause gates, camera continuity, and the full five-second
hold after arrival. Full suite: 285 passing tests. Browser checks cover 1440 × 900,
390 × 844, compact landscape, replay, pause retention, real reverse scans, scope,
motion-off and Ambient exit. Physical phone GPU, battery and touch testing remain
unverified.

## Milky Way backdrop — September 7

The owner requested a focused replacement of the circular black hole, keeping
everything else. `engine-singularity.mjs` now renders a continuous diagonal Milky
Way with fine stellar layers, irregular dust extinction, restrained blue/violet
haze and a warm pearl band. The opaque black pupil and accretion-ring mesh are
removed. The galaxy remains behind the real scans throughout the flight and hold.
The collectible geometry, camera journey, queue, timing, scan treatment, controls
and other four experiences are unchanged. No new textures or dependencies.

Validation: review build and all eight existing immersive tests pass; desktop
and a 390 × 844 portrait preview render the flight and held-copy phases. The main
scene reports no WebGL console errors. The existing Superdesign draft is version
17; its fetched source matches the local galaxy implementation exactly.

## Continuous Singularity playback — September 7

The owner wants uninterrupted flight while hiding the controls. This supersedes
the earlier 11.2-second approach/crossing sequence and explicit restart after tab
hiding. Hide controls, Ambient, Show controls and Escape from Ambient now preserve
playback intent. A deliberately paused scene stays paused. A backgrounded browser
tab freezes rendering and elapsed time, then resumes its previous state without
skipping copies.

The scene cruises at steady speed and field of view with continuous camera drift.
Each foreground copy reveals for 1.2 seconds, holds for five full seconds, and
departs for 1.2 seconds. There is no recurring Event Horizon headline or crossing
flash. Background scans remain visible during close-ups and Ambient; each scan
changes only when its individual slot recycles into the distant fade. Real front
and back images, manual pause, reduced motion and the other formations remain.

Validation: 332 tests pass, including timing, pause gates, constant flight speed
and background scan recycling. Local browser checks confirm automatic arrivals
continue with controls hidden and deliberate pause survives hide/show. A 390 × 844
portrait preview keeps the complete held scan in frame with visible background
copies. Physical iPhone GPU and touch testing remain unverified.
