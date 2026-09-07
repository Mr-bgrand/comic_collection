# Collection / Lab

An experimental full-screen collection viewer built from the actual inventory and scans: **245 comics, 49 PSA Vault cards, 14 TAG cards and 11 CGC cards**. It is separate from the production catalogue.

```powershell
npm run review:build
npm run lab
```

Open [Collection / Lab](http://localhost:4175/review/). **All / Comics / Cards** filters the collection. Select an object directly or use **Find** for a title, subject, grader or exact cert. Selected objects render in a separate foreground pass so surrounding slabs cannot cover them.

Find opens with character/name and keyword shortcuts ranked by matching records,
with live counts (for example Spider-Man, Foil, Pokémon and Momoko). A tap runs that
search; Clear search restores the shortcuts. Counts use the same matcher as results
and refer to recorded metadata, not image recognition. Search includes creator/key
notes and known signature metadata, tolerates accents and common Spider-Man/X-Men
spellings, and preserves certification strings. On phones, opening Find or tapping
a shortcut does not automatically open the software keyboard.

- **01 Orbit:** orbital bands around the selected object.
- **02 Wall:** a curved collection wall.
- **03 Longbox:** stacks grouped by actual container. The PSA Vault stays explicitly external storage.
- **04 Spotlight:** an after-hours wall moving around the selected copy, warm illumination and an optional 6.5-second-per-object tour. Manual interaction pauses the tour.

Drag a selected slab to rotate it, or use **Turn over**. **Study** replaces the old decorative explosion: it places the original front and reverse scans side by side. Zoom from 100% to 260% with the slider, then drag to pan. With the canvas focused, arrow keys select, X toggles Study, Space returns to the collection and / opens search. Touch drag and pinch support rotation/pan and zoom. Motion can be disabled and follows the system preference.

**The record** carries grade, cert, storage, scans and recorded value evidence. The 45 PSA estimates came from the Vault export; its four missing estimates stay unknown. The export has no valuation date, so the interface says so. Import time is separate. Acquisition costs and private notes stay in local data and are excluded from the portable prototype.

## PSA import and verified scans

```powershell
npm run vault -- "data/incoming/My Collection CSV - 49.csv"
npm run cards:images -- data/incoming/psa-cert-images.json
npm run review:build
```

The offline import writes `data/cards/psa-vault.json`, keyed by grader/cert. Reimports preserve scan enrichment, reject duplicate ownership across containers and retain earlier cards absent from a later export for reconciliation.

The manifest retains exact URLs observed in each rendered PSA cert viewer after lazy loading. Only `https://d1htnxwo4o0jhw.cloudfront.net/cert/` is accepted. Internal IDs are never guessed; eBay images are rejected. Each scan retains its source URL, cert page, side basis, discovery/retrieval times, dimensions and local checksum. This collection yielded **48 front/reverse pairs (96 files)**. Cert **62837377** had no scans on its loaded page and is explicitly marked; no substitute image is used.

TAG's 14 verified cards and 28 MAIN scans are imported. `npm run tag -- data/incoming/tag-card-captures.json` imports the reviewed rendered-page metadata; `npm run cards:images -- data/incoming/tag-cert-images.json data/cards/tag-collection.json` downloads the exact scans. Original files live in ignored `data/originals`; 1600px masters and smaller derivatives serve the UI. The image guard excludes effects and defect crops. Y2994116 and S2994291 loaded successfully on retry and are now imported. Values and TAG storage locations are unassigned.

CGC Cards adds 11 verified records in **Case #1**, with 22 scans. Refresh with `npm run cgc:cards -- data/incoming/cgc-card-captures.json` then `npm run cards:images -- data/incoming/cgc-cert-images.json data/cards/case-01.json`. The capture preserves current census data and grader wording. Venusaur's physical Gem Mint 9.5 label is shown separately from CGC's current Gem Mint 10 report. Venusaur and Weepinbell have visually reviewed scan-side corrections because CGC's source labels are reversed.

## Build and validation

Active source: `build-engine.mjs`, `engine.js`, `engine.css`, `engine-layouts.mjs` and `engine-search.mjs`. Generated HTML goes to ignored `dist/review/index.html`, `docs/prototypes/engine.html` and `.superdesign/tmp/engine.html`. This builder never writes inventory or print files. `npm run build` now rebuilds the production catalogue and then Collection / Lab, preserving the review view.

Portable HTML embeds metadata, the cover atlas, all available PSA, TAG and CGC card pairs and six featured comic pairs at 640px detail height. Local card detail uses the 1000px medium files. Other comic scans load locally or from the existing public collection. Pinned Three.js modules require a network connection. Installation and full offline support are not implemented. Casing is illustrative framing around an actual holder scan, not a measured reconstruction.

```powershell
npm test
node --test docs/prototypes/engine-layouts.test.mjs
node --test docs/prototypes/engine-search.test.mjs
```

See the [active direction and scope](../superpowers/specs/2026-09-06-collection-engine-direction.md). Earlier `museum.*` files remain as superseded design history.

## Admin and printing

Run `npm run lab` for the local server with management enabled. Open the gear /
**Admin** button to rename bins, record their locations, preview existing 4 × 6
labels and 8.5 × 11 master sheets, or run **Build & generate**. That action runs
`npm run build` then `npm run print` and links every resulting PDF. It does not
send anything to a printer. Those terminal commands still work independently.
Save edits before starting a build. Bin IDs and QR destinations remain unchanged.

Print Studio also offers a collection-wide master list, including the PSA cards
and the new raw comic. Collection backup downloads the stored inventory JSON;
the scan files stay in `data/images`. Admin needs the local server; the portable
Superdesign draft displays read-only controls.

## Authority soft sleeves

The first Authority copy is imported: Deathlok #1, Miller Variant, ID 1700597971.
Its exact front/back scans and all source metadata are retained. It is **RAW
Authentic**, without a numeric grade, recorded value or assigned location.
`npm run authority:import -- data/incoming/authority-1700597971.json` can refresh
the reviewed capture without duplicating the copy or discarding owner-entered data.
