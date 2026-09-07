# Graded cards: PSA, TAG and CGC Cards

Status: partially implemented; remaining design below
Date: 2026-09-06

## September 7 import checkpoint

- **Case #2:** all 57 TAG certificates, 114 MAIN scans, complete.
- **Case Wall Display (Office):** nine TAG and two PSA cards, 22 scans, complete.
  PSA 107968908 is Paul Skenes, NM-MT 8, a displayed PSA estimate of $15;
  PSA 76211263 is Corbin Carroll, GEM MT 10, a displayed estimate of $25.
  Both estimates are dated September 7 and retain their cert-page source.
- **Case #1:** 11 existing CGC cards plus Arena Club 8AC002362928, complete.
  Professor Turo's Scenario is MINT+ 9.5, with centering/edges/corners/surface
  subgrades 9.5/9.5/9/10. Both official slab scans are saved. No value is invented.
- **Pending:** five additional CGC certs (6034330274, 6021634274, 6025099060,
  6025067013, 6032717240) remain at the site's security verification. Their exact
  owner-supplied URLs and Case #1 assignment are saved in the intake request.

The collection currently holds 143 cards: 51 PSA, 80 TAG, 11 CGC and one Arena
Club, alongside 355 comics. Physical cases appear in Admin for rename/location
editing and in Print Studio. The existing Letter layout handles cards as well
as comics (14 copies per side); large 4×6 labels paginate at 28 copies per page.
`npm run print` generates all physical containers, with atomic output and short
retries for transient Windows file locks. A denser dedicated card sheet remains
an optional future design, not a prerequisite for printing these cases.

`npm run psa:certs -- <capture>` imports reviewed public cert data into an
owner-assigned physical case without implying PSA Vault custody.
`npm run arena:import -- <capture>` preserves Arena Club cert identity and
subgrades. All imports reject duplicate ownership across containers and retain
source URLs; refreshes preserve owner notes, photos and manual valuation.

Adds graded trading cards to a system that currently holds 244 graded comics.
Three sources: PSA cert lookup, TAG cert lookup, and a PSA Vault CSV export.

## Implementation checkpoint — September 6, 2026

The offline Vault import is implemented as `npm run vault -- <csv>`. The current
49-card export is stored in `data/cards/psa-vault.json`. Collection / Lab includes
those cards alongside 244 comics, with filters, search, records, scan Study,
external Vault storage and four spatial formations.

All 49 rendered PSA cert pages were checked. The manifest in
`data/incoming/psa-cert-images.json` supplies 48 verified front/reverse pairs to
`npm run cards:images -- <manifest>`. Cert **62837377** has no scans on its loaded
page and is marked unavailable. Source URLs, side basis, timestamps, dimensions
and local checksums are retained. Only official scan hosts are accepted.

CSV estimates stay export-sourced, with an unknown valuation date and a separate
import timestamp. Private acquisition details are excluded from the portable
prototype. Reimport preserves enrichment and detects ownership conflicts.

TAG import is now implemented as `npm run tag -- data/incoming/tag-card-captures.json`.
All 14 owner-supplied links now have verified records and 28 downloaded MAIN scans
in `data/cards/tag-collection.json`: eleven TAG 9s and three TAG 10s. Y2994116
(Origin Forme Dialga V) and S2994291 (Yanma) loaded successfully when retried after
the owner confirmed both URLs. Earlier 404 observations remain in the intake
history; no TAG cards are pending.

Captures retain bilingual identity, grade wording, population/date, rank wording,
grading chronology, centering, DINGS counts and dimensions. The unexposed overall
1000-point score is null; unlabeled per-corner figures are not substituted for it.
No population-higher count or value is inferred from a rank or grade. TAG locations
are unassigned and do not inherit PSA Vault custody. Full-resolution MAIN originals
are retained locally in ignored `data/originals`, with original and display-file
checksums; committed display masters remain 1600px. Reimport retains owner data,
scans and earlier records and rejects cross-container duplicate ownership.

Collection / Lab, Admin backup and the collection master list include the TAG
records. Find supports Japanese names and exact grader queries. The remaining
sections describe intended work, **not shipped commands**: automatic cert/report
capture, card-specific catalogue pages/sheets and interactive report overlays.

### TAG — Case #2 intake

The owner supplied 57 TAG cert links for physical **Case #2**. The exact requested
list and container identity are saved in `data/incoming/tag-case-02-request.json`.
Reviewed rendered page evidence is retained in `tag-case-02-captures.json`, and
official FRONT_MAIN / BACK_MAIN URLs in `tag-case-02-images.json`, in the same folder.

