/**
 * Import cover images you supply yourself.
 *
 *   1. Drop files in data/incoming/
 *   2. npm run images:import
 *
 * For the 21 books CGC never photographed. That is not a throttling problem that
 * waiting fixes — CGC's imaging is an add-on those submissions did not include,
 * so the scans do not exist and never will. A photo you take is the only way to
 * get the actual slab.
 *
 * Filenames drive everything; no manifest to keep in sync:
 *
 *   4245413012_front.jpg     front of that cert
 *   4245413012_back.jpg      back
 *   4245413012.jpg           treated as the front
 *
 * Separators are flexible (`_`, `-`, space) and case does not matter, because
 * these are typed by hand next to a physical slab. jpg, jpeg, png and webp are
 * accepted and normalised to jpg.
 */

import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { cropToSlab } from './crop.js';

const INCOMING_DIR = path.join('data', 'incoming');
const IMAGE_DIR = path.join('data', 'images');
const BIN_DIR = path.join('data', 'bins');
const DONE_DIR = path.join('data', 'incoming', 'imported');

/** Longest edge kept. CGC's own scans are 787px tall; this is comfortably above. */
const MAX_EDGE = 1200;

/**
 * Read a cert and side out of a filename.
 * Returns null when the name carries no cert, so junk in the folder is reported
 * rather than guessed at.
 */
export function parseImageName(filename) {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/^\s*(\d{7,12})\s*(?:[_\-\s]+(front|back|obv|rev|f|b))?\s*$/i);
  if (!match) return null;

  const [, cert, rawSide] = match;
  const side = !rawSide
    ? 'front'
    : /^(back|rev|b)$/i.test(rawSide)
      ? 'back'
      : 'front';
  return { cert, side };
}

async function loadBins() {
  if (!existsSync(BIN_DIR)) return [];
  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => ({
      file: path.join(BIN_DIR, f),
      data: JSON.parse(await readFile(path.join(BIN_DIR, f), 'utf8')),
    })),
  );
}

export async function importImages() {
  await mkdir(INCOMING_DIR, { recursive: true });

  const entries = (await readdir(INCOMING_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
    .map((e) => e.name);

  if (!entries.length) {
    console.log(`Nothing to import. Drop files in ${INCOMING_DIR}/ named like:`);
    console.log('  4245413012_front.jpg');
    console.log('  4245413012_back.jpg');
    return { imported: 0 };
  }

  const bins = await loadBins();
  const byCert = new Map();
  for (const { file, data } of bins) {
    for (const comic of data.comics ?? []) byCert.set(comic.cert, { file, data, comic });
  }

  await mkdir(IMAGE_DIR, { recursive: true });
  await mkdir(DONE_DIR, { recursive: true });

  let imported = 0;
  const unnamed = [];
  const unknown = [];
  const touched = new Set();

  for (const name of entries) {
    const parsed = parseImageName(name);
    if (!parsed) {
      unnamed.push(name);
      continue;
    }

    const entry = byCert.get(parsed.cert);
    if (!entry) {
      // A cert not in the collection is a typo or the wrong file — say so rather
      // than writing an image nothing will ever reference.
      unknown.push(`${name} (cert ${parsed.cert})`);
      continue;
    }

    const outName = `${parsed.cert}_${parsed.side === 'front' ? 'OBV' : 'REV'}.jpg`;
    // Same crop as the scanner path: a phone photo of a slab on a desk has the
    // same problem as a scanner bed, just with a messier background.
    const { buffer } = await cropToSlab(path.join(INCOMING_DIR, name), { maxEdge: MAX_EDGE });
    await writeFile(path.join(IMAGE_DIR, outName), buffer);

    const { comic, file, data } = entry;
    comic.images = { ...(comic.images ?? {}), [parsed.side]: outName };
    // These are your photographs, not CGC's scans. Recorded so the provenance of
    // every image on the site is answerable.
    comic.imageSource = 'owner';
    delete comic.noScans;
    touched.add(JSON.stringify({ file, data: null }) && file);

    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(path.join(INCOMING_DIR, name), path.join(DONE_DIR, name));

    imported += 1;
    console.log(`  ${name} -> ${parsed.cert} ${parsed.side}`);
  }

  console.log(`\nImported ${imported} image(s).`);
  if (unnamed.length) {
    console.warn(`\n${unnamed.length} file(s) without a cert number in the name:`);
    for (const n of unnamed.slice(0, 8)) console.warn(`  ${n}`);
    console.warn('  Rename them <cert>_front.jpg / <cert>_back.jpg and re-run.');
  }
  if (unknown.length) {
    console.warn(`\n${unknown.length} file(s) whose cert is not in any bin:`);
    for (const n of unknown.slice(0, 8)) console.warn(`  ${n}`);
  }
  if (imported) console.log('\nNext: npm run build && npm run print');

  return { imported, unnamed: unnamed.length, unknown: unknown.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importImages().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
