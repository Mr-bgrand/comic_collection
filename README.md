# Comic Collection

Your personal comic and card collection: exact-copy records, immersive displays,
case labels, master sheets, and recorded value history.

The active experience is [Collection / Lab](https://mr-bgrand.github.io/comic_collection/review/).
Singularity includes optional looping *Cornfield Chase* audio. Tap Music to enable
it when needed; hiding controls keeps the soundtrack and flight running.
The original catalogue remains at the site root. Current snapshot, September 8,
2026: **910 objects - 673 comics and 237 cards**, with 884 front scans.
See [collection status](docs/collection-status.md) for containers and pending intake.

| Output | Where it goes | What it's for |
| --- | --- | --- |
| **4×6 labels** | The bin or case label slot | Every copy, with continuation pages for larger cases |
| **8.5×11 master sheets** | Inside the bin, printed double-sided | Cover scans and the stored record per copy |
| **Collection master list** | Your collection reference | Every copy, location and recorded value/source |
| **QR codes** | On labels and sheets | Open the matching bin or case and its scans |

Design doc: [`docs/superpowers/specs/2026-08-16-comic-inventory-labels-design.md`](docs/superpowers/specs/2026-08-16-comic-inventory-labels-design.md)

---

## Phone photos in Collection / Lab

Authority softslabs are in Case #12 and Bins #13-15. Bin #15 also contains 96
unidentified owner-scanned raw books. Card Case #3 contains 94 PSA cards, including
the certs supplied without URLs. Five additional CGC cards remain queued for
verified capture and are not counted as imported.

All 19 physical bins/cases appear in **Admin → Bins & locations / Print Studio**.
`npm run build` and `npm run print` remain the normal workflow. Large 4×6 labels
continue across pages; Letter sheets include every copy. Printed case QR links
use the configured site URL and become available when that build is published.

Find includes **No value yet**. The homepage value display opens recorded
collection history with valuation coverage; unknown values remain unknown.

Run `npm run build`, then `npm run lab`, and open
[Collection / Lab](http://localhost:4175/review/). In **Admin → Photos**, search
an existing copy by cert number or title and choose **Front** or **Back**.
You can choose an image on this computer, or click **Use phone camera** and scan
the QR code with your phone on the same Wi-Fi.

On the phone, tap **Take a photo** or **Choose image**, review the preview, rotate
if needed, and save. Search the next cert directly from the phone to keep going.
The computer must stay on with `npm run lab` running. A pairing lasts 30 minutes;
**Disconnect phone** ends it sooner. The QR panel includes connection help.

Saving attaches the photo to that exact grader/cert and side, keeps the previous
image and its source history, and rebuilds the interactive collection. Refresh
the desktop collection to see the new scan. The normal build/print commands still
generate the catalogue, labels and master sheets. Photos do not create new records.

Choose an image under 20 MB. JPG, PNG and WebP are supported; the phone's camera
picker supplies a browser-readable photo. If an existing HEIC image cannot be
opened, export it as JPG. Retained originals have orientation corrected and
location metadata removed. Originals and automatic record backups stay in the
gitignored `data/originals` and `data/backups/photos` directories; include these
directories in a complete local backup.

## Adding comics to a bin

```bash
node src/scrape.js --bin 01 4395549004 4395549005 4395549006
```

A Chrome window opens, clears Cloudflare's challenge once, then walks every cert
in the batch. Results land in `data/bins/bin-01.json`; cover scans land in
`data/images/`. Re-running a cert that's already stored overwrites it in place,
and a cert listed twice is looked up once.

Certs in a file, one per line, work too:

```bash
node src/scrape.js --bin 01 --file certs.txt
```

**Requires Google Chrome or Edge installed.** Cloudflare flags Playwright's
bundled Chromium and never clears the challenge for it. The browser profile is
kept in `.cache/chrome-profile`, so the clearance cookie survives between runs and
only the first lookup of a session waits.

Call `node src/scrape.js` directly rather than `npm run lookup --` — npm eats the
`--bin` flag.

### When a name can't be repaired

CGC serves damaged bytes for non-ASCII characters, and the lookup will say so:

```
[3/23] 4395549002 ... Action Comics #1056 9.8
  ! unrepairable text: Yasm?n, Monta?ez
```

Add the correct spelling to `KNOWN_NAMES` in [`src/repair.js`](src/repair.js), then:

```bash
npm run repair
```

That re-applies repairs to everything already stored — no need to look those
books up again.

## Printing

```bash
npm run build
npm run print
```

Writes ready-to-print files to [`print/`](print/), which is committed to the repo:

| File | Print as |
| --- | --- |
| `print/all-case-labels-4x6.pdf` | **4×6, single-sided**, every physical container |
| `print/all-case-master-sheets-letter.pdf` | **Letter portrait, double-sided, long-edge flip**; each case starts on a fresh sheet |
| `print/collection-master-list.pdf` | **Letter landscape**, all 910 stored copies including PSA Vault |
| `print/bin-<id>-label.pdf` / `bin-<id>-sheet.pdf` | One container's labels or sheets |

Print the **PDFs**, not the HTML. A PDF carries its own page size, so 4×6 comes
out 4×6; printing HTML invites the browser to silently scale it to "fit". If your
print dialog offers scaling, set it to 100% / "actual size".

The [print index](print/README.md) lists every container and its page ranges. The
combined master-sheet PDF includes blank reverse pages for duplex separation;
keep those blanks. Matching `.html` files are written alongside for previews.

Every 4×6 label row identifies the grading company beside its grade: PSA, TAG,
CGC, CBCS or Arena Club. Ungraded books show RAW; authenticated softslabs show
Authority RAW.

`npm run build` refreshes the catalogue and immersive app. `npm run print` creates
the permanent paperwork from all physical comic/card containers. `dist/` is
gitignored and wiped on every build, so use `print/` for files you want to keep.
Local **Admin > Print Studio > Build & generate** runs these same two commands.

## Fair market values (GoCollect)

Grades never change, so certs are looked up once. **Market values move**, so FMV is
timestamped and re-runnable, and the dashboard shows an "as of" date.

GoCollect needs a login. This never asks for your password — instead you sign in
by hand, once, in the automation browser profile:

```bash
npm run login     # opens GoCollect; sign in, then close the window
npm run login:cgc # opens CGC; same idea. Does NOT reveal extra cover
                  # scans - verified signed-in, cert lookup shows the
                  # same images either way - but keeps the session warm.
npm run fmv      # prices every book using that saved session
npm run fmv -- --force   # refresh values that already exist
```

### Scanning without walking back to the keyboard

CGC only photographs books you pay imaging for, so the rest you scan yourself.
The scanner is rarely within reach of the keyboard, and a bin of twenty-five
books is fifty trips across the room. Two hands-free modes exist for that:

```bash
npm run scan          # keyboard, the default
npm run scan:voice    # reads each book aloud, waits for a spoken word
npm run scan:timed    # scans the back 8s after a good front
node src/scan.js --timed 12    # ...or pick your own gap
npm run scan -- --redo 4089841007      # rescan named certs, even if they
                                       # already have a cover
```

A live preview opens with any voice or `--redo` run (or `--preview` on its own):
a local page that swaps in each scan as it lands, showing the book, the side,
and the mean brightness. A rescan shows before and after together, because that
is the only way to answer "did that help?" without walking back to the machine.

Reflective covers — foil, metal, crystal, chrome, holo — can reflect the lamp
away from the lens and scan black. Say **shiny** (or pass `--bright`) to raise
the scanner's exposure. It is offered rather than applied: on the three tried,
it recovered the art on two foil covers and did nothing for a mirror-finish
metal one, which wants a physical tilt instead.
A lamp brought in to beat a mirror finish also lights the mat, and a lit mat
looks like content — so automatic cropping can fail on exactly the scans that
needed the lamp. Every scan keeps its untouched bed in `.cache/raw/`, so that
costs a command rather than another trip to the scanner:

```bash
npm run recrop -- 4177706003_OBV                      # try the automatic crop again
npm run recrop -- 4177706003_OBV 0.27 0.01 0.72 0.97  # left top right bottom,
                                                      # as fractions of the bed
```

It warns when the result is not slab-shaped (a CGC slab is about 1.5 times as
tall as it is wide), which catches a wrong number before it reaches a sheet.

### Raw comics, two at a time

Raw books are bagged and boarded, so only the front is visible - and the bed is
wide enough for two side by side with mat to spare. One press scans both:

```bash
npm run scan:raw -- 15                  # keyboard: Enter = scan, a = again, s = shiny, q = quit
npm run scan:raw -- 15 --voice          # hands-free, with the live preview
npm run scan:raw -- 15 --from .cache/raw/raw-15-scan-004.jpg   # re-process a kept bed
```

Each bed is split into its books, each book is cropped and saved, and each gets
a stable id - `raw:15-001`, `raw:15-002` - in `data/comics/comic-bin-15.json`,
the container the Lab and `npm run print` already treat as a raw comic bin. The
bed is kept in `.cache/raw/` so a bad split is a re-crop, not a rescan. Saying
**again** rescans the last bed and replaces its books rather than adding two more.

Nothing here works out what the books are: many are virgin covers with no text
at all, and identifying them is a matching problem for later. Until then a book
shows as `Unidentified · 15-001`, and every record carries an `identification`
slot for the answer to land in.

In voice mode it reads out the bin, title, variant and grade before each book —
enough to identify the slab in your hand without looking at the screen, which is
the case that matters when scanning a run of near-identical variants. Then it
listens for one of four words:

| Say | Does |
|---|---|
| **next** | scan this side |
| **again** | the last side came out badly — go back and rescan it |
| **skip** | skip this side |
| **stop** | end the session |
| **shiny** | toggle bright mode for this book — for foil and metal covers |

You do not have to wait for it to finish talking. The microphone is opened once
at the start of the session and stays open, so a word said over the top of the
announcement lands immediately and cuts the sentence off mid-word. Opening a
recogniser per prompt instead cost two to three seconds each time, and was deaf
to anything said before it had finished starting — which is most of what people
actually say.

A word heard *during a scan* is discarded rather than queued: shouting "next"
while the scanner works would otherwise fire the moment the front finished and
scan it again before you had turned the book over.

Both halves ship with Windows (`System.Speech`, via `scripts/speech.ps1`) — no
install, no account, no network, and nothing is recorded or sent anywhere.

The vocabulary is deliberately four words. Recognition runs against a closed
grammar rather than open dictation, which is why it is dependable at a distance:
measured at 99% confidence from where the scanner actually stands. "back" is
absent on purpose — this loop scans a front and a back, so the word would be
ambiguous exactly where it is spoken.

If no recogniser is installed, voice mode says so and falls back to the keyboard
rather than failing halfway through a bin.

Each priced book stores its value, the 30/90/365-day averages, the sold count, and
a link to its GoCollect page:

```json
"fmv": {
  "value": 60,
  "avg30": null, "avg90": null, "avg365": 60, "sold365": 1,
  "url": "https://gocollect.com/app/comic/action-comics-1056-krs-comics-foil-edition",
  "fetchedAt": "2026-08-17T12:00:00Z"
}
```

## Values you enter yourself

Some books no market source carries — retailer exclusives GoCollect doesn't track
and eBay can't reliably identify. For those:

```bash
npm run edit     # http://127.0.0.1:4173
```

Local only, and deliberately so: the published dashboard is a static public page
with no backend, and anyone who scans a bin QR can open it. An editable public
page would be both impossible and wrong. This runs on your machine and writes
straight to `data/bins/*.json`; then `npm run build` and commit.

Your figures are stored under `manual`, never merged into `fmv`, and are labelled
as estimates everywhere they appear. A total that silently blends sales data with
guesswork is how an appraisal document becomes misleading.

A blank value *clears* an estimate rather than storing zero — a book worth nothing
and a book you haven't valued are different facts.

## Dashboard

The current Collection / Lab has **01 Orbit, 02 Wall, 03 Inside the Case,
04 Spotlight and 05 Singularity**. Singularity continuously cruises through the
Milky Way with five-second viewing holds. Hide controls preserves playback or an
intentional pause. Motion off, touch-to-pause and the real reverse scans remain.
See the [viewer guide](docs/prototypes/README.md) for controls and local Admin.

Case #2 contains 57 TAG cards in `data/cards/case-02.json`. Their reviewed report
captures and official scan manifest are `data/incoming/tag-case-02-captures.json`
and `data/incoming/tag-case-02-images.json`. Refresh with `npm run tag --
data/incoming/tag-case-02-captures.json`, then `npm run cards:images --
data/incoming/tag-case-02-images.json data/cards/case-02.json` and rebuild. The capture
includes its physical container, so the earlier TAG collection stays separate.

TAG's card pages also photograph the encapsulated card — the **GRADED IMAGES**
section. Capture those two URLs into the image manifest as `slabFront` /
`slabBack` (same rules: taken from the rendered page, never constructed) and
re-run `npm run cards:images`. The slab photograph becomes the card's display
image everywhere — the copy as it physically exists, matching the CGC slabs —
while the razor-sharp MAIN scans stay on the record as `images.scanFront` /
`images.scanBack` and in `cardScans`, without being downloaded again. Verified
slab sources use `/slab-images/<cert>_Slabbed_FRONT.jpg` and the matching BACK
file on TAG's CloudFront host; `/card-images/` contains MAIN/SFX/defect assets
and does not qualify as a slab photograph. Explicit `kind: "slab-photo"`
manifests are also supported. All 80 stored TAG cards now have both slab photos.

The experimental Collection / Lab home also shows the combined recorded value of
comics and cards, with a small trend chart. Click it to explore dated snapshots,
see the comic/card breakdown and find copies with no value yet. The same **No
value yet** filter is available in Find and combines with character or cert searches.

`npm run build` and `npm run review:build` automatically save value observations to
`data/value-history.json`. Unchanged rebuilds on the same local date are deduplicated;
changed values or a new day add an observation. Admin's collection backup includes
this history. `npm run value:history` can capture a snapshot without rebuilding and
seed an empty history from complete saved Git inventory versions.

These are recorded inventory totals, including added copies and newly entered
estimates, not a market-return series. Unvalued copies are excluded, explicit $0
values are counted, and valuation dates remain separate from snapshot dates.
Rebuilding does not fetch new prices.

For TAG, an explicit TAG value or owner estimate takes precedence. Otherwise a
verified PSA comparison must match the same card, language, variant and numeric
grade (TAG 10 uses PSA 10, including exact half-grades). It stays labeled as a PSA
comparison with its source date. `npm run tag:values` refreshes comparisons from
stored records; unmatched cards remain unvalued.

`dist/dashboard/` — total value, grade spread, top-pop count, and a sortable table
of every book with links out to both CGC and GoCollect. Linked from the site index.

Each row carries a cover thumbnail; hover, tap, or keyboard-focus it for a large
preview. Image sizes are generated from `data/images` by [`src/thumbs.js`](src/thumbs.js)
rather than committed:

| Size | Used by | Weight |
| --- | --- | --- |
| 120px | table rows, and print at 300dpi | ~7 KB |
| 480px | the hover preview, fetched on demand | ~70 KB |
| 500px original | bin pages | ~370 KB |

That keeps the dashboard's initial load at ~358 KB instead of the ~17 MB it would
be with full scans, and took the manifest PDF from 8 MB to 258 KB.

## The wall

`dist/wall/` — every cover at once, edge to edge, linked from the site index.
Hovering a slab lifts it into the light; the sort buttons glide the covers into
bin, grade, value, or top-pop order.

`dist/wall/3d/` — **the vault**, the older wall's WebGL sibling, linked
from the wall's own toolbar. The legacy graded-comic inventory becomes physical objects in a
dark room: clearcoat plastic under an environment light, with the torch as a
real lamp riding the pointer. Four formations — the wall, the longboxes the
books actually live in (sorted by bin, each row *is* that bin), a helix, and an
orbit — plus the same four sorts. Click a slab to hold it up to the camera (it
swaps in the sharper scan); click it again, or the gold button, to open its bin.

Like Collection / Lab, it loads Three.js at view time,
version-pinned, from jsdelivr. No WebGL, a blocked CDN, or no JavaScript all
degrade to a short note pointing back at the flat wall, which remains the
canonical page.

## Local preview

```bash
npm run build
npx serve dist        # or any static file server
```

## Tests

```bash
npm test
```

Covers the pure logic: encoding repair, display titles, population parsing,
pagination, label auto-sizing, combined PDF pagination, import identity checks,
valuation evidence and scene navigation. The CGC parser is tested against a saved
capture of a real record (`src/fixtures/`), so the suite never touches the network.

---

## How it works

**Lookups happen once, at authoring time.** CGC sits behind Cloudflare — plain
HTTP gets a 403 — so lookups run through a real browser. That's fine, because a
slab's grade never changes: each cert is looked up exactly once and the JSON in
this repo becomes the durable record. Nothing scrapes anything at build time or
when someone scans a QR code.

**CGC's own data has encoding damage.** Their pages serve replacement characters
for non-ASCII names (`Gr<?>nbekk` for Grønbekk). `src/repair.js` fixes the ones it
recognises, records every substitution so the change is auditable, and *warns*
about anything it can't fix rather than printing a corrupted name on an appraisal
document. To teach it a new name, add the correct spelling to `KNOWN_NAMES`.

**Titles match the slab.** The printed title is `Title #Issue : Variant` exactly as
CGC prints it, so a book can be checked against the paperwork by direct comparison
rather than by interpretation.

## Layout

```
data/
  config.json          collection name, site URL, bin capacity
  bins/bin-01.json     one file per bin — the source of truth, hand-editable
  cards/               PSA, TAG, CGC Cards and Arena Club records
  comics/              Authority sleeves and owner-scanned raw comics
  value-history.json   dated recorded-value observations
  images/              committed cover scans
src/
  scrape.js            CGC lookup (Playwright)
  repair.js            encoding repair
  model.js             display logic — titles, top pop, pagination, auto-sizing
  build.js             JSON -> dist/
  templates/           label, sheet, bin page, index
  print.js             current PDFs and combined packs in print/
docs/prototypes/       active five-view Collection / Lab sources
print/                 permanent PDFs, index and page-range manifest
dist/                  build output (gitignored)
```

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml`. Enable it once under **Settings → Pages → Source →
GitHub Actions**.

Note that GitHub Pages serves from public repositories on the free plan, so the
collection is publicly viewable. To keep it private, deploy `dist/` to a host with
access control instead — only the deploy step changes.
