# Collection market estimate plan

Prepared September 13, 2026. Status: proposed workflow; no prices were changed during this audit.

## Objective and approach

Give each identifiable collectible a defensible USD resale estimate where evidence supports one, with a date, source, matching details, and uncertainty. Keep a useful explanation for anything that cannot yet be valued. The owner has GoCollect access and may have PriceCharting access; confirm the latter's data entitlements before depending on it.

Use a hybrid workflow: existing GoCollect data first, a reusable catalog match for other providers, and a small review queue for difficult editions and condition questions. A guide-only approach would miss many exclusives and raw copies; researching every copy manually would duplicate work and be hard to maintain. Fetch once per verified edition/grade/condition and apply it to compatible copies while keeping their individual IDs, photos, and locations.

The default estimate is the item's likely individual resale price before seller fees, shipping expenses, and taxes. It is not a bulk dealer offer, insurance replacement figure, or a guaranteed sale price. Optional estimated net proceeds can be calculated separately from explicit fee and shipping assumptions. No automatic discount should be applied to the entire collection to imply a bulk offer.

## Audited starting point

Read directly from the collection JSON and the current value resolver on September 13:

| Group | Stored copies | Missing value |
| --- | ---: | ---: |
| CGC graded comics | 265 | 102 |
| CBCS graded comics | 2 | 2 |
| PSA cards | 145 | 8 |
| TAG cards | 80 | 79 |
| CGC cards | 11 | 11 |
| Arena Club cards | 1 | 1 |
| Authority-authenticated raw comics | 333 | 333 |
| Unidentified owner-scanned raw comics | 96 | 96 |
| Total | 933 | 632 |

There are 203 unpriced graded items and 429 unpriced raw comics. Existing recorded coverage is 301/933 copies; the recorded total of $28,658 describes that priced subset only and was not reappraised here.

Of the 102 unpriced CGC comics, 23 have never been looked up, 39 have an old `not-listed` result, and 40 have an old `no-sales` result. Seven unpriced CGC records have signature information or a Signature Series label. The 23 new books are Bin 10.

All 333 Authority records have UPCs, 331 have cover codes, and 305 have an issue year. Their identities still require edition matching; an absent variant name does not establish a standard cover. The other 96 raw books have scans but no title/issue identification. No raw copy currently has a recorded condition assessment. Forty-five existing PSA Vault estimates have no source date and need a separate freshness review. Five previously submitted CGC card certs are still awaiting import and are outside these totals.

## 1. Establish matching and evidence rules

Keep physical-copy IDs separate from catalog identities. Use `raw:15-001` for an unidentified scan, `Authority:<id>` for an Authority copy, and grader/provider plus cert for slabbed items. Never join the whole collection on a nullable or unqualified cert field.

For comics, match title, volume/year, issue, printing, UPC including its supplement where present, cover artist/code, retailer exclusive, virgin/trade dress, foil/finish, and language. A visually similar cover is a candidate, not sufficient proof. Verify slab grade, grader, label category, signatures, restoration, and qualifiers separately.

For cards, match year, set, card number, subject, language, parallel/rarity, edition, serial-numbered print run, autograph/relic attributes, and qualifiers. Preserve the actual grade and named designation, such as CGC Pristine. A missing card number on an older issue can be resolved with a verified catalog identity rather than inventing a number.

Use OCR and image comparison to propose candidates, then validate them against catalog details. Keep a dated alias table for equivalent set/subject spellings, including bilingual TAG labels. Do not automatically accept a provider search's first result. Distinct physical copies remain distinct even when they share a catalog match.

Store comparable-sale images only as evidence references. They must never replace the owner's front/back scans. In particular, images in PSA's similar-sales section belong to other copies.

## 2. Price graded comics through GoCollect first

