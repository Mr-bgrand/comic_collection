# Task 2 report: supported acquisition and CLI

Delivered provider adapters, callable local-admin services, CLI, interchange documentation/schema, and focused legacy integrations. No real inventory or valuation reports were generated/changed by this task. No live provider request, browser launcher, credential access, purchase, merge or push was performed.

## Files and contracts

Primary documentation: `src/valuation/providers/README.md`. Structural JSON schema: `src/valuation/providers/batch.schema.json`. Concrete fictional JSON example and all capture fields are in the README.

`src/valuation-cli.js` exports:

- `providerStatus(env=process.env)` -> `{gocollect,pricecharting,sportscardspro,json}`, each with `{configured:boolean,mode:string}`. Never returns tokens. Configured does not assert paid entitlement.
- `valuationReport(root,{pilot=false,...queueOptions}={})` -> `{status:'queued',retrievedValues:0,providers,items,...pilotQuotas}`. Reads only; queue options are task1 buildQueue options.
- `importValuationDocument(root,document,{dryRun=false}={})` -> `{status:'reviewed',copies,changed:0}` for dry review; `{status:'imported',changed,records}` after persistence.
- `acceptValuation(root,copyId,observationId,{revision}={})` -> core `applyValuationBatch` result. Revision required. Explicit owner selection with `locked:true`.
- `captureValuation(root,{copyId,revision,provider,capture},{persist=false,client}={})` -> provider outcome plus `document` on captured dry output, or `persistence` when persist true. Revision mandatory. Outcome without observation does not write. Captured observations import pending, never auto-select.
- `runValues(args,{root=process.cwd()}={})` -> JSON-friendly result. Only CLI queue/pilot write report files.

Import document shape:

```js
{schemaVersion:1,edits:[{copyId,revision,observations:[coreObservation]}]}
```

No paths, no `accept` field, no duplicate copy IDs. All input observations validate before writes. Identical original-file reruns skip truly unchanged edits even if their revision is now old; accepted status/owner locks persist. A stale changed or new observation is rejected; conflicting duplicate IDs throw. This is deliberately more usable than calling core directly with the stale original revision. The acceptance service never relaxes revision checking.

CLI commands:

```
npm run values -- status
npm run values -- queue [missing stale undated review condition identity]
npm run values -- pilot
npm run values -- import file.json [--dry-run]
npm run values -- accept <copy-id> <observation-id>
npm run values -- capture file.json [--import]
npm run values -- search <pricecharting|sportscardspro> <query>
```

Queue/pilot write `data/valuation/queue.json` / `pilot.json`, labelled queued with retrievedValues 0. Search returns candidates only. Capture defaults dry; successful output contains an import-ready `document` property. `npm run prices -- file.json` delegates to the same safe pending importer; old CSV behavior remains intact.

## Provider service details

`priceChartingObservation(record,capture)` from `src/valuation/providers/pricecharting.js`:

```js
capture = {id,product,mapping,grader?,retrievedAt,asOf}
mapping = {
 productId,productName,consoleName,category:'card'|'comic',
 identity:identityOf(record),verifiedBy,verifiedAt,url
}
```

Mapping is an explicit owner-reviewed catalog match, not a search result inference. Adapter verifies exact stored identity + returned catalog ID/name/set/category. Output persists the full mapping as `observation.providerMapping`; `catalog` additionally records the field and reviewed provenance. Future API refresh can reuse `providerMapping` and pass the prior observation's `match.grader` (important for PSA fallback).

`createPriceChartingClient({env=process.env,provider='pricecharting',fetch?,sleep?,clock?})` returns `{configured,search(query),capture(record,mapping,{id,grader?,asOf=null,retrievedAt=currentUTC})}`. API credentials only read `PRICECHARTING_API_TOKEN` or `SPORTSCARDSPRO_API_TOKEN`; no browser entitlement assumption. Official HTTPS API requests only, no redirects, 30s request timeout. Serializes requests at >=1s intervals. HTTP429: at most three total requests, respects Retry-After seconds or HTTP date; >60s returns retry-later without early retry. Transport errors redact request URL/token; response content is token-redacted. Product API response doesn't include sold histories, and no such claim is made.

Default captureValuation clients are reused per provider for local-admin serialization. If injecting a client, reuse one per provider. Environment changes require server restart. Different processes are not coordinated; avoid concurrent separate CLI API runs.

