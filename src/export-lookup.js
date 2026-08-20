/**
 * Export each bin as a folder of cover images plus a CSV, for handing to an
 * external price-lookup tool.
 *
 *   npm run export
 *
 * Layout, one folder per bin, so a tool can be pointed at a single directory:
 *
 *   export/bin-01/
 *     bin-01.csv
 *     4395549004_front.jpg
 *     4395549004_back.jpg
 *
 * Image filenames are the cert number plus side, and `cert` is the CSV's first
 * column — so a row and its pictures find each other with no path column and no
 * lookup table. The cert is already the unique key CGC assigns, so nothing new
 * has to be invented or kept in sync.
 *
 * The CSV carries a prebuilt `search_query`. Matching a graded variant on a
 * marketplace is the hard part of this job, and the fields needed to do it well
 * (retailer, finish, printing) live in the CGC variant string in a form that
 * needs cleaning rather than passing through raw.
 */

import { mkdir, writeFile, readFile, readdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { displayTitle, fmvValue, manualValue, isTopPop } from './model.js';
import { buildVariantIndex } from './variants.js';

const BIN_DIR = path.join('data', 'bins');
const IMAGE_DIR = path.join('data', 'images');
const EXPORT_DIR = 'export';

/**
 * Trailing filler. Only ever stripped from the END of a variant string.
 *
 * An earlier version stripped these words anywhere, which quietly destroyed the
 * retailer names that distinguish one variant from another: "The Comic Corner
 * Edition" collapsed to "Corner", and searching that returns the whole site.
 * Retailer names routinely contain generic words, so it is position that makes a
 * word filler, not the word itself.
 */
const TRAILING_FILLER = /[ ]+(edition|variant|cover)[ ]*$/i;

/**
 * A marketplace-ready query.
 *
 * Keeps the retailer and finish words that distinguish one variant from another,
 * drops only the trailing boilerplate. Quotes a multi-word variant so it is
 * matched as a phrase rather than as loose keywords.
 */
export function searchQuery(comic) {
  const issue = comic.issue && comic.issue !== 'nn' ? `#${comic.issue}` : '';

  let variant = String(comic.variant ?? '').replace(/["']/g, ' ');
  // Trailing filler stacks: "Foil Variant Cover".
  let previous;
  do {
    previous = variant;
    variant = variant.replace(TRAILING_FILLER, '');
  } while (variant !== previous);
  variant = variant.replace(/\s+/g, ' ').trim();

  const phrase = variant.includes(' ') ? `"${variant}"` : variant;
  return [comic.title, issue, phrase, 'CGC', comic.grade]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * One record per physical line, always.
 *
 * Quoting an embedded newline is valid CSV, but this file is consumed by another
 * tool and naive parsers routinely split on every newline — which would turn 71
 * comics into 111 malformed rows. Newlines inside a field collapse to "; "
 * instead; no field here is prose where a line break carries meaning.
 */
const csvCell = (value) => {
  const text = (value === null || value === undefined ? '' : String(value))
    // "; " rather than a plain space, so separate lines stay visibly separate:
    // three art credits should not read as one run-on sentence.
    .replace(/\r?\n/g, '; ')
    .replace(/\s+/g, ' ')
    .trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const COLUMNS = [
  'cert', 'bin', 'title', 'issue', 'variant', 'grade', 'page_quality',
  'publisher', 'issue_year', 'label_category', 'key_comments',
  'pop_at_grade', 'pop_higher', 'top_pop',
  'gocollect_fmv', 'gocollect_url', 'manual_value', 'needs_price',
  'search_query', 'front_image', 'back_image',
  // What this book must NOT be confused with. Half the collection shares a
  // title and issue with something else.
  'variant_group_size', 'match_difficulty', 'exclude_terms', 'confusable_certs',
];

export function toRow(comic, bin, variantInfo) {
  const vi = variantInfo ?? { groupSize: 1, siblingCerts: [], excludeTerms: [], difficulty: 'unique' };
  const market = fmvValue(comic);
  const manual = manualValue(comic);
  return {
    cert: comic.cert,
    bin,
    title: comic.title,
    issue: comic.issue,
    variant: comic.variant ?? '',
    grade: comic.grade,
    page_quality: comic.pageQuality ?? '',
    publisher: comic.publisher ?? '',
    // CGC fills unknown years with 1900; passing that on as fact would be worse
    // than passing nothing.
    issue_year: comic.issueYear && comic.issueYear !== '1900' ? comic.issueYear : '',
    label_category: comic.labelCategory ?? '',
    key_comments: comic.keyComments ?? '',
    pop_at_grade: comic.population?.atGrade ?? '',
    pop_higher: comic.population?.higher ?? '',
    top_pop: isTopPop(comic) ? 'yes' : 'no',
    gocollect_fmv: market ?? '',
    gocollect_url: comic.fmv?.url ?? '',
    manual_value: manual ?? '',
    // The whole point of the export: which books still need a price.
    needs_price: market === null && manual === null ? 'yes' : 'no',
    search_query: searchQuery(comic),
    front_image: comic.images?.front ? `${comic.cert}_front.jpg` : '',
    back_image: comic.images?.back ? `${comic.cert}_back.jpg` : '',
    variant_group_size: vi.groupSize,
    // unique | text | visual -- 'visual' means no query can separate this book
    // from its siblings and the cover image is the only discriminator.
    match_difficulty: vi.difficulty,
    exclude_terms: vi.excludeTerms.join(' '),
    confusable_certs: vi.siblingCerts.join(' '),
  };
}

export function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) lines.push(COLUMNS.map((c) => csvCell(row[c])).join(','));
  return `${lines.join('\n')}\n`;
}

async function loadBins() {
  if (!existsSync(BIN_DIR)) return [];
  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(BIN_DIR, f), 'utf8'))),
  );
}

