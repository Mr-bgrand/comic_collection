# Comic Bin Inventory & Label System — Design

**Date:** 2026-08-16
**Status:** Approved for planning
**Repo:** https://github.com/Mr-bgrand/comic_collection

---

## 1. Purpose

Catalog a collection of CGC-graded comics stored in black BCW bins (25 comics per
bin) and print the physical paperwork that makes a bin self-describing:

- A **4×6 label** for the bin's front label slot, listing all 25 books.
- An **8.5×11 sheet** (double-sided) that lives inside the bin, carrying the full
  CGC record for each book.
- A **QR code** on the label that opens a web page with everything, including
  cover scans — enough for someone to appraise the bin from their phone.

The input is a CGC certification number. Everything else is looked up.

## 2. Scope

**In scope:** CGC cert lookup, per-bin JSON storage, three print/web outputs,
cross-bin search by cert or title, GitHub Pages deployment.

**Out of scope (explicitly):** price/valuation data, non-CGC graded books, raw
(ungraded) books, sales tracking, multi-user accounts, editing data through a web
UI. Data is edited as JSON in the repo.

## 3. Key architectural decision: lookup happens at authoring time

CGC's cert lookup page (`cgccomics.com/certlookup/{cert}/`) is behind Cloudflare.
Plain HTTP requests return **403**, with or without a browser User-Agent. A real
browser (Playwright) clears the challenge in ~8 seconds and the full record is
then available in the DOM.

This rules out runtime lookup, which is fine — **a cert only needs to be looked up
once, ever.** The grade on a slab does not change.

Consequences, all of them good:

- No API keys, no rate limits, no server, no runtime dependency on CGC.
- The published site is fully static.
- Lookups are a batch operation run during a working session, not a service.
- The repo is the durable record even if CGC changes their site.

Cover scans are **downloaded and committed** rather than hotlinked, because the
S3 URLs are opaque and may rotate. A committed image means a label printed in
2030 still has its cover art.

## 4. Data model

One JSON file per bin: `data/bins/bin-01.json`.

```jsonc
{
  "bin": "01",
  "title": "Bin 01",
  "location": "",              // optional, free text
  "updated": "2026-08-16",
  "comics": [
    {
      "cert": "4395549004",
      "title": "Venom",
      "issue": "23",
      "issueDate": "9/23",
      "issueYear": "2023",
      "publisher": "Marvel Comics",
      "variant": "Black Saber Comics \"Virgin\" Edition",
      "grade": "9.8",
      "pageQuality": "WHITE",
      "gradeDate": "2024-03-26",
      "labelCategory": "Universal",
      "artComments": "Torunn Grønbekk story\nKen Lashley & Ramón F. Bachs art\nIvan Tao cover",
      "keyComments": "Venom #223",
      "population": { "atGrade": 83, "higher": 0, "topPop": true },
      "images": { "front": "4395549004_OBV.jpg", "back": "4395549004_REV.jpg" },
      "fetchedAt": "2026-08-16T23:12:09Z",
      "repairs": [["Gr�nbekk", "Grønbekk"], ["Ram�n", "Ramón"]]
    }
  ]
}
```

Field names mirror CGC's own labels so the JSON can be checked against the
website by eye. Nothing CGC displays is discarded.

**Derived display title** (not stored — computed at build time):

```
{title} #{issue}                       →  Venom #23
{title} #{issue} : {variant}           →  Venom #23 : Black Saber Comics "Virgin" Edition
```

Earlier drafts proposed an abbreviated `shortTitle` (`Venom #23 Virgin`). This was
**rejected**: the printed sheet should match the text physically printed on the
slab, so the book can be verified against the paperwork by direct comparison.

`population.topPop` is `true` when `higher === 0`. Rendered as `★`.

## 5. Encoding repair

CGC's own pages serve corrupted bytes for non-ASCII characters. The live record
for cert 4395549004 reads `Gr<?>nbekk` and `Ram<?>n` — this is damage in CGC's
data, not in our extraction.

The scraper therefore repairs on ingest:

1. Detect U+FFFD (replacement character) or mojibake sequences in any text field.
2. Apply a lookup table of known creator-name repairs (`Gr?nbekk` → `Grønbekk`,
   `Ram?n` → `Ramón`, and so on, extended as new ones appear).
3. Record every substitution in the entry's `repairs` array so the change is
   auditable and reversible.
4. If a corrupted character can **not** be confidently repaired, leave it and emit
   a build warning naming the cert. Never silently print a replacement glyph on an
   appraisal document.

## 6. Outputs

All three are generated from the same bin JSON. Each is a **separate HTML file**,
because a single document cannot reliably carry two different `@page` sizes.

### 6.1 `label.html` — 4×6 bin label

`@page { size: 4in 6in; margin: 0.2in }`

- Header: bin number (large), comic count, date, QR code (~1.25in square).
- Body: 25 rows, one line each, ~0.18in row height (≈9.5pt type).
- Row: display title left, grade right-aligned in a fixed column, `★` for top pop.
- The grade column stays straight; long variant strings **shrink to fit** their
  line rather than wrapping, so rows never break alignment.

```
┌──────────────────────────────────────────┐
│  BIN 01                         ▓▓▓▓▓▓▓  │
│  25 comics · Aug 2026           ▓  QR  ▓ │
│                                 ▓▓▓▓▓▓▓  │
├──────────────────────────────────────────┤
│ Venom #23 : Black Saber "Virgin" Ed. 9.8★│
│ Venom #24                            9.6 │
│ Spawn #301 : Foil Variant            9.8 │
└──────────────────────────────────────────┘
```

