/**
 * CGC cert lookup.
 *
 * cgccomics.com sits behind Cloudflare: plain HTTP requests return 403 with or
 * without a browser User-Agent. A real browser clears the challenge in a few
 * seconds, after which the record is plain DOM. So lookups run through Playwright.
 *
 * This is an authoring-time batch job, not a runtime service — a slab's grade
 * never changes, so each cert is looked up exactly once, ever. The challenge is
 * cleared once per session and every cert in the batch reuses that page.
 *
 * Usage:
 *   node src/scrape.js --bin 01 4395549004 4395549005 ...
 *   node src/scrape.js --bin 01 --file certs.txt
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { repairRecord } from './repair.js';

const CERT_URL = (cert) => `https://www.cgccomics.com/certlookup/${cert}/`;
const CHALLENGE_TIMEOUT_MS = 60_000;
const BETWEEN_LOOKUPS_MS = 2_500;

/**
 * Where Chrome keeps its profile between runs.
 *
 * This matters more than it looks. Cloudflare flags Playwright's bundled
 * Chromium and never clears the challenge for it, so lookups run in real Chrome
 * instead. A persistent profile then keeps the cf_clearance cookie, so only the
 * first lookup of a session pays the challenge — later runs start already
 * cleared.
 */
const PROFILE_DIR = path.join('.cache', 'chrome-profile');

/** Field labels CGC renders, mapped to our record keys. */
const FIELD_MAP = {
  'CGC Cert #': 'cert',
  Title: 'title',
  Issue: 'issue',
  'Issue Date': 'issueDate',
  'Issue Year': 'issueYear',
  Publisher: 'publisher',
  Variant: 'variant',
  Grade: 'grade',
  'Page Quality': 'pageQuality',
  'Grade Date': 'gradeDate',
  'Label Category': 'labelCategory',
  'Art Comments': 'artComments',
  'Key Comments': 'keyComments',
};

/**
 * Turn CGC's raw label/value pairs into a record. Pure, so it is tested against a
 * saved fixture without touching the network.
 */
export function normalizeRecord(raw) {
  const record = {};
  for (const [label, value] of raw.pairs ?? []) {
    const key = FIELD_MAP[label.trim()];
    if (key) record[key] = value.trim();
  }

  record.population = parsePopulation(raw.populationText ?? '');
  record.images = {
    front: raw.images?.find((u) => /_OBV/i.test(u)) ?? '',
    back: raw.images?.find((u) => /_REV/i.test(u)) ?? '',
  };

  return repairRecord(record);
}

/**
 * "In 9.8: 83 / In Higher Grades: 0" -> { atGrade: 83, higher: 0, topPop: true }
 * Returns null when CGC does not report population, so downstream code can tell
 * "none higher" apart from "not stated".
 */
export function parsePopulation(text) {
  const atGrade = text.match(/In\s+[\d.]+\s*:\s*([\d,]+)/i);
  const higher = text.match(/In\s+Higher\s+Grades\s*:\s*([\d,]+)/i);
  if (!atGrade && !higher) return null;

  const num = (m) => (m ? Number(m[1].replace(/,/g, '')) : null);
  const pop = { atGrade: num(atGrade), higher: num(higher) };
  pop.topPop = pop.higher === 0;
  return pop;
}

/** Extraction that runs inside the page. Kept small — parsing happens in Node. */
function extractInPage() {
  const pairs = [];
  document.querySelectorAll('dt').forEach((dt) => {
    const dd = dt.nextElementSibling;
    if (dd) pairs.push([dt.innerText.trim(), dd.innerText.trim()]);
  });
  const images = [...document.querySelectorAll('img')]
    .map((i) => i.src)
    .filter((s) => /_OBV|_REV/i.test(s));
  const body = document.body.innerText;
  const start = body.indexOf('Total Graded by CGC');
  return {
    pairs,
    images,
    populationText: start >= 0 ? body.slice(start, start + 300) : '',
  };
}

/**
 * Launch real Chrome with a persistent profile, falling back to Edge and then to
 * the bundled Chromium. The fallback is worth having but rarely works — Cloudflare
 * reliably flags the bundled build.
 */
async function launchRealChrome(chromium) {
  const options = {
    headless: false,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
  };

  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel });
    } catch {
      // channel not installed — try the next one
    }
  }

  console.warn(
    '  ! Neither Chrome nor Edge found; falling back to bundled Chromium.\n' +
      '    Cloudflare usually blocks it. Install Chrome for reliable lookups.',
  );
  return chromium.launchPersistentContext(PROFILE_DIR, options);
}

