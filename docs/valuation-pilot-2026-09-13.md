# Market estimate pilot — September 13, 2026

The first pass covers a fixed sample of 30 copies. It establishes a repeatable evidence workflow and records access, edition, condition, and sales gaps. The remaining queue is **not a completed price fetch**.

## Coverage

| Measure | Before | Current |
| --- | ---: | ---: |
| Copies with a recorded value | 301 / 933 | 303 / 933 |
| Copies without an accepted value | 632 | 630 |
| Recorded subset total (USD) | $28,658.00 | $28,761.42 |

There are 13 pending observations, including 7 unconditioned raw references totaling $32.55. These reference amounts do **not** enter the recorded collection total. The total combines existing records from different source dates and is not a current appraisal of all 933 copies.

## Accepted evidence

- **TAG R4092198 — Magby, TAG 10: $88.57.** Exact English Paradox Rift #186/182. The direct [TAG 10 guide on PriceCharting](https://www.pricecharting.com/game/pokemon-paradox-rift/magby-186) takes precedence over its $178.75 PSA 10 alternative. Five displayed TAG sales span August 2025–May 2026. The guide has no published as-of date; it remains marked undated. Medium confidence.
- **TAG S2994291 — Yanma, TAG 9: $14.85 PSA comparison.** Exact Japanese Heat Wave Arena #064/063. Median of five [reported PSA 9 completed sales](https://www.pricecharting.com/game/pokemon-japanese-heat-wave-arena/yanma-64), November 2025–July 2026; observed interquartile range $10.00–$14.95. One direct TAG 9 sale is insufficient to establish a sold estimate. This is a same-grade PSA comparison, not a TAG sale or an owned PSA card. Medium confidence.

Both selections are locked against automatic replacement. Their evidence and alternatives are retained. Reimporting the saved document is idempotent and does not select prices by itself.

## Why other pilot copies remain unpriced

| Pilot group | Copies | Result |
| --- | ---: | --- |
| CGC comics | 10 | Subscriber pricing needs GoCollect sign-in. The public WhereWhen #2 Signature panel was checked; nine other cert lookups have not been run in this pilot. Existing results were preserved. |
| TAG cards | 10 | Two accepted; two direct-guide pairs pending review; one single-sale reference; three missing exact half-grade evidence; two TAG-exclusive cards without matching comps. |
| Authority raw comics | 5 | Full UPC matches found; ungraded references saved, condition unassessed. |
| Owner-scanned raw comics | 5 | Two complete-barcode edition matches; three need edition/finish confirmation. No condition inferred from covers. |

Cynthia’s Garchomp ex and Scream Tail have direct TAG guides but thin/old or widely dispersed supporting sales, so they remain review candidates. Cleffa TAG 8.5 has one exact PSA 8.5 sale. Mamoswine, Magneton, and Jared Jones have no usable same-grade evidence in the displayed sources. TAG 8.5 is never rounded to PSA 8 or 9. World Scaries retail mystery-pack prices are not comparable secondary sales.

The old GoCollect link for CGC 2691440008 names a Blank Sketch Cover while the owned record names a Sharper Collectibles edition. That catalog mapping needs review; it has no current price and has not been treated as an exact match.

The two verified raw editions are **Spider-Man: Reign 2 #1 (2024)**: [Skottie Young, UPC 75960620394900121](https://www.pricecharting.com/game/comic-books-spider-man-reign-2/spider-man-reign-2-young-1-2024), and [Leinil Francis Yu, UPC 75960620394900131](https://www.pricecharting.com/game/comic-books-spider-man-reign-2/spider-man-reign-2-yu-1-2024). Authority authentication and a protective sleeve do not establish comic condition.

## Resume the remaining queue

1. Sign in to GoCollect in the open browser. Capture exact title/edition, grade and label tier; signatures and restoration must also match. A subscriber account is not an API credential.
2. In local Admin → Values, review the copy’s own image and identity. Open a source lookup or capture form, save evidence pending review, then explicitly accept a supported candidate. Export/import is available for batches.
3. If a PriceCharting or SportsCardsPro official API token is available, configure it locally using the documented environment variable. Verify each catalog mapping before a capture. Generic grade buckets cannot stand in for exact unsupported grader/grade combinations.
4. For raw comics, confirm edition and assess condition first. Obtain comparable sold copies in that condition band; broad ungraded guides remain references. Use three or more compatible sales for an estimate, or retain review status when evidence is sparse.
5. Review stale, undated, identity and condition queues separately. Preserve source-as-of dates; a refresh/build date does not make an old value current.

No recurring automation, paid subscription, or API access was purchased or enabled by this pass.

Five previously submitted CGC card certificates remain outside the live inventory: 6034330274, 6021634274, 6025099060, 6025067013 and 6032717240. The first cert was rechecked in this session and reached a browser security-verification page. Their intake and subsequent pricing remain pending; none is silently included in the 933-copy or missing-value counts.

### Missing-value queue by group

| Group | Copies |
| --- | ---: |
| Owner raw | 96 |
| Authority raw | 333 |
| CGC cards | 11 |
| TAG cards | 77 |
| Arena Club cards | 1 |
| CBCS comics | 2 |
| CGC comics | 102 |
| PSA cards | 8 |

## Artifacts and commands

- [Per-copy outcomes and current coverage](../data/valuation/pilot-outcomes-2026-09-13.json)
- [Saved source facts and individual sale IDs](../data/valuation/pilot-source-captures-2026-09-13.json)
- [Original evidence import](../data/valuation/pilot-import-2026-09-14.json)
- [Missing-value work queue](../data/valuation/queue.json)
- [Provider formats and commands](../src/valuation/providers/README.md)

PowerShell: use `npm.cmd` so flags reach the script correctly.

```powershell
npm.cmd run values -- status
npm.cmd run values -- queue missing
npm.cmd run values -- import data/valuation/pilot-import-2026-09-14.json --dry-run
npm.cmd run build
npm.cmd run print
npm.cmd run verify:print
```

Dates: the research session was September 13 in America/Phoenix and September 14 UTC. Source publication dates, retrieved-at timestamps and individual sale dates are stored separately.

## Verification

The completed implementation passed all 408 automated tests and a production build with the real 933-copy collection. The inventory audit confirmed every copy, container assignment, grade, scan and legacy price field was preserved; only the two reviewed raw identities and new valuation evidence changed. Existing historical snapshot entries were retained.

Local Admin was checked at desktop and 390 x 844 phone sizes: selected prices remain locked, source dates are distinct from capture dates, and an unconditioned raw reference cannot be accepted into totals. The verification browser disabled WebGL, so scene-bound Find/history interactions could not be fully exercised there; their filters, source projections and history categories passed automated checks.

All 43 PDFs were regenerated and print verification passed. The combined packs contain 38 4 x 6 label pages and 76 duplex Letter pages for 884 physical copies; the collection master includes all 933 copies. Representative label, graded-card sheet and raw-comic sheet pages were rendered and visually inspected.