### 6.2 `sheet.html` — 8.5×11 manifest, double-sided

`@page { size: letter; margin: 0.5in }` — ~13 comics per side, 2 sides, one sheet.

Per entry: 0.7in cover thumbnail plus the complete record.

```
┌──────┐  Venom #23 : Black Saber Comics "Virgin" Edition      9.8
│cover │  Marvel Comics · 9/23 · 2023 · Universal · White pages
│      │  Torunn Grønbekk story · Ken Lashley & Ramón F. Bachs art
│      │  Ivan Tao cover
└──────┘  Key: Venom #223 · Graded 2024-03-26 · Cert 4395549004
          ★ Top Pop — 83 in 9.8, none higher
```

A 0.7in thumbnail at 300dpi needs 210px; the stored 500×787 scans are ample.

### 6.3 Web — the QR destination

- `/bin/01/` — the bin page. Same content as the sheet, plus full-size front and
  back scans, responsive for phones. This is what the QR opens.
- `/` — index of all bins, plus **search across the whole collection** by cert
  number or title, answering "which bin is this book in?". Client-side filter over
  a generated `search.json`; no backend.

## 7. Repository structure

```
data/
  bins/bin-01.json          hand-editable source of truth
  images/4395549004_OBV.jpg committed cover scans
src/
  scrape.js                 Playwright cert lookup (batch)
  repair.js                 encoding repair table + logic
  model.js                  display title, top-pop, pagination
  build.js                  JSON -> dist/
  templates/                label, sheet, bin page, index
dist/                       build output (gitignored)
docs/superpowers/specs/     design docs
.github/workflows/pages.yml build + deploy
```

**Stack:** Node.js, no framework. `playwright` for lookup, `qrcode` for QR SVG
generation. Plain HTML + CSS with print media rules — a static site of this size
does not justify a build framework.

## 8. Build and deploy

GitHub Actions builds `dist/` and deploys to GitHub Pages on push to `main`.
Actions-based deployment (rather than branch/folder) keeps build output out of the
repo and leaves `docs/` free for specs.

**Note:** GitHub Pages serves from public repos only on the free plan. The
collection will be publicly viewable. If this becomes unwanted, the same `dist/`
deploys to Vercel with access protection and only the deploy step changes.

## 9. Workflow for adding a bin

1. User pastes up to 25 cert numbers in one message.
2. One Playwright session opens, clears the Cloudflare challenge once, then walks
   all certs sequentially, with a polite delay between lookups.
3. Records are repaired, images downloaded, `data/bins/bin-NN.json` written.
4. `npm run build` regenerates `dist/`.
5. Print `label.html` at 4×6 and `sheet.html` double-sided on letter.
6. Commit and push; Pages redeploys and the QR code resolves to fresh content.

Re-running a lookup for an existing cert is idempotent and overwrites in place.

## 10. Testing

Pure functions get unit tests, developed test-first:

- `repair.js` — known mojibake in, correct characters out; unrepairable input
  warns rather than silently passing.
- `model.js` — display title with and without variant; `topPop` when `higher === 0`;
  pagination splitting 25 across two sides.
- QR payload resolves to the correct bin URL.

`scrape.js` is tested against a **saved HTML fixture** of the Venom record, so the
parser is verified without hitting CGC. One manual live check confirms the fixture
still matches reality.

Print output is verified by generating a PDF and confirming page dimensions are
exactly 4×6in and letter, and that 25 rows fit the label without overflow.

## 11. Corrections found during implementation

The design was right about structure and wrong about several numbers. Recorded
here so the spec is not read as more authoritative than the code.

**Sheet thumbnails are 0.43in, not 0.7in.** §6.2 specified 0.7in-wide covers at 13
per side. Comic scans are 500x787, so a 0.7in-wide cover is 1.1in tall and 13 of
them need 14.3in of a 10in page. Holding the "one double-sided sheet" goal forces
the thumbnail down to 0.43in.

**Sheet entries are four lines, not six.** Art comments arrive as three separate
lines, which made entries 1.19in tall and produced four pages. `compactDetailLines`
folds credits onto one line and merges population into the tail. No field is
dropped, only folded.

**Label row height is computed, not fixed.** The first implementation used
hand-tuned CSS and overflowed a 4x6 page by 1.9in. `labelMetrics` now divides the
space actually remaining by the comic count, so any bin size fits one page. Two
bugs hid in the original arithmetic: an uncounted `margin-top` on the footer, and
a verification script measuring `documentElement.scrollHeight` — the viewport
height — instead of the body.

**Population data loads asynchronously.** Extracting as soon as the record fields
exist lost population for 14 of the first 23 books. The scraper now waits for the
population block, but does not require it.

**CGC uses date placeholders.** Undated books come back as issue date "No Date"
and issue year "1900". These are filtered at display time rather than stored,
so the JSON stays a faithful copy of what CGC served.

**Lookups need real Chrome.** Cloudflare clears for installed Chrome or Edge but
never for Playwright's bundled Chromium. The browser profile persists in
`.cache/chrome-profile`, so the clearance cookie survives between runs.

## 12. Open items

- Bin capacity is fixed at 25 by the physical bins; the code treats it as a
  configurable maximum, not a hard assumption.
- Additional variant/label categories (Signature Series, Restored, Qualified) will
  appear in future lookups. The renderer displays `labelCategory` verbatim, so no
  code change is needed — only visual confirmation that longer values still fit.