export async function exportForLookup() {
  const bins = await loadBins();
  if (!bins.length) {
    console.log('No bins to export.');
    return { bins: 0 };
  }

  await rm(EXPORT_DIR, { recursive: true, force: true });
  await mkdir(EXPORT_DIR, { recursive: true });

  /*
   * Build the confusable index across the WHOLE collection, not per bin.
   * Amazing Spider-Man #21 has variants sitting in different bins, and a book
   * you could mistake for another is no less confusable for being stored
   * elsewhere.
   */
  const everything = bins.flatMap((bin) =>
    (bin.comics ?? []).map((comic) => ({ comic, bin: bin.bin })),
  );
  const variants = buildVariantIndex(everything);

  const all = [];
  let missingImages = 0;

  for (const bin of bins) {
    const dir = path.join(EXPORT_DIR, `bin-${bin.bin}`);
    await mkdir(dir, { recursive: true });

    const rows = (bin.comics ?? []).map((c) => toRow(c, bin.bin, variants.get(c.cert)));
    all.push(...rows);

    for (const comic of bin.comics ?? []) {
      for (const side of ['front', 'back']) {
        const src = comic.images?.[side];
        if (!src) continue;
        const from = path.join(IMAGE_DIR, src);
        if (!existsSync(from)) continue;
        await copyFile(from, path.join(dir, `${comic.cert}_${side}.jpg`));
      }
      if (!comic.images?.front) missingImages += 1;
    }

    await writeFile(path.join(dir, `bin-${bin.bin}.csv`), toCsv(rows), 'utf8');

    const needs = rows.filter((r) => r.needs_price === 'yes').length;
    console.log(`  bin ${bin.bin}: ${rows.length} rows, ${needs} needing a price`);
  }

  // One combined file too, for running the whole collection in a single pass.
  await writeFile(path.join(EXPORT_DIR, 'all-bins.csv'), toCsv(all), 'utf8');

  const needsPrice = all.filter((r) => r.needs_price === 'yes');
  const visual = all.filter((r) => r.match_difficulty === 'visual');
  if (visual.length) {
    console.log(
      `\n${visual.length} book(s) cannot be told from their variants by text alone —`,
    );
    console.log('the cover image is the only discriminator for those.');
  }
  console.log(`\nWrote ${EXPORT_DIR}/ — ${all.length} comics across ${bins.length} bins`);
  console.log(
    `${needsPrice.length} need a price; ${all.length - needsPrice.length} already have one`,
  );
  if (missingImages) {
    console.warn(`\n! ${missingImages} comic(s) have no cover image to export.`);
    console.warn('  Run `npm run images` to fetch the missing scans from CGC.');
  }
  return {
    bins: bins.length,
    comics: all.length,
    needsPrice: needsPrice.length,
    missingImages,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  exportForLookup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
