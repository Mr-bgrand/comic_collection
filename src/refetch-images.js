/**
 * Fetch cover scans for comics stored without them.
 *
 *   npm run images
 *
 * Separate from the main scrape because the two fail independently. CGC began
 * returning records without scans partway through the bin 03 run, and then empty
 * records entirely — rate limiting after heavy use. The records themselves were
 * fine, so re-running the full scrape would redo 25 good lookups to recover 20
 * images.
 *
 * Goes slower than the scraper on purpose, and stops early if CGC starts serving
 * empty records again rather than hammering a service that is already saying no.
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BIN_DIR = path.join('data', 'bins');
const IMAGE_DIR = path.join('data', 'images');
const PROFILE_DIR = path.join('.cache', 'chrome-profile');
const BETWEEN_MS = 6_000;       // gentler than the scraper's 2.5s
const EMPTY_LIMIT = 3;          // consecutive empty records before giving up

async function launch() {
  const { chromium } = await import('playwright');
  await mkdir(PROFILE_DIR, { recursive: true });
  const options = { headless: false, viewport: null, args: ['--disable-blink-features=AutomationControlled'] };
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel }); } catch {}
  }
  return chromium.launchPersistentContext(PROFILE_DIR, options);
}

export async function refetchImages() {
  const files = existsSync(BIN_DIR)
    ? (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort()
    : [];

  const work = [];
  for (const f of files) {
    const file = path.join(BIN_DIR, f);
    const data = JSON.parse(await readFile(file, 'utf8'));
    for (const comic of data.comics ?? []) {
      if (!comic.images?.front) work.push({ file, data, comic });
    }
  }

  if (!work.length) {
    console.log('Every comic already has a cover image.');
    return { fetched: 0 };
  }
  console.log(`${work.length} comic(s) missing scans.\n`);

  await mkdir(IMAGE_DIR, { recursive: true });
  const context = await launch();
  const page = context.pages()[0] ?? (await context.newPage());
  let fetched = 0;
  let emptyRun = 0;
  const touched = new Map();

  try {
    for (const [i, { file, data, comic } ] of work.entries()) {
      process.stdout.write(`[${i + 1}/${work.length}] ${comic.cert} ... `);
      try {
        await page.goto(`https://www.cgccomics.com/certlookup/${comic.cert}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !document.title.includes('Just a moment'), { timeout: 60_000 });

        // Wait for scans specifically, not just the record.
        await page
          .waitForFunction(
            () => [...document.querySelectorAll('img')].some((im) => /_OBV|_REV/i.test(im.src)),
            { timeout: 20_000 },
          )
          .catch(() => {});

        const urls = await page.evaluate(() =>
          [...document.querySelectorAll('img')].map((im) => im.src).filter((s) => /_OBV|_REV/i.test(s)));

        if (!urls.length) {
          emptyRun += 1;
          console.log('no scans on page');
          if (emptyRun >= EMPTY_LIMIT) {
            console.warn(`\nCGC returned ${EMPTY_LIMIT} records with no scans in a row.`);
            console.warn('Stopping rather than hammering a service that is throttling.');
            console.warn('Everything fetched so far is saved; try again later.');
            break;
          }
          await page.waitForTimeout(BETWEEN_MS);
          continue;
        }

        emptyRun = 0;
        const saved = {};
        for (const url of urls) {
          const side = /_OBV/i.test(url) ? 'front' : 'back';
          const name = `${comic.cert}_${side === 'front' ? 'OBV' : 'REV'}.jpg`;
          const dest = path.join(IMAGE_DIR, name);
          if (!existsSync(dest)) {
            const res = await page.request.get(url);
            if (res.ok()) await writeFile(dest, Buffer.from(await res.body()));
          }
          saved[side] = name;
        }

        comic.images = saved;
        touched.set(file, data);
        // Save immediately: a crash should cost one book, not the batch.
        await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

        fetched += 1;
        console.log(Object.keys(saved).join(' + '));
      } catch (err) {
        if (/browser has been closed|Target page|context or browser/i.test(err.message)) {
          console.log('ABORTED (browser closed)');
          break;
        }
        console.log(`failed: ${err.message.slice(0, 60)}`);
      }
      await page.waitForTimeout(BETWEEN_MS).catch(() => {});
    }
  } finally {
    await context.close().catch(() => {});
  }

  console.log(`\nFetched scans for ${fetched} comic(s).`);
  const left = work.length - fetched;
  if (left) console.warn(`${left} still without images — re-run later to continue.`);
  return { fetched, remaining: left };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refetchImages().catch((err) => { console.error(err); process.exit(1); });
}
