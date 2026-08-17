/**
 * Re-run encoding repair over every stored bin.
 *
 * The repair table only fixes names it recognises, so a lookup can store text it
 * could not repair and warn about it. Once the correct spelling is added to
 * KNOWN_NAMES in repair.js, this applies it to already-stored records — no need
 * to hit CGC again for books that are otherwise fine.
 *
 *   npm run repair
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { repairRecord } from './repair.js';

const BIN_DIR = path.join('data', 'bins');

export async function rerepair() {
  if (!existsSync(BIN_DIR)) {
    console.log('No bins to repair.');
    return { fixed: 0, remaining: 0 };
  }

  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  let fixed = 0;
  let remaining = 0;

  for (const file of files) {
    const full = path.join(BIN_DIR, file);
    const bin = JSON.parse(await readFile(full, 'utf8'));
    let changed = false;

    bin.comics = (bin.comics ?? []).map((comic) => {
      const before = comic.unresolved?.length ?? 0;
      if (!before) return comic;

      // Repair is idempotent: already-clean fields pass through untouched.
      const after = repairRecord(comic);
      delete after.unresolved;
      const still = repairRecord(after).unresolved?.length ?? 0;

      if (still < before) {
        fixed += before - still;
        changed = true;
        console.log(`  bin ${bin.bin} cert ${comic.cert}: repaired ${before - still}`);
      }
      if (still) {
        remaining += still;
        after.unresolved = repairRecord(after).unresolved;
        console.warn(`  ! bin ${bin.bin} cert ${comic.cert}: still damaged ${after.unresolved.join(', ')}`);
      }
      return after;
    });

    if (changed) await writeFile(full, `${JSON.stringify(bin, null, 2)}\n`, 'utf8');
  }

  console.log(`\nRepaired ${fixed} name(s); ${remaining} still unresolved.`);
  if (remaining) console.log('Add the correct spelling to KNOWN_NAMES in src/repair.js.');
  return { fixed, remaining };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rerepair().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
