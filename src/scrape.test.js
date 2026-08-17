import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRecord, parsePopulation } from './scrape.js';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/cert-4395549004.json', import.meta.url), 'utf8'),
);

test('normalizeRecord maps every CGC field off the live Venom record', () => {
  const r = normalizeRecord(fixture);
  assert.equal(r.cert, '4395549004');
  assert.equal(r.title, 'Venom');
  assert.equal(r.issue, '23');
  assert.equal(r.issueDate, '9/23');
  assert.equal(r.issueYear, '2023');
  assert.equal(r.publisher, 'Marvel Comics');
  assert.equal(r.variant, 'Black Saber Comics "Virgin" Edition');
  assert.equal(r.grade, '9.8');
  assert.equal(r.pageQuality, 'WHITE');
  assert.equal(r.gradeDate, '2024-03-26');
  assert.equal(r.labelCategory, 'Universal');
  assert.equal(r.keyComments, 'Venom #223');
});

test('normalizeRecord repairs the encoding damage in CGC art comments', () => {
  const r = normalizeRecord(fixture);
  assert.ok(r.artComments.includes('Grønbekk'), 'Grønbekk repaired');
  assert.ok(r.artComments.includes('Ramón'), 'Ramón repaired');
  assert.ok(!r.artComments.includes('�'), 'no replacement characters survive');
  assert.equal(r.repairs.length, 2);
});

test('normalizeRecord picks out front and back scans', () => {
  const r = normalizeRecord(fixture);
  assert.match(r.images.front, /_OBV/);
  assert.match(r.images.back, /_REV/);
});

test('normalizeRecord reads population and flags top pop', () => {
  const r = normalizeRecord(fixture);
  assert.equal(r.population.atGrade, 83);
  assert.equal(r.population.higher, 0);
  assert.equal(r.population.topPop, true);
});

test('parsePopulation handles books with copies graded higher', () => {
  const pop = parsePopulation('Total Graded by CGC\nIn 9.4: 1,204\nIn Higher Grades: 3,881');
  assert.equal(pop.atGrade, 1204);
  assert.equal(pop.higher, 3881);
  assert.equal(pop.topPop, false);
});

test('parsePopulation returns null when CGC states no population', () => {
  assert.equal(parsePopulation(''), null);
  assert.equal(parsePopulation('Some unrelated text'), null);
});

test('normalizeRecord ignores CGC labels we do not track', () => {
  const r = normalizeRecord({ pairs: [['Some New Field', 'x'], ['Title', 'Spawn']] });
  assert.equal(r.title, 'Spawn');
  assert.equal(r.someNewField, undefined);
});
