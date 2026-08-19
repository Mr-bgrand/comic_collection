import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchQuery, toRow, toCsv, COLUMNS } from './export-lookup.js';

const VENOM = {
  cert: '4395549004', title: 'Venom', issue: '23',
  variant: 'Black Saber Comics "Virgin" Edition',
  grade: '9.8', pageQuality: 'WHITE', publisher: 'Marvel Comics', issueYear: '2023',
  labelCategory: 'Universal', keyComments: 'Venom #223',
  population: { atGrade: 83, higher: 0, topPop: true },
  images: { front: '4395549004_OBV.jpg', back: '4395549004_REV.jpg' },
  fmv: { value: 85, url: 'https://gocollect.com/app/comic/venom-23', status: 'priced' },
};

test('searchQuery keeps the words that distinguish a variant', () => {
  const q = searchQuery(VENOM);
  assert.ok(q.includes('Venom'));
  assert.ok(q.includes('#23'));
  assert.ok(q.includes('Black Saber'), 'retailer name is the distinguishing part');
  assert.ok(q.includes('Virgin'));
  assert.ok(q.includes('CGC 9.8'));
});

test('searchQuery drops only trailing boilerplate', () => {
  const q = searchQuery(VENOM);
  assert.ok(!q.includes('Edition'), 'trailing "Edition" is stripped');
  assert.ok(q.includes('Comics'), 'but "Comics" inside a retailer name is kept');
});

test('searchQuery keeps a retailer name whose words look like filler', () => {
  // "The Comic Corner" collapsed to "Corner" under a position-blind filter.
  const q = searchQuery({ title: 'w0rldtr33', issue: '5', variant: 'The Comic Corner Edition', grade: '9.8' });
  assert.ok(q.includes('The Comic Corner'), `retailer name intact, got: ${q}`);
  assert.ok(!/Corner Edition/.test(q));
});

test('searchQuery strips stacked trailing filler', () => {
  const q = searchQuery({ title: 'Spawn', issue: '350', variant: 'Foil Variant Cover', grade: '9.8' });
  assert.ok(q.includes('Foil'));
  assert.ok(!q.includes('Variant'));
  assert.ok(!q.includes('Cover'));
});

test('searchQuery quotes a multi-word variant so it matches as a phrase', () => {
  // "Comic Corner" searched loose returns every comic ever listed.
  const q = searchQuery({ title: 'w0rldtr33', issue: '5', variant: 'The Comic Corner Edition', grade: '9.8' });
  assert.match(q, /"[^"]+"/, 'multi-word variant is quoted');
  assert.ok(q.includes('Corner'));
});

test('searchQuery handles an unnumbered issue without printing #nn', () => {
  const q = searchQuery({ title: 'Female Force: Taylor Swift', issue: 'nn', variant: '', grade: '9.8' });
  assert.ok(!q.includes('#'), 'no bogus issue number');
  assert.ok(q.includes('CGC 9.8'));
});

test('searchQuery survives a book with no variant at all', () => {
  assert.equal(searchQuery({ title: 'Moon Man', issue: '1', grade: '9.8' }), 'Moon Man #1 CGC 9.8');
});

test('toRow names images by cert and side, so rows and files match without a path column', () => {
  const row = toRow(VENOM, '01');
  assert.equal(row.front_image, '4395549004_front.jpg');
  assert.equal(row.back_image, '4395549004_back.jpg');
  assert.equal(row.cert, '4395549004');
});

test('toRow leaves image cells empty when there is no scan', () => {
  const row = toRow({ ...VENOM, images: {} }, '01');
  assert.equal(row.front_image, '');
  assert.equal(row.back_image, '');
});

test('needs_price is the flag the lookup tool acts on', () => {
  assert.equal(toRow(VENOM, '01').needs_price, 'no', 'already has a market value');

  const unpriced = { ...VENOM, fmv: { value: null, status: 'not-listed', url: null } };
  assert.equal(toRow(unpriced, '01').needs_price, 'yes');

  const estimated = { ...unpriced, manual: { value: 40 } };
  assert.equal(toRow(estimated, '01').needs_price, 'no', 'a hand-entered value counts');
});

test('toRow suppresses the CGC 1900 placeholder year', () => {
  assert.equal(toRow({ ...VENOM, issueYear: '1900' }, '01').issue_year, '');
});

test('toCsv quotes fields containing commas and quotes', () => {
  const csv = toCsv([toRow(VENOM, '01')]);
  const [header, row] = csv.trim().split('\n');
  assert.equal(header, COLUMNS.join(','));
  assert.ok(row.includes('""Virgin""'), 'inner quotes are doubled per RFC 4180');
  assert.equal(csv.split('\n').length, 3, 'header + one row + trailing newline');
});

test('toCsv keeps every record on exactly one physical line', () => {
  // A naive parser splitting on newlines must not see extra rows.
  const csv = toCsv([toRow({ ...VENOM, keyComments: 'line one\nline two' }, '01')]);
  assert.equal(csv.trim().split('\n').length, 2, 'header + one record');
  assert.ok(csv.includes('line one; line two'), 'newline collapsed, text preserved');
});
