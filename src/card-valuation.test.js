import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { comparisonForTag, marketValuation, marketValueLabel } from './card-valuation.js';
import { refreshTagValues } from './refresh-tag-values.js';
import { effectiveValue, collectionStats } from './model.js';
import { valueSnapshot } from './value-history.js';
import { renderCollectionMaster } from './templates/labPrint.js';

const tag = { kind: 'card', grader: 'TAG', cert: 'H9545478', subject: 'BELLIBOLT', year: '2023', brand: 'OBSIDIAN FLAMES', series: 'POKÉMON SCARLET & VIOLET', cardNumber: '201/197', variety: 'ILLUSTRATION RARE', grade: '10' };
const psa = { kind: 'card', grader: 'PSA', cert: '101450005', subject: 'BELLIBOLT', year: '2023', brand: 'POKEMON OBF EN-OBSIDIAN FLAMES', cardNumber: '201', variety: 'ILLUSTRATION RARE', grade: '10', fmv: { value: 148, currency: 'USD', source: 'psa-cert-page', asOf: '2026-09-08', url: 'https://www.psacard.com/cert/101450005/psa' } };
const valued = () => ({ ...tag, psaComparison: comparisonForTag(tag, [psa]) });

test('TAG uses the exact PSA card and grade, preserving source and date without changing its own certification', () => {
  const card = valued();
  assert.equal(effectiveValue(card), 148);
  assert.equal(card.grader, 'TAG');
  assert.equal(card.cert, 'H9545478');
  assert.equal(card.fmv, undefined);
  assert.equal(marketValuation(card).url, psa.fmv.url);
  assert.equal(marketValuation(card).asOf, '2026-09-08');
  assert.equal(marketValueLabel(card), 'PSA 10 comparison · TAG fallback');
});

test('matching refuses different grades, languages, sets, editions, years, numbers, qualifiers and subjects', () => {
  for (const change of [{ grade: '9' }, { language: 'Japanese' }, { brand: 'PARADOX RIFT' }, { variety: 'REVERSE HOLO' }, { year: '2024' }, { cardNumber: '202' }, { qualifiers: 'OC' }, { subject: 'CLEFFA' }]) {
    assert.equal(comparisonForTag({ ...tag, ...change }, [psa]), null, JSON.stringify(change));
  }
  assert.equal(comparisonForTag({ ...tag, grade: '8.5' }, [{ ...psa, grade: '9' }]), null);
  assert.equal(comparisonForTag({ ...tag, grade: '8.5' }, [{ ...psa, grade: '8.5' }]).value, 148);
  for (const grade of [null, '', 'AUTHENTIC', '1000']) assert.equal(comparisonForTag({ ...tag, grade }, [psa]), null);
});

test('a real TAG figure, including zero, and an explicit owner estimate outrank the comparison', () => {
  assert.equal(effectiveValue({ ...valued(), fmv: { value: 0, source: 'TAG' } }), 0);
  assert.equal(effectiveValue({ ...valued(), manual: { value: 70 } }), 70);
  assert.equal(effectiveValue({ ...valued(), manual: { value: 0 } }), 0);
});

test('comparison requires PSA evidence in USD and never takes marketplace asking prices', () => {
  for (const change of [{ currency: 'EUR' }, { source: 'marketplace' }, { value: -1 }, { value: null }, { value: '148' }, { url: 'https://i.ebayimg.com/card.jpg' }, { url: 'https://www.psacard.com/cert/99999999/psa' }]) {
    assert.equal(comparisonForTag(tag, [{ ...psa, fmv: { ...psa.fmv, ...change } }]), null);
  }
  assert.equal(comparisonForTag(tag, [{ ...psa, fmv: { ...psa.fmv, value: 0 } }]).value, 0);
});

test('newest dated PSA evidence wins; conflicting equally dated prices and unknown matches stay unvalued', () => {
  const older = { ...psa, cert: '12345678', fmv: { ...psa.fmv, value: 100, asOf: '2026-08-01', url: 'https://www.psacard.com/cert/12345678/psa' } };
  assert.equal(comparisonForTag(tag, [older, psa]).value, 148);
  assert.equal(comparisonForTag(tag, [{ ...older, fmv: { ...older.fmv, asOf: psa.fmv.asOf } }, psa]), null);
  assert.equal(comparisonForTag(tag, []), null);
  assert.equal(comparisonForTag(tag, [{ ...psa, fmv: { ...psa.fmv, source: 'psa-vault-export', asOf: null } }]).asOf, null);
});

test('editing a card identity or grade invalidates its previous comparison immediately', () => {
  assert.equal(effectiveValue({ ...valued(), grade: '9' }), null);
  assert.equal(effectiveValue({ ...valued(), variety: 'HOLO' }), null);
  assert.equal(effectiveValue({ ...valued(), cert: 'Q9937497' }), null);
  assert.equal(effectiveValue({ ...valued(), grader: 'CGC' }), null);
});

test('collection totals, dated history and master print all use and identify the comparison', () => {
  const card = valued(), cards = [{ data: { title: 'Case #2', location: 'Case #2', cards: [card] } }];
  assert.equal(collectionStats([{ comics: [card] }]).combinedValue, 148);
  const snapshot = valueSnapshot([card], { observedAt: '2026-09-08T12:00:00Z' });
  assert.equal(snapshot.total, 148);
  assert.equal(snapshot.valued, 1);
  assert.equal(snapshot.undated, 0);
  assert.match(renderCollectionMaster({ bins: [], cards, comics: [] }), /PSA 10 comparison · TAG fallback · 2026-09-08/);
});

test('refresh is repeatable, propagates new PSA values, removes stale matches, and preserves scans and direct TAG data', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tag-values-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dir = path.join(root, 'data/cards'); await fs.mkdir(dir, { recursive: true });
  const tagFile = path.join(dir, 'tag.json'), psaFile = path.join(dir, 'psa.json');
  const original = { ...tag, images: { front: 'own-front.jpg' }, fmv: { value: 200, source: 'TAG' } };
  await fs.writeFile(tagFile, JSON.stringify({ cards: [original] }));
  await fs.writeFile(psaFile, JSON.stringify({ cards: [psa] }));
  assert.equal((await refreshTagValues(root)).changed, 1);
  const first = await fs.readFile(tagFile, 'utf8');
  assert.equal((await refreshTagValues(root)).changed, 0);
  assert.equal(await fs.readFile(tagFile, 'utf8'), first);
  const saved = JSON.parse(first).cards[0];
  assert.deepEqual(saved.images, original.images);
  assert.deepEqual(saved.fmv, original.fmv);
  await fs.writeFile(psaFile, JSON.stringify({ cards: [{ ...psa, fmv: { ...psa.fmv, value: 160 } }] }));
  await refreshTagValues(root);
  assert.equal(JSON.parse(await fs.readFile(tagFile, 'utf8')).cards[0].psaComparison.value, 160);
  await fs.writeFile(psaFile, JSON.stringify({ cards: [] }));
  await refreshTagValues(root);
  assert.equal(JSON.parse(await fs.readFile(tagFile, 'utf8')).cards[0].psaComparison, undefined);
});
