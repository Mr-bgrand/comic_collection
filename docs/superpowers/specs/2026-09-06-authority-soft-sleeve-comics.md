# Authority soft-sleeve comics

Status: all 111 unique owner-supplied Case #12 QR records imported, with 222 verified scans (September 7, 2026).

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