Provider values: integer cents -> decimal USD. Exact grade10 PSA/manual-only, TAG/condition-21, CGC/condition-17, CGC Pristine/condition-19. Generic Grade9 is never PSA9. Only TAG may request a PSA comparison. Raw, non-10/half-grade or comic aggregate API guide values return review-required. Comic field meanings are documented but exact grader/label cannot be assured, so no comic API aggregate becomes exact slab evidence. Cross-provider catalog URL reuse is rejected before fetch. Missing/zero provider fields produce missing without invented $0 evidence.

Saved capture provider names are `pricecharting`, `sportscardspro`; API capture names are `pricecharting-api`, `sportscardspro-api` (same capture fields without product).

`goCollectObservation(record,capture)` from `src/valuation/providers/gocollect.js`:

```js
capture = {id,text,url,cert,grade,grader:'CGC',labelType:null|string,
 identity,reviewedBy,reviewedAt,retrievedAt,asOf:null|date}
```

Supports only saved visible-page result captures. Explicit reviewedBy/reviewedAt attests manual source review of cert/title/issue/edition/grade/label; copied identity alone is insufficient. Adapter checks matching cert, grade, CGC grader, exact identity and label, official URL, and visible FMV card. Returns captured/review-required/login-required/not-listed/no-sales/unknown. GoCollect guide avg30/90/365 and annual sales count stay under `observation.stats`; annual guide count is never a sold-comps saleCount. No failed capture clears a prior value. `asOf` stays null when undated.

For Task3 batch refresh: acquire using `captureValuation(...,{persist:false,client})`, collect successful `document.edits`, then call one importValuationDocument batch. This avoids invalidating revisions between copies in the same file. Keep existing selection locked; acquisition is pending. Look for reusable `observation.providerMapping`, never treat sourceQueries or source URL alone as a verified match. Copies without a supported mapping/credential return a truthful manual-capture or review-needed outcome.

## Integrations

- `refresh-tag-values.js`: retains prior comparison if current owned-PSA matching fails. Reports selected external PSA observations via basis and allows `psaCert:null`. It never creates fake owned PSA records.
- Existing `src/card-valuation.test.js` expected deletion when imported PSA collection emptied. Updated this intentional policy expectation to retained value/provenance; all original direct value/image/repeatability assertions retained.
- `gocollect.js`: exported pure `shouldRefreshGoCollect(record,{now,staleDays=90,force=false})` retries missing/not-listed/no-sales/stale/undated CGC comic evidence; `preserveGoCollectValue(previous,next)` preserves prior numeric value on missing response. Legacy loop uses these helpers. Legacy browser launcher remains in the old module for compatibility and was never invoked; supported new flow imports only its pure parseFmvCard function.
- `import-prices.js`: JSON routing to safe pending core import. Legacy CSV marketplace snapshots remain separate.

## TDD and verification

Used test-driven-development and writing-good-tests reference, then verification-before-completion. Wrote provider tests against minimal stubs, observed missing behavior; converter stubs were adjusted from null to empty object so assertions demonstrated missing values/status rather than null access. API stub initially lacked search method (module API absence); subsequent behavior tests exercise real adapter with only external transport/clock substituted. Added specific red regressions before fixes for CLI queue/capture persistence, TAG preservation/external reporting, GoCollect retry/preservation, JSON prices delegation, retained provider mapping and incompatible grader handling. Additional idempotence/retry exhaustion cases passed as coverage of already implemented tested paths. No claim that every supplementary assertion independently failed first.

Full suite initially caught one obsolete legacy deletion expectation; inspected and updated the policy test as described above. Final `npm test`: **392 passed, 0 failed**. Log: `.superpowers/sdd/2026-09-13-market-estimates/task-2-tests.log`.

Focused provider suite: **7 passed**. CLI workflow suite: **6 passed**. GoCollect existing + retry suite: **15 passed**. All tests use temp collections, fixture responses and controlled time; no live price fetched or real inventory write. `git diff --check` passes (Git CRLF normalization notices only).

## Remaining limits / review notes

- GoCollect exact edition verification is an explicit manual review assertion, not fuzzy text extraction. Contradictory or deceptive reviewer declarations cannot be independently authenticated by this local file workflow; capture source must be reviewed by the owner.
- PriceCharting comic aggregate fields and unsupported exact card grades intentionally remain review-required; successful queue export is not a refresh. Saved JSON actual sale evidence remains available without an API subscription.
- Rate limiting is per reusable client/process. Multi-process callers must coordinate externally; local admin uses cached clients.
- Pure legacy gocollect helpers preserve old figures; the old launcher's access strategy was not changed or executed. Use the new saved capture flow.
- No real data staged. Controller owns existing modifications under data/cards, data/comics, and data/valuation.
