import { test } from 'node:test';
import assert from 'node:assert/strict';

import { boxFromFractions } from './recrop.js';

test('turns fractions into a pixel box', () => {
  const box = boxFromFractions({ left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 }, 1000, 800);
  assert.deepEqual(box, { left: 250, top: 80, width: 500, height: 640 });
});

test('clamps a box that runs past the edge', () => {
  const box = boxFromFractions({ left: 0.9, top: 0.9, right: 1.5, bottom: 1.5 }, 1000, 800);
  assert.equal(box.left + box.width, 1000);
  assert.equal(box.top + box.height, 800);
});

test('clamps negatives to the origin', () => {
  const box = boxFromFractions({ left: -0.2, top: -0.5, right: 0.5, bottom: 0.5 }, 1000, 800);
  assert.equal(box.left, 0);
  assert.equal(box.top, 0);
});

test('a reversed box does not produce a negative size', () => {
  // sharp throws on a zero or negative extent, with a message that explains
  // nothing about which of the four numbers was wrong.
  const box = boxFromFractions({ left: 0.8, top: 0.8, right: 0.2, bottom: 0.2 }, 1000, 800);
  assert.ok(box.width >= 1, `width ${box.width}`);
  assert.ok(box.height >= 1, `height ${box.height}`);
});

test('the numbers used on the Magma Edition give a slab-shaped box', () => {
  const box = boxFromFractions({ left: 0.265, top: 0.010, right: 0.722, bottom: 0.972 }, 5816, 4352);
  const ratio = box.height / box.width;
  assert.ok(ratio > 1.3 && ratio < 1.8, `ratio ${ratio.toFixed(2)}`);
});
