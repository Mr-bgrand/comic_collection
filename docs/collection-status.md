# Collection status - September 18, 2026 (UTC)

This is a snapshot of the stored inventory, not a new appraisal or a fresh grader lookup.

**933 objects: 696 comics and 237 cards.**
907 have front scans; 26 are still missing them.
20 physical containers hold 884 copies.

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
| Bin 10 | `10` | 23 | Physical container |
| Bin 11 | `11` | 25 | Physical container |
| Display Wall | `wall` | 5 | Physical container |
| Case #1 | `case-01` | 26 | Physical container |
| Case #2 | `case-02` | 57 | Physical container |
| Graded PSA Case #3 | `case-03` | 94 | Physical container |
| Case Wall Display (Office) | `case-wall-office` | 11 | Physical container |
| PSA Vault | `psa-vault` | 49 | External custody |
| Comic Bin #13 (Softslabs) | `comic-bin-13` | 98 | Physical container |
| Comic Bin #14 (Softslabs) | `comic-bin-14` | 97 | Physical container |
| Comic Bin #15 (Softslabs) | `comic-bin-15` | 123 | Physical container |
| Comic Case #12 (Softslabs) | `comic-case-12` | 111 | Physical container |

Comic Case #12 contains 111 Authority sleeves. Bins #13 and #14 contain 98 and 97.
Bin 10 contains 23 CGC comics with verified front/back slab scans, including the
earlier cert 4350046007. The long barcode resolves to cert 4350046003 (Spawn #1,
Convention Edition, 9.8). Its Signature Series comic retains the Kevin Eastman
signature details. See the [Bin 10 intake](../data/incoming/2026-09-09-bin-10-request.json)
and [CGC captures](../data/incoming/2026-09-10-cgc-bin-10-captures.json).
Bin #15 contains 27 Authority sleeves plus 96 owner-scanned raw books. Two now
have verified editions; 94 still need identification. Duplicate submitted IDs
were deduplicated; leading zeros are kept.
Find > Raw comics now opens those 96 owner scans directly. Their focus labels and
record IDs are readable while identification is pending, and Singularity spreads
them through the full flight instead of clustering their sequential scan IDs.

Case #1 contains 14 TAG cards, 11 CGC cards and one Arena Club card. Case #2 contains 57 TAG cards.
The office card wall contains nine TAG and two PSA cards. PSA Case #3 contains 94
cards, including bare-number entries 108031205, 114218231 and 24709368. The 49-card
PSA Vault export remains in external custody. On September 9, the owner assigned
the 14 original TAG cards to Case #1. Their existing records and slab photographs
were moved from the unassigned group; no duplicate copies were created. See the
[assignment record](../data/incoming/2026-09-09-tag-case-01-assignment.json).

## Recorded values

| Group | Recorded total | Valued | No value yet |
| --- | ---: | ---: | ---: |
| Comics | $13,652.95 | 181 | 515 |
| Cards | $19,652.37 | 185 | 52 |
| All | $33,305.32 | 366 | 567 |

45 PSA Vault estimates have no source date. Printing/building does not update
market prices. TAG's explicit value or owner estimate takes precedence; otherwise
an exact-card, same-numeric-grade PSA comparison is labeled with its source/date.
TAG Bellibolt H9545478 retains its $148 comparison with owned PSA 101450005,
both grade 10. The valuation pilot added Magby R4092198 at $88.57 from a direct
TAG 10 guide and Yanma S2994291 at $14.85 from five same-grade PSA 9 sales.
The September 16 follow-up added 21 TAG estimates, two CGC card estimates and one
CGC comic estimate. The September 18 follow-up added 22 TAG comparisons and two
Bin 10 comic estimates, totaling $956.24. Five carry an asterisk for weak or stale
history. The other 34 TAG cards await a verified match/value. See the
[latest reviewed prices](valuation-reviewed-2026-09-18.md) and the
[September 15 comic follow-up](valuation-gocollect-2026-09-15.md) for evidence.
A second September 18 pass broadened the sources to MyComicShop and ComicBookRealm,
adding eight more graded comic estimates ($853.72), all starred, and ten raw references.
See the [expanded comic review](valuation-expanded-2026-09-18.md). A third pass added
three more graded estimates ($219.25), all starred, and 19 raw references. See the
[continued research](valuation-overnight-2026-09-18.md). Thirty-six unconditioned raw
references now total $218.19 but are excluded from the recorded total. See the
[pilot report](valuation-pilot-2026-09-13.md) for sources, dates and remaining gaps.
Inventory growth and newly valued records affect totals; these are not investment returns.

## Remaining intake and images

- Bin 10's 23 comics have verified identities and scans. Ten have reviewed, starred
  estimates totaling $1,059.71; thirteen still need a supported market value.
- All 80 TAG cards now use verified full-slab front and back photographs from
  each cert page's Slabbed image captures section: 57 in Case #2, nine on the
  office wall and 14 in Case #1. The original card-only MAIN scans and
  their source history remain in `cardScans`. The viewer, its overview textures,
  and the physical-case master sheets use the slab photographs. Source manifests
  and repeat-import instructions are linked in the [viewer guide](prototypes/README.md).
- Five CGC cards intended for Case #1 remain queued for verified capture:
  6034330274, 6021634274, 6025099060, 6025067013 and 6032717240. They are not included
  in stored counts or printed paperwork. Their supplied URLs remain in
  [the location intake](../data/incoming/2026-09-06-additional-locations.json).
- Twenty-one PSA cards have no scans on their reviewed cert pages: twenty in
  Case #3 and cert 62837377 in PSA Vault. Five legacy graded comics also need front
  scans. Use Admin > Photos to attach an exact-copy front/back image.
- Ninety-four owner-scanned raw books in Bin #15 need edition identification.
  Copies 15-003 and 15-004 are verified Spider-Man: Reign 2 #1 (2024), Skottie
  Young and Leinil Francis Yu variants. All 96 still need condition assessment.
- Singularity now uses the owner's supplied *Cornfield Chase* MP3, with looping
  playback, a Music toggle, and uninterrupted audio when controls are hidden.

## Printing and project guide

The [current print set](../print/README.md) contains individual labels/sheets,
a combined 4 x 6 label pack, a duplex Letter master-sheet pack, and a complete
933-copy collection master list. Combined masters preserve case boundaries with
blank reverse pages. Physical packs exclude external/unassigned cards; the complete
master list includes them with their storage status.

Run `npm run build`, then `npm run print`; local Admin's Build & generate runs
the same workflow. `npm run verify:print` checks every physical container's page
size/count and referenced images. The [viewer guide](prototypes/README.md) documents
all five experiences, continuous Ambient playback, values, imports and phone photos.
Older dated design/import checkpoints retain historical counts.