All 57 are now imported with **114 complete scans**, verified source URLs and
original/display checksums. Initial rate-limit and 404 responses resolved with
paced retries; no cards remain pending. The case contains 24 Gem Mint 10s, one
Pristine 10, 26 Mint 9s, three NM MT+ 8.5s, two NM MT 8s and one Near Mint 7.
G7325430 (Wilwolf) explicitly reports **TAG SCORE 960**, retained and shown separately
from its grade of 10. Scores not exposed by the other reports remain unknown.
Sports products retain their full printed name, with subset and parallel wording
kept as additional description; original identity lines are also preserved.

`npm run tag -- data/incoming/tag-case-02-captures.json` imports into
`data/cards/case-02.json`. The TAG importer now accepts an explicit physical
container, preserves other graders already in that case, and still rejects a TAG
copy recorded in another container. A missing optional set/variety line is kept
absent; sports cards can use the product name printed in TAG's report.
Use `npm run cards:images -- data/incoming/tag-case-02-images.json data/cards/case-02.json`
for the exact scans, then rebuild Collection / Lab. Values remain unknown until
supported estimates are recorded. TAG can redirect valid certificates to its 404
screen while rate limiting; a failed lookup is not proof of an invalid certificate.

### CGC Cards — Case #1

All eleven owner-supplied cards are imported into `data/cards/case-01.json`, a
physical card container named **Case #1**, separate from comic bin-01. Reviewed
DOM captures live in `data/incoming/cgc-card-captures.json`; exact scan links in
`data/incoming/cgc-cert-images.json`. Run `npm run cgc:cards -- <capture>` and
`npm run cards:images -- <manifest> data/cards/case-01.json` to refresh. Reimport
preserves owner data, scans, other graders and existing copies; duplicates in
other containers are rejected. All 22 scans are complete, with original and
1600px-display checksums. Values remain unassigned.

The current collection is **376 items: 245 comics, 49 PSA, 71 TAG and 11 CGC cards**.
CGC records include language, grading date and population at the reported grade
plus the actual higher count; a grade of 10 does not imply none higher. Four
report Gem Mint 10, four grade 9, two grade 8.5 and one Mint+ 9.5. Venusaur V
4135876101 reports Gem Mint 10 on CGC's current page, while its verified physical
slab label reads Gem Mint 9.5. Both are retained and displayed separately.

CGC Cards uses three observed scan buckets: CGC tradingcards, legacy CGC comics,
and CSG cards. The allowlist requires an exact hostname, full-size filename,
matching certification string and side. Visual QA found **4135876101 and
4093107189 have reversed Obverse/Reverse labels**. Their reviewed orientation
maps REV to the actual front and OBV to the actual back, with explicit evidence
in the capture, record and manifest. Reimport retains the correction. Do not
blindly assume OBV is the artwork side, or infer internal image UUIDs from certs.


---

## 1. What the sources actually give us

All three were probed against live pages before this was written, because the
answers changed the design twice.

### PSA — `psacard.com/cert/<cert>/psa`

Public, no login. Scrapeable, and richer than CGC:

```
2023 TOPPS #401 CORBIN CARROLL
ITEM GRADE      GEM MT 10
PSA ESTIMATE    $23.00
PSA POPULATION  2,142      PSA POP HIGHER  0
Year 2023 | Brand/Title TOPPS | Subject CORBIN CARROLL
Card Number 401 | Category BASEBALL CARDS | Label Type W/ FUGITIVE INK
```

Two things matter more than they look:

- **PSA quotes a value.** `PSA ESTIMATE` is on the same page as the grade, so
  cards need no GoCollect lookup at all. `gocollect.js` already skips non-CGC
  graders, so it needs no change.
- **Population maps exactly onto the comic shape.** `PSA POPULATION` and `PSA
  POP HIGHER` are `population.atGrade` and `population.higher`. Top-pop
  detection, the dashboard counter and the sheet all work unmodified.

**Images lazy-load.** Nothing is in the DOM until the page is scrolled — the
first probe reported zero images on a card that has two. The scraper must
scroll before reading. This is the same defect that made scrape.js record 30
comics as having no cover.

**The page also carries other people's cards.** "Sales of Similar Items" renders
five eBay photos at higher resolution than the card's own scan. Only
`d1htnxwo4o0jhw.cloudfront.net/cert/` is the real card; everything else is
someone else's copy. Attaching one would put the wrong picture on an appraisal
document, which is why the GoCollect image fallback was rejected earlier for
exactly this reason.

