import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldScan } from './scan.js';

/*
 * Which books a run covers.
 *
 * This was wrong once and nothing caught it: naming certs on the command line
 * was accepted, ignored, and the run quietly started on the whole backlog
 * instead. Not a crash - just thirty-one books of the wrong work.
 */

test('with no certs named, a book with no front cover is scanned', () => {
  assert.equal(shouldScan({ cert: '1', images: {} }, new Set()), true);
});

test('with no certs named, a book that already has a cover is left alone', () => {
  assert.equal(shouldScan({ cert: '1', images: { front: 'a.jpg' } }, new Set()), false);
});

test('a named cert is scanned even though it already has a cover', () => {
  // The whole point of naming one: a bad cover is not a missing cover.
  const comic = { cert: '4089841007', images: { front: 'a.jpg', back: 'b.jpg' } };
  assert.equal(shouldScan(comic, new Set(['4089841007'])), true);
});

test('naming certs excludes everything else, missing cover or not', () => {
  const other = { cert: '999', images: {} };
  assert.equal(shouldScan(other, new Set(['4089841007'])), false);
});

test('certs match as strings, whichever type they are stored as', () => {
  assert.equal(shouldScan({ cert: 4089841007, images: {} }, new Set(['4089841007'])), true);
});

test('an undefined wanted set behaves as none named', () => {
  assert.equal(shouldScan({ cert: '1', images: {} }, undefined), true);
  assert.equal(shouldScan({ cert: '1', images: { front: 'a.jpg' } }, undefined), false);
});
