import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toMarket } from './import-prices.js';

const NOW = '2026-08-20T00:00:00Z';

test('parseCsv reads a header and rows into objects', () => {
  const rows = parseCsv('cert,sold_median\n4395549004,85\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cert, '4395549004');
  assert.equal(rows[0].sold_median, '85');
});

test('parseCsv handles quoted commas and escaped quotes', () => {
  const rows = parseCsv('cert,notes\n1,"matched ""Virgin"" cover, foil"\n');
  assert.equal(rows[0].notes, 'matched "Virgin" cover, foil');
});

test('parseCsv ignores a trailing blank line', () => {
  assert.equal(parseCsv('cert,x\n1,2\n\n').length, 1);
});

test('toMarket stores sold figures and keeps active separate', () => {
  const m = toMarket({
    cert: '1', sold_low: '60', sold_median: '75', sold_high: '90', sold_count: '4',
    active_low: '120', active_high: '200', active_count: '6',
    match_confidence: 'high',
  }, NOW);

  assert.equal(m.value, 75);
  assert.equal(m.basis, 'sold', 'the headline number is a sold figure, never an asking price');
  assert.equal(m.sold.low, 60);
  assert.equal(m.active.low, 120);
  assert.equal(m.confidence, 'high');
});

test('toMarket refuses a row with no confidence stated', () => {
  // An unvouched number is worse than a blank: it looks like an answer.
  assert.equal(toMarket({ cert: '1', sold_median: '75' }, NOW), null);
});

test('toMarket refuses a row the tool matched as none', () => {
  assert.equal(toMarket({ cert: '1', sold_median: '75', match_confidence: 'none' }, NOW), null);
});

test('toMarket refuses asking prices with no sales behind them', () => {
  // Active listings are what sellers hope for, not what anything traded at.
  const m = toMarket({ cert: '1', active_low: '120', active_high: '300', match_confidence: 'high' }, NOW);
  assert.equal(m, null);
});

test('toMarket falls back to low or high when no median is given', () => {
  assert.equal(toMarket({ cert: '1', sold_low: '40', match_confidence: 'medium' }, NOW).value, 40);
});

test('toMarket strips currency formatting', () => {
  assert.equal(toMarket({ cert: '1', sold_median: '$1,250', match_confidence: 'high' }, NOW).value, 1250);
});

test('toMarket records where the number came from', () => {
  const m = toMarket({ cert: '1', sold_median: '75', match_confidence: 'high', match_notes: 'foil, matched art' }, NOW);
  assert.equal(m.source, 'marketplace');
  assert.equal(m.notes, 'foil, matched art');
  assert.equal(m.fetchedAt, NOW);
});
