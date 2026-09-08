# Collection status - September 8, 2026

This is a snapshot of the stored inventory, not a new appraisal or a fresh grader lookup.

**910 objects: 673 comics and 237 cards.**
884 have front scans; 26 are still missing them.
19 physical containers hold 847 copies.

## Containers

| Container | Stable ID | Copies | Storage |
| --- | --- | ---: | --- |
| Bin 01 | `01` | 23 | Physical container |
| Bin 02 | `02` | 23 | Physical container |
| Bin 03 | `03` | 25 | Physical container |
| Bin 04 | `04` | 23 | Physical container |
| Bin 05 | `05` | 25 | Physical container |
| Bin 06 | `06` | 25 | Physical container |
| Bin 07 | `07` | 24 | Physical container |
| Bin 08 | `08` | 22 | Physical container |
| Bin 09 | `09` | 24 | Physical container |
| Bin 11 | `11` | 25 | Physical container |
| Display Wall | `wall` | 5 | Physical container |
| Case #1 | `case-01` | 12 | Physical container |
| Case #2 | `case-02` | 57 | Physical container |
| Graded PSA Case #3 | `case-03` | 94 | Physical container |
| Case Wall Display (Office) | `case-wall-office` | 11 | Physical container |
| PSA Vault | `psa-vault` | 49 | External custody |
| TAG Collection | `tag-collection` | 14 | Location unassigned |
| Comic Bin #13 (Softslabs) | `comic-bin-13` | 98 | Physical container |
| Comic Bin #14 (Softslabs) | `comic-bin-14` | 97 | Physical container |
| Comic Bin #15 (Softslabs) | `comic-bin-15` | 123 | Physical container |
| Comic Case #12 (Softslabs) | `comic-case-12` | 111 | Physical container |

Comic Case #12 contains 111 Authority sleeves. Bins #13 and #14 contain 98 and 97.
Bin #15 contains 27 Authority sleeves plus 96 owner-scanned raw books awaiting
identification. Duplicate submitted IDs were deduplicated; leading zeros are kept.

Case #1 contains 11 CGC cards and one Arena Club card. Case #2 contains 57 TAG cards.
The office card wall contains nine TAG and two PSA cards. PSA Case #3 contains 94
cards, including bare-number entries 108031205, 114218231 and 24709368. The 49-card
PSA Vault export and 14 original TAG cards remain in their separate groups.

## Recorded values

| Group | Recorded total | Valued | No value yet |
| --- | ---: | ---: | ---: |
| Comics | $11,483 | 163 | 510 |
| Cards | $17,175 | 138 | 99 |
| All | $28,658 | 301 | 609 |

45 PSA Vault estimates have no source date. Printing/building does not update
market prices. TAG's explicit value or owner estimate takes precedence; otherwise
an exact-card, same-numeric-grade PSA comparison is labeled with its source/date.
One current comparison is available: TAG Bellibolt H9545478 uses PSA 101450005,
both grade 10, at $148. The other 79 TAG cards await a verified match/value.
Inventory growth and newly valued records affect totals; these are not investment returns.

## Remaining intake and images

- Five CGC cards intended for Case #1 remain queued for verified capture:
  6034330274, 6021634274, 6025099060, 6025067013 and 6032717240. They are not included
  in stored counts or printed paperwork. Their supplied URLs remain in
  [the location intake](../data/incoming/2026-09-06-additional-locations.json).
- Twenty-one PSA cards have no scans on their reviewed cert pages: twenty in
  Case #3 and cert 62837377 in PSA Vault. Five legacy graded comics also need front
  scans. Use Admin > Photos to attach an exact-copy front/back image.
- The original 14 TAG cards still need a physical storage assignment.
- The 96 owner-scanned raw books in Bin #15 need title/issue identification.
- Singularity now uses the owner's supplied *Cornfield Chase* MP3, with looping
  playback, a Music toggle, and uninterrupted audio when controls are hidden.

## Printing and project guide

The [current print set](../print/README.md) contains individual labels/sheets,
a combined 4 x 6 label pack, a duplex Letter master-sheet pack, and a complete
910-copy collection master list. Combined masters preserve case boundaries with
blank reverse pages. Physical packs exclude external/unassigned cards; the complete
master list includes them with their storage status.

Run `npm run build`, then `npm run print`; local Admin's Build & generate runs
the same workflow. `npm run verify:print` checks every physical container's page
size/count and referenced images. The [viewer guide](prototypes/README.md) documents
all five experiences, continuous Ambient playback, values, imports and phone photos.
Older dated design/import checkpoints retain historical counts.
