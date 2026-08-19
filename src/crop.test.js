import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findContentBox } from './crop.js';

/** Build a greyscale field with a bright rectangle on a near-black mat. */
function field(w, h, rect, { mat = 10, slab = 200 } = {}) {
  const px = new Uint8Array(w * h).fill(mat);
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) px[y * w + x] = slab;
    }
  }
  return px;
}

test('finds a slab sitting on a dark mat', () => {
  const box = findContentBox(field(200, 200, { x: 40, y: 20, w: 80, h: 160 }), 200, 200);
  assert.ok(box);
  assert.ok(Math.abs(box.left - 0.2) < 0.03, `left ${box.left}`);
  assert.ok(Math.abs(box.top - 0.1) < 0.03, `top ${box.top}`);
  assert.ok(Math.abs(box.width - 0.4) < 0.03, `width ${box.width}`);
  assert.ok(Math.abs(box.height - 0.8) < 0.03, `height ${box.height}`);
});

test('returns null for a blank bed rather than cropping nonsense', () => {
  // A failed scan or an empty mat must not be cropped to a random sliver.
  assert.equal(findContentBox(field(200, 200, null), 200, 200), null);
});

test('returns null when content already fills the frame', () => {
  // Nothing to gain, and cropping would only risk clipping the holder.
  assert.equal(findContentBox(field(200, 200, { x: 0, y: 0, w: 200, h: 200 }), 200, 200), null);
});

test('ignores a small bright speck', () => {
  // A reflection or a stray object is not a comic.
  assert.equal(findContentBox(field(200, 200, { x: 90, y: 90, w: 8, h: 8 }), 200, 200), null);
});

test('a dim mat does not count as content', () => {
  const px = field(200, 200, { x: 50, y: 50, w: 60, h: 100 }, { mat: 50, slab: 220 });
  const box = findContentBox(px, 200, 200);
  assert.ok(box, 'slab still found');
  assert.ok(box.width < 0.5, `mat not included, got width ${box.width}`);
});

test('handles a slab flush against an edge', () => {
  const box = findContentBox(field(200, 200, { x: 0, y: 0, w: 70, h: 180 }), 200, 200);
  assert.ok(box);
  assert.ok(box.left < 0.02, `left ${box.left}`);
});