async function lookupOne(page, cert) {
  await page.goto(CERT_URL(cert), { waitUntil: 'domcontentloaded' });

  // Cloudflare shows an interstitial titled "Just a moment..." before the record.
  await page
    .waitForFunction(() => !document.title.includes('Just a moment'), {
      timeout: CHALLENGE_TIMEOUT_MS,
    })
    .catch(() => {
      throw new Error(`cert ${cert}: Cloudflare challenge did not clear`);
    });

  await page.waitForSelector('dt', { timeout: 15_000 }).catch(() => {
    throw new Error(`cert ${cert}: no record found (bad cert number?)`);
  });

  // The population block renders after the record fields, so extracting as soon
  // as the <dt>s exist loses it. Wait for it, but do not require it — some books
  // genuinely have no population reported.
  await page
    .waitForFunction(() => document.body.innerText.includes('Total Graded by CGC'), {
      timeout: 12_000,
    })
    .catch(() => {});

  const raw = await page.evaluate(extractInPage);
  const record = normalizeRecord(raw);
  record.fetchedAt = new Date().toISOString();

  if (record.cert && record.cert !== String(cert)) {
    throw new Error(`cert ${cert}: page returned ${record.cert}`);
  }
  return record;
}

async function downloadImages(page, record, imageDir) {
  const saved = {};
  for (const [side, url] of Object.entries(record.images)) {
    if (!url) continue;
    const file = `${record.cert}_${side === 'front' ? 'OBV' : 'REV'}.jpg`;
    const dest = path.join(imageDir, file);
    if (!existsSync(dest)) {
      const res = await page.request.get(url);
      if (res.ok()) await writeFile(dest, Buffer.from(await res.body()));
      else console.warn(`  ! could not download ${side} scan for ${record.cert}`);
    }
    saved[side] = file;
  }
  return saved;
}

export async function lookupCerts(certs, { bin, dataDir = 'data' } = {}) {
  const { chromium } = await import('playwright');
  const binDir = path.join(dataDir, 'bins');
  const imageDir = path.join(dataDir, 'images');
  await mkdir(binDir, { recursive: true });
  await mkdir(imageDir, { recursive: true });

  const binFile = path.join(binDir, `bin-${bin}.json`);
  const existing = existsSync(binFile)
    ? JSON.parse(await readFile(binFile, 'utf8'))
    : { bin, title: `Bin ${bin}`, location: '', comics: [] };

  await mkdir(PROFILE_DIR, { recursive: true });
  const context = await launchRealChrome(chromium);
  const page = context.pages()[0] ?? (await context.newPage());
  const failures = [];

  try {
    for (const [i, cert] of certs.entries()) {
      process.stdout.write(`[${i + 1}/${certs.length}] ${cert} ... `);
      try {
        const record = await lookupOne(page, cert);
        record.images = await downloadImages(page, record, imageDir);

        // Re-running a cert overwrites in place rather than duplicating.
        const at = existing.comics.findIndex((c) => c.cert === record.cert);
        if (at >= 0) existing.comics[at] = record;
        else existing.comics.push(record);

        console.log(`${record.title} #${record.issue} ${record.grade}`);
        if (record.unresolved?.length) {
          console.warn(`  ! unrepairable text: ${record.unresolved.join(', ')}`);
        }
      } catch (err) {
        console.log('FAILED');
        console.warn(`  ! ${err.message}`);
        failures.push(cert);
      }
      if (i < certs.length - 1) await page.waitForTimeout(BETWEEN_LOOKUPS_MS);
    }
  } finally {
    await context.close();
  }

  existing.updated = new Date().toISOString().slice(0, 10);
  await writeFile(binFile, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${binFile} (${existing.comics.length} comics)`);
  if (failures.length) console.warn(`Failed: ${failures.join(', ')}`);
  return { file: binFile, failures };
}

async function main() {
  const argv = process.argv.slice(2);
  const binAt = argv.indexOf('--bin');
  if (binAt < 0) {
    console.error('Usage: node src/scrape.js --bin 01 <cert> [cert ...]');
    console.error('       node src/scrape.js --bin 01 --file certs.txt');
    process.exit(1);
  }
  const bin = argv[binAt + 1];

  let certs;
  const fileAt = argv.indexOf('--file');
  if (fileAt >= 0) {
    const text = await readFile(argv[fileAt + 1], 'utf8');
    certs = text.split(/\s+/).filter(Boolean);
  } else {
    certs = argv.filter((a, i) => i !== binAt && i !== binAt + 1 && !a.startsWith('--'));
  }

  if (!certs.length) {
    console.error('No cert numbers given.');
    process.exit(1);
  }

  // A cert listed twice is a transcription slip, not two books — look it up once.
  const unique = [...new Set(certs)];
  if (unique.length !== certs.length) {
    const dupes = certs.filter((c, i) => certs.indexOf(c) !== i);
    console.warn(`Skipping ${certs.length - unique.length} duplicate cert(s): ${[...new Set(dupes)].join(', ')}\n`);
  }

  await lookupCerts(unique, { bin });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
