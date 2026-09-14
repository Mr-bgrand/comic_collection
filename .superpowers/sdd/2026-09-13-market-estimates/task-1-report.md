# Task 1 implementation report

## Delivered

Pure evidence validation/selection, effective-value integration, sold-comparison estimator, queue and deterministic pilot selection, and file-backed revision-checked batch persistence. Only `src/valuation/*.js`, `src/card-valuation.js`, `src/model.js` changed. No real inventory, provider/browser/UI/build/package files changed by this task.

## Contracts for task 2 and UI

### Observation and pure record operations

Import from `src/valuation/observations.js`:

- `copyId(record)` returns existing nonempty `id`, otherwise `provider || grader || 'CGC'` plus `:` plus non-null cert. Throws when no stable ID exists. Null certs never collapse into one identity.
- `identityOf(record)` returns a canonical exact edition snapshot. It includes comic/card identity fields and stored UPC/barcode, supplement, cover code, volume, printing, edition, language, label category/type, signatures, restoration, qualifiers. Nested qualifier object keys are sorted, not string-coerced. Always use this function to prepare `match.identity` after independently verifying the source matches the owned record. Copying this snapshot is not itself identity verification.
- `validateObservation(record, observation, {now?})` returns a detached validated clone or throws. `now` defaults to actual ISO UTC now.
- `addObservation(record, observation, {now?})` returns a new record with the evidence appended, always imported pending. Never selects. Identical repeated IDs are idempotent (an accepted review status survives rerun); conflicting content for the same ID throws.
- `acceptObservation(record, observationId, {now?, locked=true, automatic=false})` explicitly selects an eligible observation and sets its reviewStatus to accepted. Automatic acceptance rejects an existing owner lock; explicit owner acceptance can replace it. An observation with wrong edition/grade/grader/condition cannot be accepted even if match.status claims exact.
- `selectedObservation(record)` returns valid accepted selected evidence or null, rechecking identity and eligibility. Legacy `valuation:null` works.
- `isRaw`, `assessedCondition`, `identified`, `validDate`, `safeSourceUrl`, `exactMatch` are exported helpers.

Example observation:

```js
const observation = {
  id: 'pricecharting-2026-09-13-copy-1',
  copyId: copyId(record),
  basis: 'guide', // guide | sold-comps | psa-comparison | owner | raw-reference
  value: 100, // actual finite nonnegative number; numeric strings rejected
  currency: 'USD',
  source: {
    name: 'PriceCharting',
    url: 'https://www.pricecharting.com/game/example/verified-item',
    asOf: null, // explicit null if source has no dated price; never substitute capture date
    retrievedAt: '2026-09-13T12:00:00Z'
  },
  match: {
    identity: identityOf(record),
    grade: record.grade ?? null,
    grader: isRaw(record) ? null : record.grader || 'CGC',
    condition: record.condition ?? null,
    status: 'exact' // exact | ambiguous | mismatch | unknown
  },
  reviewStatus: 'pending' // pending | accepted | rejected
};
```

PSA evidence for TAG uses `basis:'psa-comparison'` and `match.grader:'PSA'`. It is accepted only for same-identity TAG cards at the same numeric grade, with no rounding. Set `evidenceKind:'sold-comps'` and `saleCount` for actual sale-derived comparison evidence; one/two sales stay review-only. Three-plus may be explicitly accepted. Guide comparisons may use `evidenceKind:'guide'` and must omit `saleCount`. A direct `basis:'sold-comps'` always requires the actual sale count. Contradictory guide/sold basis declarations are rejected.

Raw references are always provisional and unselectable. Other raw observations require recorded condition: a meaningful nonempty string, or an object with meaningful `grade`, `label`, or `description`. Empty `{}` and unknown/unassessed/ungraded text do not qualify. Unconditioned raw legacy values are excluded from effective totals too.

Dates are strict YYYY-MM-DD or UTC ISO timestamps. Source-as-of may explicitly be null (controller adjustment after undated PriceCharting capture); missing/invalid/future dates are rejected, including source-as-of later than retrieval. URLs must be public HTTPS with no credentials, port, local host, local suffix or IP literal. Core validates source format, not provider authenticity; provider adapters own verification and supported access policy.

### Resolution and model integration

`resolveValuation(record)` from `resolution.js` returns null or:

```js
{value, currency, basis, source, url, asOf, retrievedAt,
 observationId, locked, provisional:false, legacy:false}
```

Legacy returns retain original provenance fields with `legacy:true` and basis (`guide`, `psa-comparison`, `owner`), source-as-of only (undated stays null). Existing direct FMV, manual-before-TAG-comparison, exact owned-PSA fallback order remains. Selected owner observations count in manual totals; selected guide/sold/comparison observations count in market totals. Legacy `fmv`, `manual`, images and comparison fields remain intact. `marketValueLabel` uses selected source name or explicit PSA grade comparison, and no longer calls every non-GoCollect comic source GoCollect. No circular imports: card valuation/model import only pure observations; resolution imports card valuation.

### Sold estimator

`estimateSoldComps(target, entries)` from `sold-comps.js`:

