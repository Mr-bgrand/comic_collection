/**
 * Add a graded comic by hand.
 *
 *   npm run add -- path/to/comic.json
 *
 * For books the scraper cannot reach. CGC is scraped from its cert lookup, but
 * CBCS has no equivalent endpoint here, and there will be raw (ungraded) books
 * later. All three need the same thing: a way to state a record directly.
 *
 * CBCS cannot be automated even in principle: their grading-notes lookup sits
 * behind a reCAPTCHA, and requesting the record URL directly answers "Invalid
 * Comic/Magazine" for a cert that resolves perfectly well for a human. So a
 * CBCS book is always typed in from the page, and `source: 'manual'` records
 * that it was.
 *
 * The file may hold one object or an array. Minimum fields:
 *
 *   { "bin": "04", "grader": "CBCS", "cert": "21-2EC8B4A-002",
 *     "title": "Canto II: The Hollow Men", "issue": "1", "grade": "9.8" }
 *
 * Everything else is optional and mirrors the scraped shape, so a hand-entered
 * book is indistinguishable downstream from a fetched one apart from `grader`
 * and `source`.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BIN_DIR = path.join('data', 'bins');

const REQUIRED = ['bin', 'cert', 'title', 'grade'];

/**
 * Normalise one hand-written entry into a stored record.
 * Throws on anything missing, rather than writing a half-record that quietly
 * breaks a label or a price lookup later.
 */
export function normalizeEntry(input) {
  const missing = REQUIRED.filter((k) => !String(input?.[k] ?? '').trim());
  if (missing.length) throw new Error(`missing required field(s): ${missing.join(', ')}`);

  const population =
    input.population ??
    (input.popAtGrade !== undefined || input.popHigher !== undefined
      ? {
          atGrade: input.popAtGrade ?? null,
          higher: input.popHigher ?? null,
          topPop: Number(input.popHigher) === 0,
        }
      : null);

  const record = {
    cert: String(input.cert).trim(),
    // Absent means CGC, so nothing already stored has to be rewritten.
    grader: (input.grader ?? 'CGC').toUpperCase(),
    title: String(input.title).trim(),
    issue: String(input.issue ?? 'nn').trim(),
    variant: (input.variant ?? '').trim(),
    grade: String(input.grade).trim(),
    pageQuality: (input.pageQuality ?? '').trim(),
    publisher: (input.publisher ?? '').trim(),
    issueYear: String(input.issueYear ?? '').trim(),
    // CBCS calls this the label tier: Authentic, Blue, Restored.
    labelCategory: (input.labelCategory ?? '').trim(),
    keyComments: (input.keyComments ?? '').trim(),
    artComments: (input.artComments ?? '').trim(),
    gradeDate: (input.gradeDate ?? '').trim(),
    population,
    signatures: input.signatures ?? [],
    images: input.images ?? {},
    // Recorded so the provenance of every field is answerable: this one was
    // typed in, not fetched.
    source: 'manual',
    fetchedAt: new Date().toISOString(),
  };

  if (input.certUrl) record.certUrl = String(input.certUrl).trim();
  if (input.pedigree) record.pedigree = String(input.pedigree).trim();

  // Drop empties so a hand-entered record reads like a scraped one.
  for (const [k, v] of Object.entries(record)) {
    if (v === '' || (Array.isArray(v) && !v.length)) delete record[k];
  }
  return record;
}

export async function addComics(file) {
  if (!file || !existsSync(file)) {
    console.error('Usage: npm run add -- path/to/comic.json');
    return { added: 0 };
  }

  const parsed = JSON.parse(await readFile(file, 'utf8'));
  const entries = Array.isArray(parsed) ? parsed : [parsed];

  await mkdir(BIN_DIR, { recursive: true });
  const existingCerts = new Map();
  for (const f of (await readdir(BIN_DIR)).filter((x) => x.endsWith('.json'))) {
    const data = JSON.parse(await readFile(path.join(BIN_DIR, f), 'utf8'));
    for (const c of data.comics ?? []) existingCerts.set(c.cert, data.bin);
  }

  let added = 0;
  let replaced = 0;

  for (const entry of entries) {
    const bin = String(entry.bin ?? '').trim();
    const record = normalizeEntry(entry);

    const already = existingCerts.get(record.cert);
    if (already && already !== bin) {
      console.warn(`  ! ${record.cert} is already in bin ${already}; skipping`);
      continue;
    }

    const binFile = path.join(BIN_DIR, `bin-${bin}.json`);
    const data = existsSync(binFile)
      ? JSON.parse(await readFile(binFile, 'utf8'))
      : { bin, title: `Bin ${bin}`, location: '', comics: [] };

    const at = (data.comics ?? []).findIndex((c) => c.cert === record.cert);
    if (at >= 0) { data.comics[at] = record; replaced += 1; }
    else { data.comics.push(record); added += 1; }

    data.updated = new Date().toISOString().slice(0, 10);
    await writeFile(binFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

    console.log(
      `  bin ${bin}: ${record.grader} ${record.grade} — ${record.title} #${record.issue}` +
        (record.variant ? ` : ${record.variant}` : ''),
    );
  }

  console.log(`\nAdded ${added}, replaced ${replaced}.`);
  if (added || replaced) {
    console.log('These have no cover images yet — run `npm run scan` to add them.');
    console.log('Then: npm run build && npm run print');
  }
  return { added, replaced };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  addComics(process.argv[2]).catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
