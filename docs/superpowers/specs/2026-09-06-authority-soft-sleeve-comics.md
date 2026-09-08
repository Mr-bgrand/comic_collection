# Authority soft-sleeve comics

Status: all 333 unique owner-supplied Authority records imported across Case #12 and Bins #13–15, with 666 verified scans (September 7, 2026, Arizona).

## Bin #15 checkpoint

The owner supplied 28 links containing 27 unique certificates. `6877341863`
(Absolute Batman #4) appeared twice and is stored once. All 27 unique IDs were
new to the inventory. They are in `data/comics/comic-bin-15.json` as the physical
**Comic Bin #15 (Softslabs)** at **Comic Bin #15**, retaining input order and all
four leading-zero IDs. Repeated issue/variant names with different certificates
remain separate copies.

The complete input, including the repeated link, is preserved in
`data/incoming/2026-09-07-authority-bin15.json`. All 27 reviewed DOM captures are in
`data/incoming/authority-bin15/`; completion and verification are recorded in
`data/incoming/authority-bin15-progress.json`. Every record reports RAW Authentic,
with no numeric grade or invented value. Normalized fields match the original
UTF-8 captures. All 54 front/back scans were checked against the captured viewer
URLs, dimensions and SHA-256, and visually reviewed. There are no missing scans
or identical image files within this batch.

The whole collection now totals 720 objects: 577 comics and 143 cards. Find at
`/review/?case=comic-bin-15` shows 27 results and 27 unvalued records, with one
result for the duplicate certificate. Leading-zero certificate search, both
record images, Admin bin fields and Print Studio links passed browser checks.
The existing build and print commands passed. Bin #15 has one 4×6 label page and
two 8.5×11 master-sheet pages; every certificate appears exactly once on the
master sheet. All three PDF pages were rendered and visually reviewed. The
printed date follows existing UTC behavior (September 8); the owner-local import
date is September 7 in Arizona. Printed QR links retain the configured public
base URL; the updated collection has only been built locally.

## Bin #14 checkpoint

The owner supplied 98 links containing 97 unique certificates. `4212643688`
(Avengers: Twilight #5) appeared twice and was imported once. All 97 unique IDs
were new to the collection. The physical container is
`data/comics/comic-bin-14.json`, **Comic Bin #14 (Softslabs)**, at **Comic Bin #14**.
Input order and all 11 leading-zero IDs are preserved. Other repeated issue/variant
names have distinct certificates and remain separate physical copies.

The complete input, including the repeated link, is preserved in
`data/incoming/2026-09-07-authority-bin14.json`. There are 97 reviewed DOM captures
in `data/incoming/authority-bin14/`; the completion and verification manifest is
`data/incoming/authority-bin14-progress.json`. Two slow viewers loaded on revisit.
All records report RAW Authentic; values and numeric grades remain unset.

All normalized metadata fields were checked against their source captures, with
UTF-8 text preserved. Each of the 194 original front/back JPEGs was checked against
its captured viewer URL, dimensions and SHA-256, then visually reviewed in contact
sheets. No image files are identical within this batch. Detective Comics #400,
`7633260283`, is explicitly a Blank Facsimile Edition: its nearly blank front and
reverse are the supplied scans, not loading placeholders.

The collection now totals 693 objects: 550 comics and 143 cards. The stable link
`/review/?case=comic-bin-14` returns 97 Find results and 97 unvalued records, with
one result for the duplicated certificate. Leading-zero search, both record
images, Admin bin editing fields and Print Studio links were verified in the app.
The build and print commands passed. The 4×6 label PDF has four pages and the
8.5×11 master sheet has seven pages; each certificate appears exactly once in
the master sheet. All 11 PDF pages were rendered and visually checked. Printed
dates follow the existing UTC behavior (September 8); this import was completed
September 7 in Arizona. Printed QR links retain the configured public base URL;
the updated collection has only been built locally.

## Bin #13 checkpoint

The owner supplied 98 unique QR links, all new to the inventory. They are stored
in `data/comics/comic-bin-13.json` as **Comic Bin #13 (Softslabs)**, with physical
location **Comic Bin #13**. Input order and all five leading-zero IDs are preserved.
Different certificates for the same issue/variant remain separate physical copies.
The whole collection now has 596 objects: 453 comics and 143 cards.

The original request is `data/incoming/2026-09-07-authority-bin13.json`; all 98
rendered captures are in `data/incoming/authority-bin13/`. The completion manifest
is `data/incoming/authority-bin13-progress.json`, with no remaining or failed IDs.
Each page's certificate number, RAW Authentic status, metadata and explicit
front/back viewer URLs were checked. All 196 original JPEGs were downloaded,
hashed, matched to their capture URLs and visually reviewed in contact sheets.
There were no identical image files. Three delayed viewers loaded on revisit.

Capture staging must use UTF-8 for both the page and form submission. A staging
encoding issue was detected in PDF review and repaired from the intact original
browser captures. Every normalized metadata field was then compared with its
source capture; no Unicode replacement characters remain in this batch. Preserve
the provider's accented names, punctuation and separate `Item Number`/`Item number`
fields. No numeric grades or values were invented.

The stable local deep link is `/review/?case=comic-bin-13`. Find returns all 98
copies, the no-value filter counts all 98, and leading-zero certificate search and
front/back record images were checked in the browser. Admin exposes the physical
bin for renaming and printing. The 4×6 label PDF has four pages; the 8.5×11 master
sheet has seven pages and includes all 98 certificate IDs. Build and print use the
existing commands. Printed QR links use the configured public base URL; this import
has only been built locally.

## Case #12 checkpoint

The owner supplied 112 links; `0097410939` appeared twice and is stored once.
Existing Deathlok `1700597971` was moved into **Comic Case #12 (Softslabs)**,
then 110 new certificates were added. The physical container is
`data/comics/comic-case-12.json`; all leading zeros are preserved. Every record
reports RAW Authentic, without a numeric grade or an invented valuation.

Reviewed per-record captures are in `data/incoming/authority-case12/`; the
complete request and duplicate input are retained in
`data/incoming/2026-09-06-additional-locations.json`. Source checks, local image
SHA-256 checks and a full front/back contact-sheet review covered all 222 scans.
Authority inserts placeholder images before its genuine image URLs load: wait
for both `img.card-front` and `img.card-back` to point to the official image host.
The `id.theauthority.com` QR now redirects to the numeric `www` URL; all observed
canonical forms are accepted only when their ID matches the rendered certificate.

Admin can rename this case and print its four 4×6 label pages and eight Letter
master-sheet pages. Case QR links use the stable `?case=comic-case-12` identifier.
They point to the configured site URL; this work has only been built locally.

The owner has comics in protective soft sleeves with QR codes. These belong in
the comic collection alongside rigidly slabbed comics. Holder format and grading
are separate facts: a soft sleeve and Authority ID do not establish a numeric
grade, third-party grader, authentication status, value or current storage location.

## First supplied record

- Owner's QR: https://www.theauthority.com/1700597971
- Authority collectible ID: `1700597971` (preserve as a string).
- The site's certificate form navigated to https://www.theauthority.com/Id/1700597971.
- Signed-in record: **Deathlok 50th Anniversary Special #1, Miller Variant**, Marvel,
  volume 1, cover D, Frank Miller cover. Authority displays **RAW Authentic**.
  Authentication is stored separately from a numeric grade; `grading.status=raw`
  prevents the historical missing-grader fallback to CGC.
- On sale: September 18, 2024. Printed date: November 2024. Preserve both source dates.
- Capture: `data/incoming/authority-1700597971.json`, retaining all 27 rendered rows.
  Authority's `Item Number` is issue 1; `Item number` is cover D. Do not collapse
  these case-sensitive labels. The page's Redeemed badge does not establish a home bin.
- Initial inventory: `data/comics/soft-sleeves.json`, now moved to
  `data/comics/comic-case-12.json` with the owner's supplied location. No matching
  cert or Deathlok entry was found before the first import. Value remains null.
- The examine viewer supplied two 450 × 727 JPEGs from `imga.theauthority.com/i/C4E/`.
  Its internal UUID is unrelated to the numeric Authority ID. `Type=Front` and
  `Type=Back` identify sides; the server redirects to the same internal item's
  `Default.jpg` and `Back.jpg` on the same host. Preserve viewer and resolved URLs,
  capture/retrieval dates, dimensions and SHA-256 alongside unchanged original bytes.
- Both scans were visually checked against the record: Deathlok cover and LEGO Star
  Wars reverse. Collection / Lab shows the thin sleeve without added rigid casing;
  Find includes Deathlok, Frank Miller, the UPC and Authority ID. Study shows both scans.

## Extraction and integration

1. Resolve each owner's QR link through the rendered Authority lookup. Verify the
   page identifies the same 10-digit collectible ID before reading object fields.
2. Capture title, issue, publisher, date/year and variant when exposed. Preserve
   printed/authentication wording exactly, with provenance. Keep missing data null.
3. Treat the Authority collectible ID as a provider identity, separate from any
   CGC/CBCS cert or other grading credential the record might also report. Match
   existing inventory before adding a new physical copy.
4. Inspect the actual item-image viewer, including lazy-loaded front/reverse views.
   Discover its hosts and URL patterns from this record. The page's store banners,
   recent submissions, marketplace photos and other users' collectibles are not
   scans of this copy. Do not infer image URLs from its numeric ID or import a
   page-wide image list. Keep original URLs, source page, side basis and capture
   times beside any accepted scan.
5. Preserve holder format as `soft-sleeve` from the owner's description. Keep
   grading and authentication separate until verified. The legacy model defaults
   a missing grader to CGC: do not feed an unverified Authority record into that
   path or label the Authority ID as a CGC cert.
6. Ask for its physical bin/location only after extracting the record. An Authority
   account/lookup alone does not establish current vault custody, especially when
   the owner has the sleeve in hand.
7. In Collection / Lab, retain the Comics filter and add holder information to the
   record. A future soft-sleeve rendering should use a thin protective envelope,
   without a fabricated grading label. Study uses the true front/reverse photos.
8. Store any valuation with its named basis and date. An asking price, numeric
   grade, authentication result or date of import is not an appraisal.

Batch input can be decoded QR URLs or printed Authority IDs. `npm run authority:import
-- data/incoming/authority-1700597971.json` imports a reviewed DOM capture, downloads
its validated scan pair and updates the same provider ID without duplicating it.
Refreshes preserve owner-entered location, valuation, manual estimates and notes.
The importer deliberately rejects unreviewed record types/statuses. Actual QR image
decoding and automatic signed-in page capture are not implemented. No credentials
or authenticated browser state are retained in the repository.