- target: `{identity,grade,grader,condition}`
- entry: same matching fields plus `{transactionId,sold:true,askingOnly:false,bestOffer:false,value,currency:'USD'}`. Actual known best-offer prices can set `bestOffer:true,acceptedPriceKnown:true`.
- Unknown/empty identities, incompatible editions/qualifiers/grades/graders/conditions, unsold/asking-only, unknown offer prices, non-USD/nonnumeric/negative values are excluded. IDs are deduplicated among qualifying entries.
- Returns `{value,range,saleCount,status,transactions}`. Zero: missing, null value/range. One/two: review, null value/range but transactions retained. Three/four: median and min/max. Five-plus: median and observed nearest-rank quartiles (`ceil(n*.25)-1`, `ceil(n*.75)-1`), clearly labeled `observed-iqr`.
- Hand checked values: [10,20,40,100] => median 30, range 10–100; [10,20,30,40,50,100] => median 35, range 20–50; [10,20,30,40,100] => median 30, range 20–40.

### Queue/pilot

`buildQueue(records,{now?,staleDays=90,filters=[]})` from `queue.js` takes normalized `{record,container:{id,title},revision?}` entries. `loadValuations(root)` supplies them. Returns rows:

```js
{copyId,title,kind,grader,grade,provider,container,revision,current,
 flags,reasons,priority,sourceQueries:[{source,query}],
 pilotCategory,legacyStatus,special,halfGrade,candidateIdentity}
```

Supported OR filters: missing, stale, undated, review, condition, identity. Staleness uses source date; undated values are separate. Proposed raw identification candidates are exposed without being treated as confirmed identity. Source queries never pretend the provider lookup has occurred. Rows sort by priority then full copy ID; duplicate full IDs throw.

`selectPilot(queue)` returns `{items,quotas,shortfalls}`. Quotas: 10 missing CGC comics, 10 TAG cards, 5 Authority, 5 unidentified owner raws. CGC samples new/not-listed/no-sales and special copies; TAG samples half-grades/exclusives. Live owner research IDs requested by the controller have deterministic preference (TAG 10, Authority 5, raw:15-001..005), with sorted fallback. No duplication to fill quotas. Reversing inputs yields the same result. Real read-only queue successfully processed all 933 stored copies.

### Persistence

`collectionRecords(collection)` flattens a `readCollection` result; `loadValuations(root=process.cwd())` reads then normalizes. Neither writes.

```js
const rows = await loadValuations(root);
const row = rows.find(x => x.copyId === wantedId);
const result = await applyValuationBatch(root, [{
  copyId: row.copyId,
  revision: row.revision,
  observations: [observation],
  // Omit accept for import-only. Include only for explicit authorized acceptance.
  accept: {observationId: observation.id, locked:true}
}], {now:'2026-09-13T12:00:00Z'});
// {changed: numberOfFilesChanged, records:[{copyId,revision}]}
```

Whole batch is validated before inventory writes. Revisions are SHA256 of original file bytes and required for each edit. No input filename/path field accepted. File targets are exclusively from `readCollection`. A filesystem lock serializes cooperating batch writers. Each changed file gets an original content-addressed backup in `data/backups/valuation`; replacement is atomic, all revisions rechecked after staging. I/O failure attempts rollback without overwriting another writer's changed output. Idempotent import does not rewrite a file. Tests use temporary real JSON fixture collections and prove raw null-cert isolation, owner-lock persistence, original-byte backup, rejected-batch preservation, stale revision rejection, unchanged images, no caller-specified path.

## TDD and verification

Used test-driven-development skill and writing-good-tests reference. Tests were written before behavior and run against missing/minimal stubs; observed red failures for selection, persistence, queue, estimator, then implemented green. Initial generic `assert.throws` validation cases happened to pass against the missing method; these alone are not claimed as independent red evidence. Subsequent specific regression tests were run red before fixes: undated source support; full identity signatures/qualifiers; TAG-only comparison policy; empty raw condition; PSA one-sale comparison gate; absent graded grade; accurate PSA label; nested estimator identity; excluding CGC cards from comic pilot; same numeric grade and contradictory guide evidence.

Final commands:

- `node --test src/valuation/*.test.js`: **21 passed, 0 failed**.
- `npm test`: **374 passed, 0 failed** (353 baseline + 21 new).
- `git diff --check`: no whitespace errors (only existing Git CRLF normalization warnings).
- Read-only `loadValuations -> buildQueue -> selectPilot` on real inventory: 933 rows; preferred TAG/Authority/raw IDs selected without shortfall. No write helper was invoked on real inventory.

Logs retained at `.superpowers/sdd/2026-09-13-market-estimates/task-1-focused.log` and `task-1-tests.log`.

## Self-review and integration limitations

- File replacement is atomic per file, not an OS-level cross-file transaction. All input validation and revision checks happen before replacement; cooperating writers are locked and rollback is attempted on I/O failure. A crash mid-commit can require recovery from original backups; an unrelated writer can still race after revision check.
- Core matches stored explicit fields conservatively. Provider adapters must map their verified fields to the record snapshot and mark ambiguous matches pending; unknown identities are never inferred from a title search.
- Existing refresh-tag-values.js still deletes legacy `psaComparison` on no new match. New selected observations survive because they are separate. Controller notified task 2 should preserve valid prior comparison evidence on failed acquisition; this task did not cross into provider integration.
- Browser public build/server must make the added pure module dependency available as needed (task 3 ownership). No server/build paths changed here.
