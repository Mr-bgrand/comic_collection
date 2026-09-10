# Collection / Lab

The active full-screen experience uses real inventory and scans. September 9,
2026 snapshot: **933 objects - 696 comics and 237 cards**, with 907 front scans.
See [collection status](../collection-status.md) for containers and unfinished intake.

Open the [published collection](https://mr-bgrand.github.io/comic_collection/review/)
or run the local app with management enabled:

```powershell
npm run build
npm run lab
```

Local address: [Collection / Lab](http://localhost:4175/review/). The older catalogue
remains at the published site root. GitHub Pages rebuilds on push to `main`; edits,
photo uploads and PDF generation need the local server.

## Five experiences

| View | Interaction |
| --- | --- |
| 01 Orbit | Orbital bands; drag the field or select a real copy |
| 02 Wall | A curved wall with selectable front and back faces |
| 03 Inside the Case | Enter a case's surrounding ribbon or horseshoe; arrows, swipe or scroll stay within that case; Leave case restores the overview |
| 04 Spotlight | Roam by dragging or scrolling; zoom, recenter, or start the optional tour; manual interaction pauses it |
| 05 Singularity | Continuous Milky Way flight; each copy reveals, holds for five seconds, then departs while the background keeps moving |

In Singularity, **Hide controls / Ambient / Show controls** preserve playback or a
deliberate pause. **Pause**, touching the canvas, manual navigation or a dialog
stops arrivals. **Resume** starts at the current viewing hold; **Replay arrival**
restarts that copy's reveal. A hidden browser tab suspends rendering and time,
then resumes its prior state without skipping records. Motion off gives a still
view. The Event Horizon headline and black-hole graphic have been removed.

Direct links: `?view=singularity`, `?view=singularity&ambient=1`, or
`?case=comic-bin-13`. This is a browser display, not an installed screensaver.
Singularity includes the owner's supplied **Cornfield Chase — Hans Zimmer** MP3.
Music loops through successive arrivals, follows Pause/Resume, and continues when
controls are hidden. Tap **Music play** if the browser needs a first interaction;
**Music off** is remembered on that browser. Leaving Singularity or backgrounding
the page pauses audio without resetting its position. The file loads on demand.

## Find, inspect and value

**All / Comics / Cards** filters the collection. **Find** accepts titles,
characters, keywords, graders and exact certs, with metadata-based shortcuts and
live counts. **No value yet** combines with search; an explicit zero is a known
value. Phone shortcuts do not force the keyboard open.

Selected copies render in a separate foreground pass so surrounding objects cannot
cover them. Drag to rotate; **Turn over** shows the actual reverse. **Study**, outside
Singularity, shows both scans with zoom and pan. Missing backs use a labeled
placeholder, never a mirrored front. Authority sleeves and owner scans remain raw.

With the canvas focused, `/` opens Find and arrows select. In Singularity, Space
toggles playback and H toggles Ambient; Escape leaves Ambient. Other formations
use X for Study and Space to return to the collection. Touch drag and pinch support
rotation, pan and zoom. Reduced motion follows the system preference.

**The record** carries certification, storage, scans and value evidence. The value
instrument opens dated totals and coverage: additions and newly valued copies
affect these totals, so they are not a market-return series. The 45 PSA Vault
estimates have no supplied valuation date and remain explicitly undated.

TAG uses its own recorded value or owner estimate first. Otherwise an exact-card,
exact-numeric-grade PSA comparison can supply a visibly labeled value with its
source date. Year, set, subject, number, language and variant must agree. TAG 10
uses PSA 10; half-grades are not rounded. `npm run tag:values` refreshes comparisons
from stored records. Unmatched cards stay unvalued; builds do not fetch prices.

## Imports and scans

Records live in `data/bins`, `data/cards` and `data/comics`; reviewed captures and
image manifests live in `data/incoming`. Keep certs as strings, including leading
zeros, source URLs and dates. Reimports preserve owner data and verified scans.

- `npm run vault -- "data/incoming/My Collection CSV - 49.csv"` imports PSA Vault.
- `npm run psa:certs -- data/incoming/psa-case3-captures.json` refreshes Case #3.
- `npm run tag -- data/incoming/tag-case-02-captures.json` refreshes Case #2;
  the other TAG containers have their own captures and locations.
- `npm run cgc:cards -- data/incoming/cgc-card-captures.json` refreshes the 11
  imported CGC cards. Five additional certs remain pending verified capture.
- `npm run authority:import -- <reviewed-capture.json>` imports Authority sleeves.
- `npm run cards:images -- <image-manifest.json> <container.json>` imports verified
  card scans. Originals stay in ignored `data/originals`; app derivatives rebuild.

Image URLs are verified against each rendered cert page. PSA uses only
`d1htnxwo4o0jhw.cloudfront.net/cert/`, never eBay similar-sales images. TAG's
**Slabbed image captures** section provides the full holder photographs, with
cert-matching `Slabbed_FRONT` / `Slabbed_BACK` files. These become the default
display images. The original FRONT_MAIN/BACK_MAIN pair remains in `cardScans`
with its provenance; SFX and flaw crops are excluded. Older card-scan imports
cannot downgrade an imported slab or overwrite an owner photo. Preserve source URL,
side evidence and checksum. Missing scans stay missing. CGC report grades and
physical-label wording can differ; retain both. CBCS capture remains manual where
verification requires it. Acquisition costs/private notes are excluded from the
portable review data.

The September 8 TAG slab-source manifests are grouped by
[Case #2](../../data/incoming/2026-09-08-tag-slabs-case-02.json),
[office wall](../../data/incoming/2026-09-08-tag-slabs-case-wall-office.json), and
[original TAG Collection](../../data/incoming/2026-09-08-tag-slabs-tag-collection.json)
(now assigned to Case #1; use `data/cards/case-01.json` when refreshing these images).
Pass a manifest and its matching `data/cards/<container>.json` file to
`npm run cards:images --`. Requests are paced; a 403/429 stops the batch. Let the
source recover before retrying; completed sides are skipped on the next run.

**Find > Raw comics** locates all 96 owner-scanned books in Bin #15. Their scan IDs
remain stable while titles/issues await identification. Singularity interleaves
owner scans, Authority sleeves, graded comics and cards across the entire flight,
including the loop boundary; filtered flights keep the same coverage. Raw books
use flexible framing and an Owner scan ID instead of an empty certification.

## Admin, photos and print

**Admin > Bins & locations** renames all 20 physical containers and records their
locations without changing IDs or QR destinations. Save before rebuilding.
**Print Studio > Build & generate** runs `npm run build`, then `npm run print`.
It creates PDFs and does not send them to a printer.

The [print index](../../print/README.md) contains the 4 x 6 label pack, duplex Letter
master-sheet pack, complete collection master list, individual PDFs and page
ranges. Physical paperwork covers 884 copies in 20 containers; the complete list
also includes the 49 PSA Vault cards. All 14 original TAG cards are assigned to
Case #1 and included in its label and master sheets. Keep the blank reverse
pages in the combined duplex pack.

**Admin > Photos** searches an existing cert/title, selects front or back, and
reviews an image before saving. **Use phone camera** pairs a phone on the same
Wi-Fi through a temporary QR. The phone can photograph, rotate, review, save and
search the next cert. The computer must stay on with `npm run lab` running.
Previous scan/source history is preserved; photo intake does not create records.
Include ignored originals, scan beds and backups in your full local backup; the
JSON export does not contain those files.

## Source and validation

`build-engine.mjs` compiles the engine, scene/navigation modules, Admin, photo
intake and value history into `dist/review/index.html` and a portable review file.
It reads current inventory, refreshes stored TAG comparisons and records a value
observation. `npm run build` rebuilds the legacy catalogue and this app;
`npm run review:build` rebuilds only the immersive app.

Three.js is version-pinned and loaded from a CDN. Full offline installation is not
implemented. WebGL is required for the scene; a searchable fallback remains.
Casing is illustrative framing around original scans, not a measured reconstruction.
Phone-sized browser previews are checked; physical iPhone testing remains separate.

```powershell
npm test
npm run verify:print
```

See the [active design history](../superpowers/specs/2026-09-06-collection-engine-direction.md).
Earlier `museum.*` files and dated checkpoints are historical, not current counts.
