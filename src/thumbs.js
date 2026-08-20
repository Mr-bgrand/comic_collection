/**
 * Image derivatives.
 *
 * The committed cover scans are 500x787 at ~370KB each. Using them directly cost
 * real bytes in two places: a 46-book dashboard table would have been a ~17MB
 * download, and the manifest PDF was 8MB because a 0.40in-wide print thumbnail
 * needs about 120px, so the scan was ~16x oversized in each dimension.
 *
 * Two sizes, each cut to what actually consumes it:
 *
 *   thumb  120px  table rows (~26px on screen, 2x retina) and print at 300dpi
 *   medium 480px  the hover preview, which is ~240px wide at 2x
 *
 * Generated rather than committed: they derive entirely from data/images, so
 * checking them in would duplicate the same pixels at two more sizes.
 */

import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const IMAGE_DIR = path.join('data', 'images');
export const THUMB_DIR = path.join('data', 'thumbs');
export const MEDIUM_DIR = path.join('data', 'medium');
/*
 * The wall shows every cover at once, so all 80 load immediately — lazy loading
 * buys nothing when everything is on screen by design. At 480px that is 5.6MB;
 * at 300px it is ~2MB and still sharp on a retina tile. The hovered slab swaps
 * up to the 480px copy, which is the only one ever seen large.
 */
export const WALL_DIR = path.join('data', 'wall');

const SIZES = [
  { dir: THUMB_DIR, width: 120, quality: 80 },
  { dir: WALL_DIR, width: 300, quality: 76 },
  { dir: MEDIUM_DIR, width: 480, quality: 78 },
];

/**
 * Generate every derivative that is missing or older than its source.
 */
export async function ensureThumbs({ quiet = false } = {}) {
  if (!existsSync(IMAGE_DIR)) return { made: 0, skipped: 0 };
  const { default: sharp } = await import('sharp');

  const files = (await readdir(IMAGE_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
  let made = 0;
  let skipped = 0;

  for (const size of SIZES) {
    await mkdir(size.dir, { recursive: true });

    for (const file of files) {
      const src = path.join(IMAGE_DIR, file);
      const dest = path.join(size.dir, file.replace(/\.(jpe?g|png)$/i, '.jpg'));

      if (existsSync(dest)) {
        const [a, b] = await Promise.all([stat(src), stat(dest)]);
        if (b.mtimeMs >= a.mtimeMs) {
          skipped += 1;
          continue;
        }
      }

      const buf = await sharp(src)
        .resize({ width: size.width, withoutEnlargement: true })
        .jpeg({ quality: size.quality, progressive: true })
        .toBuffer();
      await writeFile(dest, buf);
      made += 1;
    }
  }

  if (!quiet && (made || skipped)) {
    console.log(`  images: ${made} derivatives generated, ${skipped} current`);
  }
  return { made, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureThumbs().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
