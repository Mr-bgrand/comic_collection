# Graded cards: PSA and TAG

Status: draft for review
Date: 2026-09-06

Adds graded trading cards to a system that currently holds 244 graded comics.
Three sources: PSA cert lookup, TAG cert lookup, and a PSA Vault CSV export.

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