Start with the 23 Bin 10 books, then explicitly retry the 79 old missing results. The current `src/gocollect.js` checks whether an `fmv` object exists, so a previous empty result is skipped unless forced. Add a selection mode for missing values and stale observations rather than forcing a rewrite of every record.

For each CGC cert, validate the returned issue, edition, numeric grade, and label before accepting a value. Keep the provider's estimate and available 30/90/365-day statistics separately. Record when data was fetched and the latest underlying sale date when available; a fresh fetch does not make an old sale recent.

For `not-listed` results, search GoCollect's title/edition catalog and verify the cover; cert-to-catalog lookup failure does not prove the edition has no market. For `no-sales`, inspect the correct grade and edition, then move to sold-comparable research if there is still no supported estimate. Preserve both statuses.

CBCS needs title/edition research rather than the CGC cert form. GoCollect documents grader and label filters, including CBCS and Signature Series; verify the current signed-in interface during the pilot. Its cert form is CGC-specific. [GoCollect guide](https://gocollect.com/blog/a-quick-guide-on-using-go-collect/)

Signed, restored, qualified, 9.9/10.0, and unusual foil editions require review before acceptance. Do not apply a flat signature premium, assume top population creates a premium, or substitute an unsigned CGC 9.8 for a different product. GPA is an optional secondary CGC source if later needed, not a subscription prerequisite for this plan.

## 3. Price cards and extend the TAG comparison rule

Refresh the eight missing PSA estimates and separately review the 45 undated Vault values. Preserve the original observations. For all card graders, prefer credible exact-product, same-grader/grade evidence when available. The owner's rule remains: when a usable TAG-specific estimate is absent, use an exact-card PSA estimate at the same numeric grade, explicitly labeled **PSA comparison for TAG**.

The current `src/refresh-tag-values.js` only compares TAG cards with PSA copies already imported into this collection. It resolves one TAG copy. Extend it to externally verified catalog prices without creating fictional owned PSA cards or fabricated PSA cert numbers. External evidence should carry a provider product ID and its price URL; a real comparison cert is optional when the evidence is catalog-level.

PriceCharting's paid API supports current estimates; historical sales are not included. Its documented fields distinguish PSA 10, TAG 10, CGC 10, and CGC Pristine 10, while lower-grade buckets can combine graders or grades. Confirm subscription access and catalog coverage during the pilot. [PriceCharting API](https://www.pricecharting.com/api-documentation)

Consequently, a generic “Graded 9” value cannot be presented as an exact PSA 9 comparison. Use PSA-specific evidence for that rule. Preserve all four TAG 8.5 grades; never round them to 9. If an exact-grade PSA comparison is unavailable, retain a clearly labeled contextual range or a missing estimate. TAG-exclusive products may have no PSA counterpart at all.

For sports cards, verify access separately against [SportsCardsPro's documented feeds](https://www.sportscardspro.com/api-documentation). A PriceCharting subscription is not assumed to include every sports-card dataset. CGC and Arena Club do not inherit the owner's TAG-to-PSA substitution rule automatically.

## 4. Identify and price raw comics

First process the 333 Authority books using their existing UPCs, metadata, and scans. Resolve missing years and ambiguous covers before fetching prices. Their authentication is evidence of identity, not a numeric condition grade or an automatic value premium.

Next identify the 96 owner scans in small contact-sheet batches. Propose title, volume, issue, printing, and cover matches. Preserve `raw:` IDs and original photos as metadata improves. Request another photo only where a barcode, back cover, indicia, or visible defect is needed to resolve a specific question.

Use exact-edition raw sold comparables as the default accessible source. CovrPrice is an optional specialist source: it offers raw and slabbed sales and reports seller-described raw condition. Its displayed fallback can use a common condition when the requested condition has no data; capture that distinction instead of importing the displayed number as an exact match. [CovrPrice FAQ](https://covrprice.com/faq/)

Treat broad ungraded guide values as provisional references, not condition-specific valuations. Show **condition not assessed** until the owner confirms a broad condition band using the front, back, spine, corners, and relevant defects. A front image alone cannot establish page completeness, restoration, or a precise numerical grade. Do not unseal protected comics just to fill a pricing field.

Condition-confirmed copies can receive a comparable-sales estimate. Identified but unassessed copies can receive an explicitly provisional raw reference or evidence-supported range in a separate subtotal. Do not silently classify every modern book as Near Mint. Never derive raw value by simply subtracting a grading fee from slab value.

## 5. Use sold evidence for gaps and calculate uncertainty

Use the owner's available eBay Product Research access for difficult editions and lower-grade PSA comparisons. It supports up to three years of sales and accepted Best Offer amounts. [eBay Product Research](https://www.ebay.co.uk/sellercentre/news/2024-june/product-research)

Do not build the plan around unrestricted eBay sold-history API access: Marketplace Insights access is restricted. Use authorized exports or visible research results where available. [eBay developer access](https://partnernetwork.ebay.com/page/developer-questionnaire)

The following are proposed operating rules, to calibrate during the pilot rather than treating them as universal appraisal standards:

- Search the most recent 90 days first. Expand to 365 days when fewer than five compatible sales exist. Older sales can inform context but must remain visibly dated.
- Aim for 5–10 exact comparable transactions, deduplicated across sources using listing ID, cert where present, sale date, and venue. Do not count the same sale in both a guide and eBay as independent corroboration.
- Separate single-copy sales from lots, reproductions, facsimiles, reprints, wrong covers, mismatched grades, different signers, and canceled/returned sales when known. A hidden accepted offer is not the original asking price.
- Normalize to USD item price when separable. Preserve shipping and auction buyer's premium as separate fields; exclude tax. Do not combine an unknown all-in amount with item-only amounts without labeling that difference.
- For at least five compatible sales, use their median as the working estimate and the 25th–75th percentiles as an observed typical range. This range is not a statistical confidence interval or a guarantee of sale proceeds. If the range is broad, flag it for review rather than deleting inconvenient transactions.
- Three or four compatible sales produce a medium-confidence estimate with the observed min/max range. One or two produce a low-confidence reference that requires review. Zero produces no sale-based numeric estimate.
- A provider guide estimate is stored as a guide estimate, not relabeled as our calculated sold median. If its underlying sales are unavailable, do not fabricate sample count, recency, confidence, or a plus/minus percentage range.
- Route rare labels/signatures, identity conflicts, fewer than three sales, unassessed raw condition, more than 40% dispersion/conflict between credible estimates, and provisional values over $500 to review. The dollar and dispersion thresholds are initial triage choices, adjustable after the pilot.

## 6. Store and display estimates consistently

Create a source-observation history and one explicit accepted valuation per copy. Each observation should retain:

- stable copy/catalog IDs, provider product ID, and the exact matched attributes;
- amount or low/central/high values where supported, USD currency, and basis (`guide`, `sold-comps`, `psa-comparison`, `owner`, or `raw-reference`);
- provider/source URL, fetched timestamp, provider as-of date, latest sale date, and comparable IDs/count when available;
- condition assumptions, match confidence, price-evidence confidence, observed spread, and explicit missing/review reason;
- approval/selection status, any owner lock, and history of superseded observations.

Keep existing `fmv`, `manual`, `market`, and `psaComparison` data auditable during migration. Never overwrite a valid past observation with a timeout or missing result. Preserve owner-entered figures; new automatic observations must not silently replace an owner-locked selection.

`src/import-prices.js` currently writes marketplace results only to `data/bins` and to a separate `market` field. `effectiveValue()` does not select that field, and `marketValueLabel()` assumes comic FMV means GoCollect. Extend ingestion to `data/cards` and `data/comics` and introduce one source-aware resolver used by the app, printouts, and value history. Importing a CSV alone will not currently make these new estimates appear everywhere.

Proposed modules: `src/valuation/identity.js` for catalog matches; `observations.js` for validated evidence and history; `estimate.js` for comparable calculations; `resolve.js` for accepted-value selection; and `queue.js` for status, batching, caching, and retry rules. Keep provider acquisition adapters separate from pure matching/calculation logic and reuse existing parsers where sound.

In Admin, add a valuation queue with **Fetch missing**, **Refresh stale**, and **Review matches**. Show the owned copy beside the candidate details, with source, grade/condition, date, and evidence. Find should distinguish missing value, missing identity, condition not assessed, stale value, and needs review. Batch acceptance is available only for verified compatible matches.

Display supported market estimates, TAG/PSA comparisons, owner estimates, and provisional raw references as distinguishable categories. Clearly state which categories are included in the headline total and show coverage. A proposed all-in total may include labeled comparisons, but unknown-condition raw references must remain separately visible. Never turn missing prices into $0.

Use the same accepted values and source labels for detail views, collection charts, master sheets, and exports. Keep the compact 4×6 labels readable; put evidence detail on master sheets and in the app. Inventory additions and newly valued books must be distinguished from price changes on already-valued copies. Do not fabricate historical prices from today's estimate or claim that rebuilding refreshed the market.

## Delivery order and acceptance checks

1. **Build the queue and run a 30-item pilot:** ten missing CGC comics spanning new intake and prior failed matches; ten TAG cards spanning integer grades, half grades, and exclusives; five Authority books; five unidentified scans. Measure identity-match rate, supported valuation rate, review burden, and source access. An honest unresolved result counts as a correctly handled case, not as a priced item.
2. **Complete graded intake:** finish Bin 10, retry old CGC misses, review CBCS and special labels, then process the 99 missing card values. Reuse verified catalog matches across copies. Refresh undated PSA values as a separate batch so completion counts remain clear.
3. **Process the 333 Authority books:** resolve edition matches and attach raw references, then confirm condition for supported estimates. Review the first batch before accepting a larger one.
4. **Identify the 96 owner scans:** use small visual batches and target only unresolved questions. Run the same raw-pricing process after identification. No invented values for unidentifiable books.
5. **Integrate and publish accepted results:** update the shared resolver, history categories, Admin review flow, Find filters, documentation, build, and print packs. This phase requires implementation and validation; this document has not performed it.

Validation must cover wrong-edition rejection; correct half-grade handling; mixed-grader guide buckets; signed versus unsigned and raw versus slab separation; duplicate/null cert safety; provider currency units; zero versus missing; repeated-sale deduplication; stale/blocked fetch preservation; owner locks; and unchanged photo/location data. An accepted test observation must appear consistently in the record view, collection total, history, and master PDF. Existing values must retain their original provenance after migration.

Run relevant unit tests and the normal `npm test`, `npm run build`, `npm run print`, and `npm run verify:print` checks when implementation lands. Visually review the affected app views and printable pages before publishing.

## Ongoing maintenance

Proposed cadence after the first pass: refresh active/volatile or higher-value priced items monthly; ordinary items quarterly; review stale missing results every 90 days or on demand. A daily provider cache does not imply the whole collection needs daily repricing. This proposal does not create a scheduled job.

Use provider APIs or supported exports where access permits, and authenticated browser review for exceptions. PriceCharting documents at most one API request per second and current-value-only feeds; cache verified product matches and do not refetch duplicate editions per copy. Its API amounts are integer cents, while downloadable CSV amounts use dollar decimals. [API limits and formats](https://www.pricecharting.com/api-documentation)

Keep credentials and private captures local, outside the public GitHub Pages bundle. Store only the valuation evidence needed for provenance, consistent with the source's export/reuse permissions. A lost login, blocked page, rate limit, missing subscription feature, or unavailable price should produce an explicit resumable queue status. No new subscription, account signup, or authentication-bypass work is part of this plan.
