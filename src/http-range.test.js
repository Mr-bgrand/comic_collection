import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaRange } from './http-range.js';
test('media byte ranges support the probes, suffixes, and open ranges used by phone players', () => {
  assert.deepEqual(mediaRange('bytes=0-1', 100), { start: 0, end: 1 });
  assert.deepEqual(mediaRange('bytes=50-', 100), { start: 50, end: 99 });
  assert.deepEqual(mediaRange('bytes=-20', 100), { start: 80, end: 99 });
  assert.deepEqual(mediaRange('bytes=-200', 100), { start: 0, end: 99 });
  assert.deepEqual(mediaRange('bytes=50-200', 100), { start: 50, end: 99 });
});
test('unsatisfiable or malformed byte ranges cannot slice unrelated data', () => {
  for (const range of ['bytes=100-', 'bytes=50-20', 'bytes=-0', 'bytes=-', 'bytes=0-1,5-6', 'bytes=abc', 'bytes=9007199254740993-']) assert.equal(mediaRange(range,100), null);
  assert.equal(mediaRange('bytes=0-1', 0), null);
});