### TAG — `my.taggrading.com/card/<cert>`

Public, no login, and by far the richest of the three:

```
JACKSON MERRILL
2021 BOWMAN DRAFT SAPPHIRE EDITION #BDC-119
GRADE 8 NM MT        FRONT 100%   BACK 100%
CERT #D1216494
POPULATION   1 NM MT GRADED   1 TOTAL GRADED
CARD RANK    1st HIGHEST NM MT   1st HIGHEST OVERALL
GRADED 4/11/2025
DIG REPORT   corners F/B, edges F/B, surface F/B (dings)
             centering  F: 49L/51R 36T/64B   B: 55L/45R 57T/43B
             dimensions H 3.500"  W 2.505"
```

**Images are 4442x6153** — `_FRONT_MAIN`, `_BACK_MAIN`, plus `_SFX` variants and
per-defect close-ups, on `d39lwrz0lm7c9r.cloudfront.net/card-images/`. That is
nine times the pixels of a CGC scan (500x792) and 4.2 MB each.

**The API is encrypted.** `api.taggrading.com/graded-cards/public/score/<cert>`
returns `iv:ciphertext` hex, not JSON. The rendered DOM is the interface.

### PSA Vault — the CSV export

49 rows, 33 columns. Populated across all 49 rows:

| Always present | Sometimes |
|---|---|
| Cert Number, Grade Issuer, Grade | Variety (37), Serial (6) |
| Year, Set, Card Number, Subject | My Cost, Date Acquired, Source (9) |
| Category, Item, Item Status | PSA Estimate (45) |
| Vault Status, Vaulted Date, Days Vaulted | |

**This changes the vault plan.** The CSV already carries the full identity, the
grade *and* the estimate — so vault cards need no PSA lookup for their core
record. Only population and images require one, and only if wanted. A vault
import that never touches the network is a legitimate first cut.

---

## 2. Data model

### Owner-confirmed intake and image requirements

The owner confirmed that `data/incoming/My Collection CSV - 49.csv` is the
current PSA Vault collection. Additional physical PSA and TAG cards can arrive
as pasted certification lists, cert-page URLs, or CSV files, grouped by grader
and optionally by storage box. No source-code commit is required to process a
list supplied in the conversation or a file already in this workspace.

- Preserve certification identifiers as strings, including leading zeroes and
  TAG letters. Identify a physical copy by grader plus certification number.
- Reconcile new lists against existing records, including the vault export.
  A repeated cert does not create another copy or silently change its location.
- Missing box information means location unassigned. It never implies PSA
  Vault storage. Example certs in this specification are research fixtures,
  not additional ownership claims.
- For PSA, scroll the rendered cert page to trigger lazy loading and allow
  image discovery before deciding scans are unavailable. Accept candidate
  URLs only when the parsed hostname is exactly
  `d1htnxwo4o0jhw.cloudfront.net` and the path begins `/cert/`. Exclude eBay
  and similar-item images regardless of resolution. Establish front/back
  association from the actual card's image viewer; flag ambiguous sides.
- For TAG, obtain URLs from the rendered card page. The primary front/back
  scans must use hostname `d39lwrz0lm7c9r.cloudfront.net`, path prefix
  `/card-images/`, and `_FRONT_MAIN` / `_BACK_MAIN` filenames. Keep `_SFX`
  and defect close-ups as separately labeled supporting assets, never as
  replacements for plain scans. Do not depend on the encrypted score API.
- Do not construct image URLs from a certification number: internal image IDs
  and UUIDs must come from the page. Retain the discovered source URL for
  each asset, its side/type, the cert-page URL, and the retrieval timestamp
  alongside the local image filename.
- A failed or incomplete lookup must remain retryable and distinct from a
  confirmed absence of scans. Never substitute an image of a similar card.

These are required implementation and fixture-test cases. They are not yet
implemented by the current comic-only import or 3D prototype.

### Stored records

`data/cards/box-01.json`, `data/cards/psa-vault.json`, mirroring `data/bins/`.

The record reuses the comic shape wherever a field means the same thing, so
census, value and top-pop logic work untouched:

