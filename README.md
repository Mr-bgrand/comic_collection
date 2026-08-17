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
npm run build
```

Then open and print:

- `dist/bin/01/label.html` — print at **4×6**, scale 100%, no headers/footers
- `dist/bin/01/sheet.html` — print on **letter, double-sided**, scale 100%

Set the browser's print scaling to 100% and turn off "fit to page". The pages
carry their own `@page` sizes, so at 100% they come out exact.

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
