/**
 * Crop a scan by hand, from the bed image that was kept.
 *
 *   npm run recrop -- 4177706003_OBV                 # try the automatic crop again
 *   npm run recrop -- 4177706003_OBV 0.27 0.01 0.72 0.97
 *
 * Automatic cropping is a guess about where the slab is, and some scans defeat
 * it: a lamp brought in to beat a foil cover's mirror finish lights the mat, and
 * a lit mat looks like content. Rather than tune the guess until it handles
 * every lighting rig, this crops from numbers you can see.
 *
 * It works on `.cache/raw/`, the untouched bed kept by every scan, so a bad crop
 * costs a command rather than another trip to the scanner. The four numbers are
 * fractions of the bed - left, top, right, bottom - read straight off the image.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { cropToSlab } from './crop.js';

const RAW_DIR = path.join('.cache', 'raw');
const IMAGE_DIR = path.join('data', 'images');
const MAX_EDGE = 1400;

/**
 * Turn four fractions into a pixel box, clamped inside the image.
 * Pure, so the arithmetic is checkable without an image.
 */
export function boxFromFractions({ left, top, right, bottom }, width, height) {
  const l = Math.max(0, Math.min(1, left));
  const t = Math.max(0, Math.min(1, top));
  const r = Math.max(l, Math.min(1, right));
  const b = Math.max(t, Math.min(1, bottom));

  const x = Math.round(width * l);
  const y = Math.round(height * t);
  return {
    left: x,
    top: y,
    width: Math.max(1, Math.min(width - x, Math.round(width * (r - l)))),
    height: Math.max(1, Math.min(height - y, Math.round(height * (b - t)))),
  };
}

export async function recrop(name, fractions = null, { maxEdge = MAX_EDGE } = {}) {
  const { default: sharp } = await import('sharp');

  const file = name.endsWith('.jpg') ? name : `${name}.jpg`;
  const rawPath = path.join(RAW_DIR, file);
  if (!existsSync(rawPath)) {
    throw new Error(
      `No kept bed for ${file}. Only scans taken since raws were kept can be re-cropped.`,
    );
  }

  // Read to a buffer first: on Windows sharp holds the file open, and writing
  // back to the same path while it does fails with an unhelpful UNKNOWN error.
  const raw = await readFile(rawPath);
  const meta = await sharp(raw).metadata();

  let out;
  if (fractions) {
    out = await sharp(raw)
      .extract(boxFromFractions(fractions, meta.width, meta.height))
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();
  } else {
    ({ buffer: out } = await cropToSlab(raw, { maxEdge }));
  }

  await mkdir(IMAGE_DIR, { recursive: true });
  await writeFile(path.join(IMAGE_DIR, file), out);

  const after = await sharp(out).metadata();
  return {
    file,
    bed: `${meta.width}x${meta.height}`,
    result: `${after.width}x${after.height}`,
    ratio: (after.height / after.width).toFixed(2),
  };
}

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  if (!name) {
    console.error('Usage: npm run recrop -- <cert>_OBV [left top right bottom]');
    console.error('       fractions of the bed, 0-1, e.g. 0.27 0.01 0.72 0.97');
    process.exit(1);
  }

  const nums = rest.map(Number);
  const fractions = nums.length === 4 && nums.every((n) => Number.isFinite(n))
    ? { left: nums[0], top: nums[1], right: nums[2], bottom: nums[3] }
    : null;

  const r = await recrop(name, fractions);
  console.log(`${r.file}: bed ${r.bed} -> ${r.result} (ratio ${r.ratio})`);
  // A CGC slab is about 1.5 times as tall as it is wide; far from that is a
  // sign the box is wrong, and worth saying before it reaches a printed sheet.
  if (Number(r.ratio) < 1.3 || Number(r.ratio) > 1.8) {
    console.warn('  that ratio does not look like a slab - check the numbers');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
