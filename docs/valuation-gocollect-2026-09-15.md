# GoCollect follow-up — September 15, 2026

Authenticated browser research completed all ten CGC comic certificates in the original pilot. Following the owner's approval of starred estimates with limited history, four exact matches were imported and explicitly accepted: $20, $85, $110 and $600. This adds $815 across four previously unvalued comics. Every one carries `*` because the supporting history is thin or undocumented. No wrong-edition or wrong-signer price was accepted.

## Accepted estimates and follow-up checks

- Detective Comics facsimile, cert 4137945006: **$20***, explicit guide FMV, source date and supporting count not supplied.
- Final Boss, cert 2757895001: **$85***, median of three matching completed sales, observed $46–$150 range. Tyler Kirkham signature/date were added through the audited metadata-review path before matching.
- Back to the Future second printing, cert 4137947002: **$110***, one sale, August 23, 2026. GoCollect transaction 23164057 / eBay 178104609887, comparable CGC 4523526002. The sale detail explicitly distinguishes actual buyer-paid $110 from original $125 asking price.
- Back to the Future JJ's Virgin, cert 1430525018: **$600***, one verified signer-matched sale, August 29, 2026. GoCollect transaction 23229352 / eBay 117385099049, comparable CGC 1430545003, Michael J. Fox signature October 25, 2019. The detail confirms $600 paid versus $760 asking. Other recent rows with unidentified signers were excluded. Owned signer metadata was recorded before matching.
- Strange Academy's $200 sale (December 7, 2025, comparable CGC 4464392006) identifies **Skottie Young**, not the owned copy's **Humberto Ramos**. It remains unvalued despite being the same variant and grade.

The replayable observation batch is `data/valuation/gocollect-reviewed-2026-09-15.json`. Import remains separate from selection. Existing source fields, owned images, certificates, container membership and all unrelated records were preserved. Collection coverage is now **307 of 933 valued**, **626 without a selected value**, total **$29,576.42**. Raw references remain excluded.

The `no-sales` parser misclassification described below has also been corrected: visible averages without a separate FMV now produce `no-fmv` and require review. Older stored captures retain their original fields for audit. The following table records the initial research findings, before the follow-up selections above.

## Results

| Owned certificate | Edition / grade | Visible result | Assessment |
| --- | --- | --- | --- |
| 4137945006 | Detective Comics #27, 2022 Facsimile, CGC Universal 9.0 | $20 GoCollect FMV; recent averages blank | Exact certificate/edition/grade guide candidate. Source FMV date not supplied. |
| 2757895001 | Final Boss #1, SMZ Comics Metal Edition G, CGC Signature 9.8; Tyler Kirkham | Annual average $94 across 3 sales; individual sales $46, $85, $150 | Three matching edition/grade/signature sales support an $85 median, observed range $46–$150. |
| 1430525018 | Back to the Future #1, JJ's Comics & Art Virgin, CGC Signature 9.8; Michael J. Fox | Annual average $944 across 8 sales; 90-day $921 / 2; 30-day $600 / 1 | Aggregate does not establish matching signers: seven recent rows have no signer identified. Do not apply $944 as a verified estimate for this signed copy. |
| 2733544003 | Strange Academy #1, Young Variant, CGC Signature 9.8; Humberto Ramos | Annual average $200 / 1 sale | Single-sale lead; individual signer/transaction still needs review. |
| 4137947002 | Back to the Future #1, Second Printing, CGC Universal 9.4 | $110 / 1 sale in each displayed period | Single-sale lead; individual transaction still needs review. |
| 2691440008 | Revolution #1, Sharper Collectibles, CGC Signature 9.8; Marat Mychaels and Sajad Shah | Certificate panel maps to Blank Sketch Cover; $100 annual average / 1 sale | Conflicting catalog edition. Exclude from valuation until reconciled. |
| 2765925001 | TMNT/Usagi Yojimbo: WhereWhen #2, CGC Signature 9.8; Kevin Eastman | All recent averages blank; grade detail reports no tracked sales | No supported estimate found in this source. |
| 3760617001 | White Widow #2, Rebel Killer, CGC Signature 9.8; Jamie Tyndall signature and sketch | All recent averages blank | No supported estimate found in this source. Sketch must be considered separately when finding comps. |
| 4089841007 | Wretches #1, Momoko Metal, CGC 9.8 | Certificate details, without a comic catalog link or price panel | No matched catalog price supplied by cert lookup. Not proof that every GoCollect search would fail. |
| 4137946001 | All-New Ghost Rider: Engines of Vengeance, Second Printing, CGC 9.4 | Certificate details, without a comic catalog link or price panel | Collected edition containing #1–5, not the single issue; no matched catalog price supplied. |

