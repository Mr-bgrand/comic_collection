# Market estimate implementation

Approved design: `../specs/2026-09-13-market-estimate-strategy.md`.

## Global constraints
- Never fabricate prices, sales, dates, identity, grade, or subscription access. Missing is not zero. Preserve owner scans and legacy observations.
- Copy identity uses `id` or provider + cert, never a shared null cert. Exact edition/grade/provider matching is mandatory before acceptance.
- TAG may use same-card same-numeric-grade PSA evidence, explicitly labeled as comparison. Never round half grades or transfer this policy to another grader.
- Raw condition is unknown until recorded. Unconditioned raw references stay outside accepted market totals.
- Owner-locked selections survive refreshes. Failed acquisition never erases valid prior evidence. Source date and retrieval date are distinct.
- Keep browser acquisition separate from pure valuation logic. No bypasses, invented APIs, secrets in output, purchases, or recurring schedules.
- All mutations remain local and use existing loopback/same-origin protection. Public build exposes read-only data.
- Meaningful tests precede behavior changes. Preserve existing test behavior unless the design explicitly corrects it.

## Task 1: Valuation core, persistence, queue, and pilot selection

Own new `src/valuation/*.js` modules and tests; existing `src/model.js`, `src/card-valuation.js`, `src/refresh-tag-values.js` only if required for shared resolution. Do not edit browser/server/UI/build/package scripts or real inventory in this task.

Implement an evidence-first record extension `valuation: {observations: [], selection: {observationId, locked, selectedAt}}`. Legacy `valuation:null` works. Every observation is copy-scoped, source-linked and dated, typed by basis (`guide`, `sold-comps`, `psa-comparison`, `owner`, `raw-reference`), carries value/currency, exact matched identity/grade/grader and explicit match/review status. Export documented functions for validating/adding an observation without mutation, explicitly accepting it, and resolving selected/legacy effective value. Require actual finite nonnegative USD amounts; reject mismatched copy IDs, unsupported/unsafe source URLs, invalid dates and source-as-of in future. Evidence may be retained pending review but cannot enter totals through mere import. Raw reference is provisional. Lock protects automatic selection, not explicit owner decisions.

Use existing legacy resolution by default when no accepted observation: direct FMV, manual preference over TAG comparison, then exact owned-PSA comparison. Retain source labels accurately (not every comic price is GoCollect). Shared model should select accepted observations without circular imports. Keep legacy provenance intact and ensure raw provisional values are not counted.

Pure sold-comp estimator: exclude incompatible/unsold/asking-only/non-USD/unknown best-offer entries; deduplicate transaction IDs; require matching identity/grade/grader/condition. Return no estimate on zero, review-only references on one/two, median/minmax on three/four, median/interquartile observed range on five-plus. Do not invent sale count for guide observations. Test even median and quartiles with hand-calculated fixtures and at least wrong edition and duplicate cases.

Queue takes normalized array of stored records with container context; outputs stable copy ID, title, kind/grader/grade, source queries, flags/reasons, priority and current resolution. Missing/stale/review/condition/identity filters; stale uses source date and treats undated separately, not fresh from a rebuild. Include 90-day default and explicit overrides. Deterministic pilot: 10 missing CGC (new+not-listed+no-sales+special), 10 TAG (half grades/exclusives included), five Authority, five unidentified owner raws; report inability to fill quotas rather than duplicate.

File persistence helper reads `readCollection` and updates by full copy ID with atomic replace, original backup and revision conflict check. Validate whole batch before any write, dedupe observation IDs; no silent file path from input. Tests in temporary real fixture collections must prove null-cert raw isolation, locked selection persistence, failed import preservation, and no image changes. Provide interface usage and output shape in task report for next task.

## Task 2: Supported acquisition adapters and CLI

Own `src/valuation/providers/*`, `src/valuation-cli.js`, focused integration tests, package scripts and relevant GoCollect/import-prices/refresh-tag integration. Consume task 1 contracts.

Provide `npm run values -- queue`, `pilot`, `import <json>`, `accept <copy-id> <observation-id>`, and supported provider capture commands. Commands default to dry review where evidence is ambiguous. JSON batch format documented with schema/example. Import stored observations through task 1 validation; rerun is idempotent. Write queue/pilot reports in `data/valuation/` without editing inventory just to queue it.

PriceCharting optional official API adapter: env token only; product search yields candidates, never auto-accept first. Fetch only owner-verified catalog IDs and check identity mappings. API integer cents, export decimal dollars. Correct card/comic category mapping, PSA10 vs generic graded9, CGC10 vs Pristine10, TAG10; unsupported exact grades return review required. Rate-limit one request/sec; bounded retry respecting 429; errors redact tokens. No assumed paid access. GoCollect capture parser validates cert and edition/grade/label, stores guide values plus stats, missing/stale retry selection without wiping old values. Do not invoke legacy anti-automation browser launcher. A saved visible-page capture can be ingested. External PSA evidence is not an owned PSA record.

## Task 3: Admin, Find, totals and history integration

Own lab-server route additions, new admin valuation client/style, build payload, Find filters and value history/print source integration. Consume task 1/2 contracts. Add Admin Values with missing/stale/review queue, search by cert/title, owner image + stored identity, observation details and explicit acceptance, refresh/lookup actions supported by real adapters. Do not label a queue export as a successful fetch. Show provider access/config prerequisites honestly. Allow condition band and identity review only with explicit evidence and protect concurrent revisions. Export queue/capture template for manual capture where automation unavailable. Public app read-only.

Separate market/PSA comparison/owner/provisional raw amounts without double counting. History uses actual observed snapshots, not reconstructed prices from current data. Keep compact 4x6 grader labels, use accurate source/date on masters. Existing build + print flow remains supported.

## Task 4: Execute pilot and supported bulk pricing

Controller work: verify GoCollect sign-in and actual provider access, capture real evidence for deterministic 30-item pilot, inspect five unidentified raw images and record candidate identities with uncertainty. Apply only validated evidence. Record per-item resolved, priced, review, unavailable/access outcomes and source URLs. Then fetch remaining items where verified acquisition works, leaving explicit blocker statuses where subscription/login/condition/matching evidence is missing. Existing owner photos never replaced by comps.

## Task 5: End-to-end verification and delivery

Review all changes independently, run full tests, build, inspect local Admin/Find/source/value details on desktop/mobile, generate and verify print artifacts when valuations affect them. Document actual coverage delta and remaining dependency gaps. Commit tested changes and integrate/push main under existing user authorization; verify deployment if published. Do not call bulk valuation complete if items remain dependent on unavailable sources or owner condition assessment.
