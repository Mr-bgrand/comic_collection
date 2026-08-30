# Comic Collection

Inventory and printed paperwork for CGC-graded comics stored in BCW bins.

Give it a CGC certification number; it looks the book up, stores the record, and
generates the three things a bin needs:

| Output | Where it goes | What it's for |
| --- | --- | --- |
| **4×6 label** | The bin's front label slot | Every comic in the bin, one line each, readable without a phone |
| **8.5×11 sheet** | Inside the bin, printed double-sided | The full CGC record per book — the appraisal document |
| **QR code** | On the label | Opens the bin's web page, with full-size cover scans |

Design doc: [`docs/superpowers/specs/2026-08-16-comic-inventory-labels-design.md`](docs/superpowers/specs/2026-08-16-comic-inventory-labels-design.md)

---

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
npm run print
```

Writes ready-to-print files to [`print/`](print/), which is committed to the repo:

| File | Print as |
| --- | --- |
| `print/bin-01-label.pdf` | **4×6**, one page |
| `print/bin-01-sheet.pdf` | **letter, double-sided**, two sides |

Print the **PDFs**, not the HTML. A PDF carries its own page size, so 4×6 comes
out 4×6; printing HTML invites the browser to silently scale it to "fit". If your
print dialog offers scaling, set it to 100% / "actual size".

The matching `.html` files are written alongside for tweaking and re-printing.

`npm run build` produces the same pages under `dist/`, but `dist/` is build output
— gitignored and wiped on every build — so use `print/` for anything you want to
keep.

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

`dist/wall/3d/` — **the vault**, the wall's experimental WebGL sibling, linked
from the wall's own toolbar. The same 213 slabs become physical objects in a
dark room: clearcoat plastic under an environment light, with the torch as a
real lamp riding the pointer. Four formations — the wall, the longboxes the
books actually live in (sorted by bin, each row *is* that bin), a helix, and an
orbit — plus the same four sorts. Click a slab to hold it up to the camera (it
swaps in the sharper scan); click it again, or the gold button, to open its bin.

It is the one page in the site that loads a library at view time: three.js,
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
pagination, and label auto-sizing. The CGC parser is tested against a saved
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
  images/              committed cover scans
src/
  scrape.js            CGC lookup (Playwright)
  repair.js            encoding repair
  model.js             display logic — titles, top pop, pagination, auto-sizing
  build.js             JSON -> dist/
  templates/           label, sheet, bin page, index
dist/                  build output (gitignored)
```

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml`. Enable it once under **Settings → Pages → Source →
GitHub Actions**.

Note that GitHub Pages serves from public repositories on the free plan, so the
collection is publicly viewable. To keep it private, deploy `dist/` to a host with
access control instead — only the deploy step changes.
