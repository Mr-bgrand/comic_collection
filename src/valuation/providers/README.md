# Valuation acquisition and JSON interchange

All capture/import actions append pending evidence. Acceptance is a separate owner action. Queue and pilot reports are lookup worklists, not fetched prices. Saved JSON import works without any subscription or API credential.

## Commands

```
npm run values -- status
npm run values -- queue missing stale undated
npm run values -- pilot
npm run values -- import observations.json --dry-run
npm run values -- import observations.json
npm run values -- accept TAG:123 guide-2026-09-13
npm run values -- capture saved-capture.json
npm run values -- capture saved-capture.json --import
npm run values -- search pricecharting "Pikachu 1 Pokemon"
```

Queue/pilot write only `data/valuation/queue.json` or `pilot.json`. Capture prints an outcome and, on success, a `document` suitable for import. Capture only imports with `--import`; import never accepts. `npm run prices -- observations.json` also supports this evidence format; legacy CSV retains its legacy `market` field behavior.

## Batch schema

See `batch.schema.json`. The executable validator is the core observation/persistence service: the JSON schema documents structure but cannot validate identity, revision concurrency, future dates, or selection eligibility. One edit per full copy ID. No paths or acceptance directives in edits.

```json
{
  "schemaVersion": 1,
  "edits": [{
    "copyId": "TAG:123",
    "revision": "REPLACE_WITH_CURRENT_QUEUE_REVISION",
    "observations": [{
      "id": "guide-2026-09-13",
      "copyId": "TAG:123",
      "basis": "guide",
      "value": 123.45,
      "currency": "USD",
      "source": {
        "name": "PriceCharting",
        "url": "https://www.pricecharting.com/game/pokemon-test/pikachu-1",
        "asOf": null,
        "retrievedAt": "2026-09-13T12:00:00Z"
      },
      "match": {
        "identity": {"kind":"card","year":"2023","brand":"Pokemon","series":"","subject":"Pikachu","cardNumber":"1","variety":"","language":"","qualifiers":"","upc":"","barcode":"","supplement":"","coverCode":"","volume":"","printing":"","edition":"","labelCategory":"","labelType":"","signatures":"","restoration":""},
        "grade": "10", "grader": "TAG", "condition": null, "status": "exact"
      },
      "reviewStatus": "pending"
    }]
  }]
}
```

Example is a fictional fixture. Obtain current revision and exact identity from the local collection; independently verify source edition before declaring exact. Import does not turn a copied identity into proof. `asOf` is the provider's date or explicit null when undated. Retrieval time is separate. Values are decimal USD numbers, never strings. Sold observations require `saleCount`; one/two sales remain unselectable. PSA evidence for TAG uses `basis:"psa-comparison"`, `match.grader:"PSA"` and the same numeric grade. Guide comparison uses `evidenceKind:"guide"` without saleCount. Actual transaction-derived comparison uses `evidenceKind:"sold-comps"`.

Identical original documents can be rerun after import or acceptance: validation recognizes unchanged evidence and preserves locks, even with the original revision. A stale revision with new or changed evidence rejects the batch. Repeated observation IDs with conflicting content are rejected.

## Provider captures

Outer capture file: `{ "copyId":"TAG:123", "revision":"CURRENT_REVISION", "provider":"pricecharting", "capture":{...} }`.

PriceCharting saved capture inner fields:

- `id`, `retrievedAt`, `asOf` (explicit null allowed), optional `grader:"PSA"` for TAG fallback.
- `product`: the saved official product API JSON. API price fields must be integer cents, e.g. `"condition-21-price":12345` becomes USD 123.45. No zero is invented for missing fields.
- `mapping`: `{productId, productName, consoleName, category:"card"|"comic", identity, verifiedBy, verifiedAt, url}`. Identity is exact `identityOf(record)` after owner review. Product name/set/id must match the returned product. Mapping persists in `observation.providerMapping` for subsequent verified refresh.

Use `provider:"pricecharting-api"` to fetch the reviewed product ID through the optional official API; omit `product`. SportsCardsPro uses `sportscardspro` or `sportscardspro-api`. Cross-provider catalog URLs are rejected before an API request. No search result is automatically mapped or accepted.

API credentials: only `PRICECHARTING_API_TOKEN` / `SPORTSCARDSPRO_API_TOKEN` environment variables. Each service's paid API entitlement is separate and is not inferred from a browser subscription. Status exposes a boolean only. One request/second, serialized per client; server default clients are reused. Three total attempts maximum for HTTP 429; Retry-After up to 60s is respected, longer instructions return retry-later rather than retrying early. Transport errors never include the token or request URL. Restart a long-running admin server after changing API environment configuration.

Supported card guide fields at exact grade 10: PSA `manual-only-price`; TAG `condition-21-price`; CGC `condition-17-price`; CGC Pristine (labelType includes Pristine) `condition-19-price`. Generic graded9 is not PSA9. Unsupported grades, half-grades, raw items and comic aggregate prices return review-required. Comic API fields have a different mapping (9.8 manual-only, 9.6 condition-10, 9.4 condition-17, 9.2 box-only, 9 condition-16, 8/8.5 graded); none guarantee exact grader/label, so this adapter never selects a comic aggregate as exact slab evidence. Official API does not return sold histories. Use independently verified visible sale captures and the core estimator for those.

GoCollect `provider:"gocollect"` inner fields:

```
{id, text, url, cert, grade, grader:"CGC", labelType:null|string,
 identity, reviewedBy, reviewedAt, retrievedAt, asOf:null|date}
```

`text` is saved visible-page text containing the FMV card. Review the exact cert, title/issue/edition, grade and label against the source, then record reviewer and review time. An arbitrary identity snapshot without that explicit review is rejected. Parser checks matching cert/grade/grader/label/identity and official source URL; it does not automatically infer edition from fuzzy page titles. It returns captured / review-required / login-required / not-listed / no-sales / unknown. Only captured carries an observation. It retains guide averages and annual sale count in `stats`, separate from individual sold evidence. No browser launcher is invoked by these commands. Failure outcomes do not overwrite old values.

## Callable local-admin services

From `src/valuation-cli.js`:

- `providerStatus(env=process.env)` → provider boolean/mode map; no credentials.
- `valuationReport(root,{pilot=false,...queueOptions})` → `{status:'queued',retrievedValues:0,providers,items,...}`; no writes.
- `importValuationDocument(root,document,{dryRun=false})` → `{status,changed,records?}`; validates entire batch before persistence.
- `acceptValuation(root,copyId,observationId,{revision})` → core persistence result; revision is mandatory.
- `captureValuation(root,{copyId,revision,provider,capture},{persist=false,client?})` → provider outcome plus import `document`, or `persistence` result when persist true. A revision is mandatory even for capture review.
- `runValues(args,{root=process.cwd()})` implements the commands above.

From provider modules: `priceChartingObservation(record,capture)` and `goCollectObservation(record,capture)` are pure converters; `createPriceChartingClient({env,provider,fetch?,sleep?,clock?})` returns `{configured,search(query),capture(record,mapping,{id,grader?,asOf?,retrievedAt?})}`. Reuse client per provider in a refresh loop. Capture without persist, collect documents then import one batch when multiple copies share one inventory file (all revisions stay current until the batch commits). Refresh previously mapped observations with their `providerMapping` and `match.grader`; never use a query URL as a verified mapping. A refresh imports new pending evidence and retains the owner's existing selection.

Official documentation: https://www.pricecharting.com/api-documentation and https://www.sportscardspro.com/api-documentation.
