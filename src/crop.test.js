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

/*
 * Two books on the bed.
 *
 * Raw comics are scanned two at a time, side by side. The bed is 19.4" wide and
 * two bagged comics are 13.5", so there is always a run of mat between them.
 * The column profile therefore has two solid runs, and each becomes its own
 * box - in left-to-right order, because that is the order the books were laid.
 */

import { findContentBoxes } from './crop.js';

function twoUp(w, h, left, right, opts) {
  const px = field(w, h, left, opts);
  for (let y = right.y; y < right.y + right.h; y += 1) {
    for (let x = right.x; x < right.x + right.w; x += 1) px[y * w + x] = opts?.slab ?? 200;
  }
  return px;
}

test('two books side by side become two boxes, left first', () => {
  const px = twoUp(300, 200, { x: 20, y: 20, w: 100, h: 160 }, { x: 170, y: 20, w: 100, h: 160 });
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 2);
  assert.ok(boxes[0].left < boxes[1].left, 'left book must come first');
  assert.ok(Math.abs(boxes[0].left - 20 / 300) < 0.03, `left ${boxes[0].left}`);
  assert.ok(Math.abs(boxes[1].left - 170 / 300) < 0.03, `right ${boxes[1].left}`);
  for (const b of boxes) assert.ok(Math.abs(b.width - 100 / 300) < 0.03, `width ${b.width}`);
});

test('one book on a two-up bed gives one box, not a phantom second', () => {
  const px = field(300, 200, { x: 20, y: 20, w: 100, h: 160 });
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 1);
});

test('books of different sizes are both found with their own heights', () => {
  const px = twoUp(300, 200, { x: 20, y: 10, w: 100, h: 180 }, { x: 170, y: 40, w: 90, h: 120 });
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 2);
  assert.ok(boxes[0].height > boxes[1].height, 'each box keeps its own row extent');
  assert.ok(Math.abs(boxes[1].top - 40 / 200) < 0.03, `right top ${boxes[1].top}`);
});

test('a patch of lamp spill does not become a third book', () => {
  // Spill sits 34 columns clear of the left book - beyond the 6% gap allowance
  // that bridges a dark band across a single cover. Closer than that and it is
  // indistinguishable from a dark panel at the book's own edge.
  const px = twoUp(300, 200, { x: 50, y: 20, w: 90, h: 160 }, { x: 180, y: 20, w: 90, h: 160 });
  for (let y = 150; y < 190; y += 1) for (let x = 4; x < 16; x += 1) px[y * 300 + x] = 190;
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 2);
  assert.ok(boxes[0].left > 0.1, `spill (at x<22) must not be a box: left ${boxes[0].left}`);
});

test('an empty bed gives no boxes', () => {
  assert.deepEqual(findContentBoxes(field(300, 200, null), 300, 200, { max: 2 }), []);
});

test('findContentBox is unchanged: the single widest box', () => {
  const px = twoUp(300, 200, { x: 20, y: 20, w: 120, h: 160 }, { x: 200, y: 20, w: 60, h: 160 });
  const one = findContentBox(px, 300, 200);
  assert.ok(Math.abs(one.width - 120 / 300) < 0.03, 'the wider of the two');
});

/*
 * Two books touching.
 *
 * The first real two-up bed had the books placed edge to edge, so the column
 * profile was one continuous run and both came out as a single 1400x1182
 * crop. A comic is about 1.5 times as tall as it is wide; one box that comes
 * out landscape is two books, and the seam between two bagged books is a dip
 * in the profile. If there is no dip at all, the middle is the honest guess.
 */

test('two books touching, with a seam, are split at the seam', () => {
  // Two 100-wide books, 2 dark columns between them at x=120..121.
  const px = twoUp(300, 200, { x: 20, y: 20, w: 100, h: 160 }, { x: 122, y: 20, w: 100, h: 160 });
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 2, 'touching books must still become two boxes');
  const seam = boxes[0].left + boxes[0].width;
  assert.ok(Math.abs(seam - 121 / 300) < 0.03, `split at ${seam.toFixed(3)}, seam is at 0.403`);
});

test('two books touching with no visible seam are split in the middle', () => {
  // One continuous 200-wide, 160-tall rectangle: landscape, so two books.
  const px = field(300, 200, { x: 20, y: 20, w: 200, h: 160 });
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 2);
  assert.ok(Math.abs(boxes[0].width - boxes[1].width) < 0.03, 'halves of equal width');
  assert.ok(Math.abs((boxes[0].left + boxes[0].width) - 120 / 300) < 0.03, 'split at the middle');
});

test('a single portrait book is never split', () => {
  const px = field(300, 200, { x: 100, y: 10, w: 100, h: 180 });
  assert.equal(findContentBoxes(px, 300, 200, { max: 2 }).length, 1);
});

test('the seam split only applies when two were asked for', () => {
  const px = field(300, 200, { x: 20, y: 20, w: 200, h: 160 });
  assert.equal(findContentBoxes(px, 300, 200, { max: 1 }).length, 1);
});

test('the halves keep their own heights when the books differ', () => {
  // Left book taller than the right, touching, with a seam.
  const px = twoUp(300, 200, { x: 20, y: 10, w: 100, h: 180 }, { x: 122, y: 40, w: 100, h: 120 });
  const boxes = findContentBoxes(px, 300, 200, { max: 2 });
  assert.equal(boxes.length, 2);
  assert.ok(boxes[0].height > boxes[1].height + 0.1, `left ${boxes[0].height.toFixed(2)} right ${boxes[1].height.toFixed(2)}`);
});
