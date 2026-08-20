import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupKey,
  variantTokens,
  matchDifficulty,
  excludeTerms,
  buildVariantIndex,
} from './variants.js';

const c = (cert, title, issue, variant, grade = '9.8') => ({ cert, title, issue, variant, grade });

test('groupKey collides exactly on title and issue', () => {
  assert.equal(groupKey(c('1', 'Moon Man', '1', 'Tao Variant Cover')), groupKey(c('2', 'moon man', '1', '')));
  assert.notEqual(groupKey(c('1', 'Moon Man', '1', '')), groupKey(c('2', 'Moon Man', '2', '')));
});

test('variantTokens keeps identifying words and drops boilerplate', () => {
  assert.deepEqual(variantTokens('Tao Variant Cover'), ['tao']);
  assert.deepEqual(variantTokens('Comic Mint "Virgin" Edition A'), ['mint', 'a']);
  assert.deepEqual(variantTokens(''), []);
});

test('a book with no siblings is unique', () => {
  assert.equal(matchDifficulty(c('1', 'Saga', '1', 'Staples Cover'), []), 'unique');
});

test('a distinctive retailer name makes it text-matchable', () => {
  const me = c('1', 'w0rldtr33', '5', 'The Comic Corner Edition');
  const sib = [c('2', 'w0rldtr33', '5', 'Near Mint Comics Edition')];
  assert.equal(matchDifficulty(me, sib), 'text');
});

test('a base issue among variants is visual-only', () => {
  // Its query is a strict subset of every sibling's, so no text search prefers it.
  const base = c('1', 'Moon Man', '1', '');
  const sibs = [c('2', 'Moon Man', '1', 'Tao Variant Cover'), c('3', 'Moon Man', '1', 'Variant Cover B')];
  assert.equal(matchDifficulty(base, sibs), 'visual');
});

test('siblings separated only by a letter are visual-only', () => {
  // "Variant Cover B" against "Variant Cover C" is a real distinction to a human
  // and useless to a search engine.
  const b = c('1', 'Moon Man', '1', 'Variant Cover B');
  const sibs = [c('2', 'Moon Man', '1', 'Variant Cover C')];
  assert.equal(matchDifficulty(b, sibs), 'visual');
});

test('identical variants at different grades are visual-only', () => {
  const lo = c('1', 'w0rldtr33', '5', 'Near Mint Comics Edition', '8.0');
  const hi = c('2', 'w0rldtr33', '5', 'Near Mint Comics Edition', '9.4');
  assert.equal(matchDifficulty(lo, [hi]), 'visual');
});

test('excludeTerms names the siblings words, never its own', () => {
  const base = c('1', 'Moon Man', '1', '');
  const sibs = [c('2', 'Moon Man', '1', 'Tao Variant Cover'), c('3', 'Moon Man', '1', 'Spectral Comics Edition')];
  const terms = excludeTerms(base, sibs);
  assert.ok(terms.includes('tao'));
  assert.ok(terms.includes('spectral'));
});

test('excludeTerms does not exclude a word this book shares', () => {
  // Both are "Comic Mint"; excluding "mint" would rule out the book itself.
  const me = c('1', 'Amazing Spider-Man', '21', 'Comic Mint Edition');
  const sib = [c('2', 'Amazing Spider-Man', '21', 'Comic Mint "Virgin" Edition A')];
  assert.ok(!excludeTerms(me, sib).includes('mint'));
});

test('buildVariantIndex reports group size and siblings per cert', () => {
  const entries = [
    { comic: c('1', 'Moon Man', '1', 'Tao Variant Cover'), bin: '01' },
    { comic: c('2', 'Moon Man', '1', ''), bin: '01' },
    { comic: c('3', 'Saga', '1', 'Staples Cover'), bin: '02' },
  ];
  const idx = buildVariantIndex(entries);

  assert.equal(idx.get('1').groupSize, 2);
  assert.deepEqual(idx.get('1').siblingCerts, ['2']);
  assert.equal(idx.get('3').groupSize, 1);
  assert.deepEqual(idx.get('3').siblingCerts, []);
  assert.equal(idx.get('3').difficulty, 'unique');
  assert.equal(idx.get('2').difficulty, 'visual', 'the base issue is the hard one');
});