```jsonc
{
  "kind": "card",              // absent means "comic"; nothing stored is rewritten
  "cert": "76211263",
  "grader": "PSA",             // PSA | TAG
  "grade": "10",
  "gradeLabel": "GEM MT 10",   // PSA and TAG both name their grades
  "population": { "atGrade": 2142, "higher": 0, "topPop": true },
  "fmv": { "value": 23, "source": "psa-estimate", "url": "...", "fetchedAt": "..." },
  "images": { "front": "76211263_FRONT.jpg", "back": "..." },

  "year": "2023",
  "brand": "TOPPS",            // "Brand/Title" on PSA, "Set" in the vault CSV
  "subject": "CORBIN CARROLL",
  "cardNumber": "401",
  "category": "BASEBALL CARDS",
  "variety": "SPECIAL ART RARE",
  "labelType": "W/ FUGITIVE INK TECHNOLOGY",

  "tag": { /* TAG only: subScores, centering, dings, dimensions, rank */ }
}
```

`displayTitle` becomes `2023 Topps #401 Corbin Carroll`; `gradeLabel(card)`
gives `PSA 10`. Both live in `model.js` beside the comic versions, chosen on
`kind`.

TAG's DIG report is kept whole under `tag`. It is the most detailed grading data
any of the three graders publishes, it costs nothing to store, and an appraisal
is exactly where per-corner defect data earns its place.

---

## 3. Containers

A card container is not a comic bin and never mixes with one.

| | Physical box | PSA Vault |
|---|---|---|
| Holds | 25-100 cards | the 49 vaulted |
| 4x6 label | no | no |
| 8.5x11 sheet | yes | yes, for portfolio and appraisal |
| On the site | yes | yes, marked `virtual` |

No 4x6 labels for cards at all — a card box is not labelled the way a bin is.
The vault is a virtual container: it prints a sheet but nothing physical exists
to stick a label on.

---

## 4. Commands

```bash
npm run psa -- --box 01 <cert> [cert ...]   # PSA cert lookup
npm run tag -- --box 01 <cert> [cert ...]   # TAG cert lookup
npm run vault -- "data/incoming/My Collection CSV - 49.csv"
```

All three share the Playwright + persistent Chrome profile already used for CGC
and GoCollect, and all three save after every card and resume by skipping
stored certs — the pattern that made CGC's rate limiting survivable.

`vault` reads the CSV alone by default. `--enrich` follows each cert to PSA for
population and images, which is the only part that needs the network.

---

## 5. Images

Committed masters at **1600px on the long edge** (~350 KB). Full-resolution
originals go to `data/originals/`, gitignored.

The repo already holds 103 MB of committed comic scans. TAG's originals are
4.2 MB each, so 100 cards would add 830 MB — past the 1 GB GitHub Pages site
limit, in a public repo. 1600px is still twice the resolution of every CGC scan
in the collection and is more than the wall or a printed sheet can use.

---

## 6. Print

A `cardSheet` template, denser than the comic sheet: cards are smaller and a
card row has no variant string to wrap. Paginates to 100 cards. QR on every
side, pointing at the container's page.

The comic sheet's own numbers do not transfer — that layout was derived for 14
entries per side at 1.25in. Card rows get their own measurement pass, verified
by `verify:print` the same way.

---

## 7. Site

- Dashboard splits comics and cards, with a combined total.
- Cards join the wall; they have front scans, and TAG's are the sharpest images
  in the collection.
- `/box-01/` and `/psa-vault/` pages, like bin pages.

---

## 8. Testing

Pure functions, against fixtures captured from the real pages:

- `parsePsaCert` — from a saved copy of the Corbin Carroll page, including the
  case that matters: that an eBay "similar item" image is never chosen.
- `parseTagCard` — sub-scores, centering ratios, dings, rank, dimensions.
- `parseVaultRow` — column detection, and the `-` placeholder meaning absent.
- `normalizeCardRecord` — the shared shape.
- `cardSheet` pagination.

The template lint tests pick up the new template automatically.

---

## 9. Not building

- **The PSA API.** No token, and the public page carries everything.
- **eBay variant matching for cards.** The krono round trip stays comics-only
  until it has run once end to end.
- **Autograph grades.** The vault CSV has the column; every row reads `-`.
- **Sold/listing history.** Present in the CSV, empty in all 49 rows, and it is
  a different feature from an inventory.

---

## 10. Open questions

1. **Box naming.** `box-01` mirrors `bin-01`. If the physical boxes have names
   worth using ("Bowman 2021"), say so and containers take a title like the
   wall does.
2. **Whether to enrich the vault at all.** The CSV gives grade and value
   without a single request. Population and images cost 49 lookups.
