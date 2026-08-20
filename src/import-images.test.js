import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImageName } from './import-images.js';

test('reads cert and side from the documented form', () => {
  assert.deepEqual(parseImageName('4245413012_front.jpg'), { cert: '4245413012', side: 'front' });
  assert.deepEqual(parseImageName('4245413012_back.jpg'), { cert: '4245413012', side: 'back' });
});

test('a bare cert is treated as the front', () => {
  assert.deepEqual(parseImageName('4245413012.jpg'), { cert: '4245413012', side: 'front' });
});

test('accepts the separators and casing a person actually types', () => {
  // These get typed by hand next to a physical slab, so be forgiving.
  for (const name of [
    '4245413012-back.jpg',
    '4245413012 back.jpg',
    '4245413012_BACK.JPG',
    '4245413012_Rev.jpeg',
    '4245413012_b.png',
    '  4245413012_back.webp',
  ]) {
    assert.equal(parseImageName(name)?.side, 'back', `failed on ${name}`);
  }
});

test('accepts CGC-style OBV/REV suffixes', () => {
  assert.equal(parseImageName('4245413012_OBV.jpg').side, 'front');
  assert.equal(parseImageName('4245413012_REV.jpg').side, 'back');
});

test('rejects a name with no cert rather than guessing', () => {
  // Guessing here would write an image nothing ever references.
  assert.equal(parseImageName('IMG_4821.jpg'), null);
  assert.equal(parseImageName('venom front.jpg'), null);
  assert.equal(parseImageName('scan.png'), null);
});

test('rejects a number too short to be a cert', () => {
  assert.equal(parseImageName('1234_front.jpg'), null);
});

test('rejects trailing junk after the side', () => {
  assert.equal(parseImageName('4245413012_front_v2.jpg'), null);
});

test('matches a CBCS cert whose own dashes look like separators', () => {
  // 21-2EC8B4A-002 contains the same character used to separate the side, so a
  // pattern cannot split it. Matching against known certs can.
  const known = new Set(['21-2EC8B4A-002', '4395549004']);
  assert.deepEqual(parseImageName('21-2EC8B4A-002_front.jpg', known), {
    cert: '21-2EC8B4A-002',
    side: 'front',
  });
  assert.deepEqual(parseImageName('21-2EC8B4A-002-back.jpg', known), {
    cert: '21-2EC8B4A-002',
    side: 'back',
  });
  assert.deepEqual(parseImageName('21-2EC8B4A-002.jpg', known), {
    cert: '21-2EC8B4A-002',
    side: 'front',
  });
});

test('prefers the longest matching cert', () => {
  // A short cert that prefixes a longer one must not steal its files.
  const known = new Set(['4395549', '4395549004']);
  assert.equal(parseImageName('4395549004_back.jpg', known).cert, '4395549004');
});

test('rejects a known-cert prefix followed by junk', () => {
  const known = new Set(['21-2EC8B4A-002']);
  assert.equal(parseImageName('21-2EC8B4A-002_frontv2.jpg', known), null);
});

test('still reads plain CGC names with no cert list', () => {
  assert.deepEqual(parseImageName('4395549004_back.jpg'), { cert: '4395549004', side: 'back' });
});
