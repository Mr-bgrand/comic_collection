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

/*
 * Exposure independence.
 *
 * Bright mode raises the scanner's brightness to pull detail out of a foil
 * cover, which lifts the mat along with everything else. A fixed threshold of
 * 55 then saw the whole bed as content, found nothing to crop to, and saved the
 * full bed - six images came back 1400x1048 landscape instead of a slab.
 *
 * The mat's absolute brightness is not knowable in advance, so it must be read
 * off the image. What is always true is where it is: the outer edge of a
 * scanner bed is mat, because the slab never reaches the border.
 */

test('finds the slab when the whole bed is brightened', () => {
  // The bright-mode case that broke: mat lifted to 80, well above the old 55.
  const px = field(200, 200, { x: 40, y: 20, w: 80, h: 160 }, { mat: 80, slab: 235 });
  const box = findContentBox(px, 200, 200);
  assert.ok(box, 'no box found on a brightened bed');
  assert.ok(Math.abs(box.left - 0.2) < 0.04, `left ${box?.left}`);
  assert.ok(Math.abs(box.width - 0.4) < 0.04, `width ${box?.width}`);
});

test('finds the slab at a very low exposure too', () => {
  const px = field(200, 200, { x: 40, y: 20, w: 80, h: 160 }, { mat: 4, slab: 60 });
  const box = findContentBox(px, 200, 200);
  assert.ok(box, 'no box found on a dark bed');
  assert.ok(Math.abs(box.left - 0.2) < 0.04, `left ${box?.left}`);
});

test('a brightened but empty bed is still not croppable', () => {
  assert.equal(findContentBox(field(200, 200, null, { mat: 80 }), 200, 200), null);
});

test('a dark cover on a brightened mat is still found by its holder', () => {
  // The real case: the foil cover itself is near-black, but the slab's white
  // label and bright edges are what the box is actually found by.
  const px = field(200, 200, { x: 40, y: 20, w: 80, h: 160 }, { mat: 80, slab: 235 });
  // Blank out most of the slab interior, leaving a label strip at the top.
  for (let y = 40; y < 180; y += 1) {
    for (let x = 44; x < 116; x += 1) px[y * 200 + x] = 12;
  }
  const box = findContentBox(px, 200, 200);
  assert.ok(box, 'no box found');
  assert.ok(box.height > 0.5, `height ${box?.height} - should span the whole holder`);
});

/*
 * Light spill.
 *
 * External light aimed at a foil cover to defeat its mirror finish also lands
 * on the mat around the slab. The bounding box of everything bright then
 * stretches from the slab out to the spill, covers almost the whole bed, and
 * the crop gives up - a good scan saved as a full 1400x1048 bed.
 *
 * The slab is the one large solid block. Spill is a separate patch with a gap
 * between, so the box is taken from the widest run of content rather than from
 * the first and last bright pixel anywhere in the frame.
 */

test('ignores a bright patch of spill beside the slab', () => {
  const px = field(200, 200, { x: 70, y: 20, w: 90, h: 160 }, { mat: 12, slab: 200 });
  // A lamp flare in the left margin, well clear of the slab.
  for (let y = 150; y < 190; y += 1) {
    for (let x = 4; x < 30; x += 1) px[y * 200 + x] = 190;
  }
  const box = findContentBox(px, 200, 200);
  assert.ok(box, 'no box found');
  assert.ok(box.left > 0.28, `left ${box?.left?.toFixed(3)} - spill pulled the box out`);
  assert.ok(box.width < 0.6, `width ${box?.width?.toFixed(3)} - box spans spill and slab`);
});

test('spill above and below does not stretch the box vertically', () => {
  const px = field(200, 200, { x: 60, y: 50, w: 90, h: 100 }, { mat: 12, slab: 200 });
  for (let y = 2; y < 16; y += 1) {
    for (let x = 2; x < 24; x += 1) px[y * 200 + x] = 190;
  }
  const box = findContentBox(px, 200, 200);
  assert.ok(box, 'no box found');
  assert.ok(box.top > 0.18, `top ${box?.top?.toFixed(3)} - spill pulled the box up`);
});

test('still finds a slab that genuinely fills most of the bed', () => {
  const box = findContentBox(field(200, 200, { x: 12, y: 6, w: 176, h: 188 }), 200, 200);
  assert.ok(box, 'a large slab must still be found');
  assert.ok(box.width > 0.8, `width ${box?.width?.toFixed(3)}`);
});
