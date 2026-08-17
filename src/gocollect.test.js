import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parseSold, buildFmv } from './gocollect.js';

test('parseMoney reads GoCollect price strings', () => {
  assert.equal(parseMoney('$60'), 60);
  assert.equal(parseMoney('\nGoCollect FMV\n$60\n'), 60);
  assert.equal(parseMoney('$1,234'), 1234);
  assert.equal(parseMoney('$1,234.50'), 1234.5);
});

test('parseMoney returns null for the placeholder GoCollect shows when unsold', () => {
  assert.equal(parseMoney('--'), null);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('no data'), null);
  assert.equal(parseMoney(null), null);
});

test('parseSold reads the sold count', () => {
  assert.equal(parseSold('$60\n(1 Sold)'), 1);
  assert.equal(parseSold('(1,204 Sold)'), 1204);
  assert.equal(parseSold('--'), null);
  assert.equal(parseSold(undefined), null);
});

test('buildFmv assembles the record from a real Action Comics #1056 card', () => {
  // Values as shown on GoCollect for cert 4395549002.
  const fmv = buildFmv(
    {
      fmvText: '\n$60\n30 Day Avg\n--\n90 Day Avg\n--\n365 Day Avg\n$60\n(1 Sold)\n',
      avg30: '\n--\n',
      avg90: '\n--\n',
      avg365: '\n$60\n(1 Sold)',
      sold365: '\n$60\n(1 Sold)\n',
      url: 'https://gocollect.com/app/comic/action-comics-1056-krs-comics-foil-edition',
    },
    '2026-08-17T12:00:00Z',
  );

  assert.equal(fmv.value, 60);
  assert.equal(fmv.currency, 'USD');
  assert.equal(fmv.avg30, null, 'no 30-day average when GoCollect shows --');
  assert.equal(fmv.avg90, null);
  assert.equal(fmv.avg365, 60);
  assert.equal(fmv.sold365, 1);
  assert.equal(
    fmv.url,
    'https://gocollect.com/app/comic/action-comics-1056-krs-comics-foil-edition',
  );
  assert.equal(fmv.fetchedAt, '2026-08-17T12:00:00Z');
});

test('buildFmv returns null rather than a zero price when no value is listed', () => {
  assert.equal(buildFmv({ fmvText: '--', url: '' }, '2026-08-17T12:00:00Z'), null);
  assert.equal(buildFmv({}, '2026-08-17T12:00:00Z'), null);
});

test('buildFmv keeps a price even when the comic link is missing', () => {
  const fmv = buildFmv({ fmvText: '$25', url: '' }, '2026-08-17T12:00:00Z');
  assert.equal(fmv.value, 25);
  assert.equal(fmv.url, null);
});

test('buildFmv timestamps every price, because FMV goes stale and grades do not', () => {
  const fmv = buildFmv({ fmvText: '$10' }, '2026-08-17T12:00:00Z');
  assert.ok(fmv.fetchedAt, 'fetchedAt is always set');
});
