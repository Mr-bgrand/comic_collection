import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parseSold, buildFmv, parseFmvCard } from './gocollect.js';

/** Captured verbatim from the live GoCollect card for cert 4395549002. */
const REAL_CARD = `CGC Cert #4395549002
Verify CGC Certification
Comic
Action Comics #1056 (KRS Comics Foil Edition)
Complete Census & Value
Grade
9.8
Label Assigned
Modern
Page Quality
WHITE
Action Comics #1056 (KRS Comics Foil Edition)
CGC Universal 9.8
GoCollect FMV
$60
30 Day Avg
--
90 Day Avg
--
365 Day Avg
$60
(1 Sold)
Complete Census & Value `;

const REAL_URL = 'https://gocollect.com/app/comic/action-comics-1056-krs-comics-foil-edition';

test('parseFmvCard reads the live Action Comics card exactly', () => {
  const fmv = parseFmvCard(REAL_CARD, REAL_URL, '2026-08-17T12:00:00Z');
  assert.equal(fmv.value, 60);
  assert.equal(fmv.avg365, 60);
  assert.equal(fmv.sold365, 1);
  assert.equal(fmv.url, REAL_URL);
});

test('parseFmvCard reports no 30/90-day average when GoCollect shows --', () => {
  // Regression: a fixed-width read overshot the "--" placeholders and reported
  // $60 as the 30-day average for a book with no 30-day sales.
  const fmv = parseFmvCard(REAL_CARD, REAL_URL, '2026-08-17T12:00:00Z');
  assert.equal(fmv.avg30, null, '30-day average must be null, not the 365-day figure');
  assert.equal(fmv.avg90, null, '90-day average must be null');
});

test('parseFmvCard reads real averages when they are present', () => {
  const card = REAL_CARD.replace('30 Day Avg\n--', '30 Day Avg\n$45').replace(
    '90 Day Avg\n--',
    '90 Day Avg\n$52',
  );
  const fmv = parseFmvCard(card, REAL_URL, '2026-08-17T12:00:00Z');
  assert.equal(fmv.avg30, 45);
  assert.equal(fmv.avg90, 52);
  assert.equal(fmv.avg365, 60);
});

test('parseFmvCard reports not-listed when the card carries no FMV at all', () => {
  const fmv = parseFmvCard('Cert Lookup\nProvide a Certification Number', '', 'now');
  assert.equal(fmv.value, null);
  assert.equal(fmv.status, 'not-listed');
});

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

test('buildFmv never invents a zero price when no value is listed', () => {
  assert.equal(buildFmv({ fmvText: '--', url: '' }, 'now').value, null);
  assert.equal(buildFmv({}, 'now').value, null);
});

test('buildFmv keeps the GoCollect page for a book that is listed but unsold', () => {
  // Incredible Hulk #1: in GoCollect's database, every average "--". The page is
  // still worth linking to, so this must not collapse to "no data".
  const fmv = buildFmv(
    { fmvText: '--', avg30: '--', avg90: '--', avg365: '--', url: 'https://gocollect.com/app/comic/incredible-hulk-1-gleason-virgin-edition' },
    'now',
  );
  assert.equal(fmv.status, 'no-sales');
  assert.equal(fmv.value, null);
  assert.equal(fmv.url, 'https://gocollect.com/app/comic/incredible-hulk-1-gleason-virgin-edition');
});

test('buildFmv marks a book GoCollect does not carry as not-listed', () => {
  const fmv = buildFmv({ fmvText: '', url: '' }, 'now');
  assert.equal(fmv.status, 'not-listed');
  assert.equal(fmv.url, null);
});

test('buildFmv marks a priced book as priced', () => {
  assert.equal(buildFmv({ fmvText: '$60', url: 'https://x/app/comic/y' }, 'now').status, 'priced');
});

test('buildFmv keeps a price even when the comic link is missing', () => {
  const fmv = buildFmv({ fmvText: '$25', url: '' }, '2026-08-17T12:00:00Z');
  assert.equal(fmv.value, 25);
  assert.equal(fmv.url, null);
  assert.equal(fmv.status, 'priced');
});

test('buildFmv timestamps every price, because FMV goes stale and grades do not', () => {
  const fmv = buildFmv({ fmvText: '$10' }, '2026-08-17T12:00:00Z');
  assert.ok(fmv.fetchedAt, 'fetchedAt is always set');
});