## Confirmed Final Boss comparable sales

Source: [Final Boss SMZ Metal Edition G](https://gocollect.com/app/comic/final-boss-1-4), CGC → Signature → Grade 9.8. All three rows show white pages, the Amazing Fantasy #15 homage, and Tyler Kirkham signing on July 22, 2022, matching the owned certificate's signature details.

| Sold date | USD | Format | Comparable cert | GoCollect displayed-row identifier |
| --- | ---: | --- | --- | --- |
| 2026-07-18 | 150 | Auction | 2733505001 | 22830449 |
| 2026-07-08 | 85 | Fixed Price | 2757898001 | 22746443 |
| 2025-10-05 | 46 | Auction | 2757854001 | 20467746 |

Median is $85. The displayed annual mean is rounded to $94. These are different measures; the mean is not a GoCollect FMV field. Dates and identifiers belong to reported comparable transactions, not the owner's copy.

## Source limitations discovered

The legacy `buildFmv` function classified an absent separate FMV as `no-sales`, even when sales averages and counts existed. Historical Final Boss and Strange Academy records contain those averages. The parser now distinguishes `no-fmv`; dashboard statistics, the value editor and CLI describe it as needing review. Historical source fields remain intact for audit.

GoCollect's Back to the Future overview briefly showed different aggregate statistics from its certificate result. Opening the exact 9.8 Signature detail agreed with the certificate result ($944 / 8). Individual transactions were then reviewed: the $600 Michael J. Fox row's detail explicitly reports the buyer-paid amount, with the original $760 price struck through. That verified amount supports the accepted single-sale estimate; the unmatched aggregate does not.

Existing records for several signed comics contain the Signature Series category but omit the signer field. The certificate lookup reveals signer information. For the two accepted signed copies, that metadata was recorded through the audited review workflow before accepting signature-specific comps. Other signed books still need that review.

## Source pages

- [GoCollect certificate lookup](https://gocollect.com/app/comics/cert-lookup) — each of the ten certificates above was submitted through the visible form.
- [Detective Comics #27 Facsimile](https://gocollect.com/app/comic/detective-comics-27-facsimile-edition-2022)
- [Back to the Future JJ's Virgin](https://gocollect.com/app/comic/back-to-the-future-1-jj-s-comics-art-virgin-variant)
- [Strange Academy Young Variant](https://gocollect.com/app/comic/strange-academy-1-young-variant)
- [Back to the Future Second Printing](https://gocollect.com/app/comic/back-to-the-future-1-2nd-printing)
- [Revolution catalog mismatch](https://gocollect.com/app/comic/revolution-1-blank-sketch-cover)
- [WhereWhen #2](https://gocollect.com/app/comic/tmnt-usagi-yojimbo-wherewhen-2-cvr-a-sakai)
- [White Widow Rebel Killer](https://gocollect.com/app/comic/white-widow-2-rebel-killer-variant)

Research retrieved September 15, 2026; source publication dates and sale dates are distinct from retrieval. No credentials or session data are saved in this report.

## Verification

- 422 automated tests pass, including provisional estimate selection, wrong-grade rejection, raw-condition exclusions, signer review and missing-FMV messaging.
- The browser preview shows $29,576.42 across 307 of 933 copies; 262 starred estimates totaling $25,864.57 are already included in that total, not added again. Mobile record layout was checked at 390 × 844.
- Regenerated 43 PDFs. The combined case-label pack contains 38 pages; the duplex Letter sheet pack contains 76 pages. The collection master list includes all 933 records. Print verification passed and rendered sheets were visually checked for prices and the asterisk legend.
- Import replay makes zero record changes. Existing scans, grades, certificates, container membership and unrelated records were preserved. The separate owner-supplied `all-case-labels-4x6-updated.pdf` was left unchanged.
