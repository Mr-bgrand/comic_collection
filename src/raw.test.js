import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rawId, rawImageName, nextRawSequence, rawRecord, emptyRawBin, bedId, recordsFromBed,
} from './raw.js';

/*
 * Identity for a book that has no cert.
 *
 * Every image and record in this system is keyed by a grader's cert number. A
 * raw comic scanned before it has been identified has nothing of the kind, so
 * it is given a stable sequential id within its bin - the position the book
 * occupies is the one fact about it that is known for certain.
 */

test('rawId is bin plus a zero-padded sequence', () => {
  assert.equal(rawId('15', 1), 'raw:15-001');
  assert.equal(rawId('15', 42), 'raw:15-042');
  assert.equal(rawId('15', 250), 'raw:15-250');
});

test('rawImageName follows the <Provider>_<id>_<SIDE>.jpg convention', () => {
  // Matches Authority_5356989824_FRONT.jpg, so import-images and the site
  // treat it as one more provider rather than a special case.
  assert.equal(rawImageName('raw:15-001', 'front'), 'Raw_15-001_FRONT.jpg');
  assert.equal(rawImageName('raw:15-001', 'back'), 'Raw_15-001_BACK.jpg');
});

test('nextRawSequence continues from the highest existing raw id in the bin', () => {
  const comics = [
    { id: 'raw:15-001' }, { id: 'raw:15-007' }, { id: 'Authority:1234567890' }, { id: 'raw:14-099' },
  ];
  assert.equal(nextRawSequence('15', comics), 8);
});

test('nextRawSequence starts at 1 for an empty or non-raw bin', () => {
  assert.equal(nextRawSequence('15', []), 1);
  assert.equal(nextRawSequence('15', [{ id: 'Authority:1' }]), 1);
});

test('bedId names the scan, not the book, so a bed can be re-cropped later', () => {
  assert.equal(bedId('15', 7), 'raw-15-scan-007');
});

/*
 * The record. It uses the same raw shape the Authority import writes - grading
 * status, holder, provider - so the Lab, print and stats treat it as one more
 * raw comic. What it adds is provenance for the scan and an identification slot
 * for the matching step that comes later.
 */

test('rawRecord is a raw, unidentified, front-only comic with scan provenance', () => {
  const r = rawRecord({
    bin: '15', sequence: 3, bed: 'raw-15-scan-002', position: 'left',
    width: 880, height: 1400, sha256: 'abc', now: '2026-09-07T10:00:00.000Z',
  });
  assert.equal(r.id, 'raw:15-003');
  assert.equal(r.kind, 'comic');
  assert.equal(r.cert, null);
  assert.equal(r.provider, null);
  assert.equal(r.holder, 'bag-and-board');
  assert.deepEqual(r.grading, { status: 'raw', grader: null, grade: null });
  assert.equal(r.title, null);
  assert.deepEqual(r.identification, { status: 'unidentified', candidates: [] });
  assert.deepEqual(r.images, { front: 'Raw_15-003_FRONT.jpg' });
  assert.equal(r.imageSources.front.kind, 'owner-scan');
  assert.equal(r.imageSources.front.bed, 'raw-15-scan-002');
  assert.equal(r.imageSources.front.position, 'left');
  assert.equal(r.imageSources.front.sha256, 'abc');
  assert.equal(r.imageSources.front.originalWidth, 880);
  assert.equal(r.scanStatus, 'front-only');
  assert.equal(r.location, 'Comic Bin #15');
});

test('emptyRawBin matches the data/comics container shape', () => {
  assert.deepEqual(emptyRawBin('15'), {
    id: 'comic-bin-15', title: 'Comic Bin #15 (Raw)', physical: true, location: 'Comic Bin #15', comics: [],
  });
});

test('recordsFromBed finds the records a bed produced, so "again" can replace them', () => {
  const comics = [
    { id: 'raw:15-001', imageSources: { front: { bed: 'raw-15-scan-001' } } },
    { id: 'raw:15-002', imageSources: { front: { bed: 'raw-15-scan-001' } } },
    { id: 'raw:15-003', imageSources: { front: { bed: 'raw-15-scan-002' } } },
  ];
  assert.deepEqual(recordsFromBed(comics, 'raw-15-scan-001').map((c) => c.id), ['raw:15-001', 'raw:15-002']);
  assert.deepEqual(recordsFromBed(comics, 'raw-15-scan-009'), []);
});

/*
 * Argument parsing. npm treats --bin as one of its own config keys and strips
 * it before the script runs, forwarding only the value: `npm run scan:raw --
 * --bin 15` arrives as `15`. So the bin is accepted as a plain argument, which
 * survives npm, and --bin still works when node is invoked directly.
 */

import { parseRawArgs } from './scan-raw.js';

test('the bin survives npm stripping --bin', () => {
  assert.equal(parseRawArgs(['15']).bin, '15');
});

test('--bin still works when node is run directly', () => {
  assert.equal(parseRawArgs(['--bin', '15']).bin, '15');
});

test('a bare bin is not confused with a --from path', () => {
  const a = parseRawArgs(['15', '--from', '.cache/raw/raw-15-scan-004.jpg', '--voice']);
  assert.equal(a.bin, '15');
  assert.equal(a.from, '.cache/raw/raw-15-scan-004.jpg');
  assert.equal(a.voice, true);
});

test('no bin at all is reported, not guessed', () => {
  assert.equal(parseRawArgs(['--voice']).bin, null);
});
