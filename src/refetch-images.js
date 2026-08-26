/**
 * Fetch cover scans for comics stored without them.
 *
 *   npm run images
 *
 * Separate from the main scrape because the two fail independently. CGC began
 * returning records without scans partway through the bin 03 run, and then empty
 * records entirely. The records themselves were fine, so re-running the full
 * scrape would redo 25 good lookups to recover 20 images.
 *
 * Two different "no image" cases, which must not be confused:
 *
 *   record renders, no scans   CGC never photographed this book. Permanent.
 *                              Marked `noScans` so it is not asked about again.
 *   record does not render     CGC is throttling. Temporary. Back off.
 *
 * Treating the first as the second is what made an earlier version give up
 * immediately every run: the very first book in the list genuinely has no scans,
 * so it consumed a strike before any real request was judged.
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BIN_DIR = path.join('data', 'bins');
const IMAGE_DIR = path.join('data', 'images');
const PROFILE_DIR = path.join('.cache', 'chrome-profile');
const BETWEEN_MS = 6_000; // gentler than the scraper's 2.5s
const THROTTLE_LIMIT = 3; // consecutive unrendered records before giving up

async function launch() {
  const { chromium } = await import('playwright');
  await mkdir(PROFILE_DIR, { recursive: true });
  const options = {
    headless: false,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
  };
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel });
    } catch {
      /* try the next channel */
    }
  }
  return chromium.launchPersistentContext(PROFILE_DIR, options);
}

export async function refetchImages({ retryKnownMissing = false } = {}) {
  const files = existsSync(BIN_DIR)
    ? (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort()
    : [];

  const work = [];
  let knownMissing = 0;
  for (const f of files) {
    const file = path.join(BIN_DIR, f);
    const data = JSON.parse(await readFile(file, 'utf8'));
    for (const comic of data.comics ?? []) {
      if (comic.images?.front) continue;
      if (comic.noScans && !retryKnownMissing) {
        knownMissing += 1;
        continue;
      }
      work.push({ file, data, comic });
    }
  }

  if (knownMissing) {
    console.log(`${knownMissing} comic(s) CGC has no scans for — skipping (--retry-all to recheck).`);
  }
  if (!work.length) {
    console.log('Nothing to fetch.');
    return { fetched: 0, remaining: 0 };
  }
  console.log(`${work.length} comic(s) to try.\n`);

  await mkdir(IMAGE_DIR, { recursive: true });
  const context = await launch();
  let page = context.pages()[0] ?? (await context.newPage());

  /**
   * Replace a crashed tab. Chrome dropped a renderer mid-batch and every later
   * lookup then failed against the dead page — one crash cost fifteen books.
   * A crashed tab never recovers, so it is discarded outright.
   */
  const revivePage = async () => {
    await page.close().catch(() => {});
    page = await context.newPage();
  };
  let fetched = 0;
  let permanent = 0;
  let throttleRun = 0;
  let stoppedEarly = false;

  const save = async (file, data) => {
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  };

  try {
    // A mutable queue rather than a fixed iterator, so a book lost to a browser
    // crash can be put back and retried once on a fresh tab.
    const queue = [...work];
    const crashRetried = new Set();
    let done = 0;

    while (queue.length) {
      const item = queue[0];
      const { file, data, comic } = item;
      queue.shift();
      done += 1;
      process.stdout.write(`[${done}/${work.length}] ${comic.cert} ... `);
      try {
        await page.goto(`https://www.cgccomics.com/certlookup/${comic.cert}/`, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForFunction(() => !document.title.includes('Just a moment'), {
          timeout: 60_000,
        });

        // Wait for the record, then give scans their own chance to appear.
        const rendered = await page
          .waitForSelector('dt', { timeout: 20_000 })
          .then(() => true)
          .catch(() => false);

        if (rendered) {
          await page
            .waitForFunction(
              () => [...document.querySelectorAll('img')].some((im) => /_OBV|_REV/i.test(im.src)),
              { timeout: 15_000 },
            )
            .catch(() => {});
        }

        const urls = await page.evaluate(() =>
          [...document.querySelectorAll('img')].map((im) => im.src).filter((s) => /_OBV|_REV/i.test(s)),
        );

        if (!rendered) {
          // The record did not load at all — this is throttling, not absence.
          throttleRun += 1;
          console.log('record did not load');
          if (throttleRun >= THROTTLE_LIMIT) {
            console.warn(`\nCGC failed to render ${THROTTLE_LIMIT} records in a row — it is throttling.`);
            console.warn('Stopping. Everything fetched so far is saved; try again later.');
            stoppedEarly = true;
            break;
          }
          await page.waitForTimeout(BETWEEN_MS);
          continue;
        }

        throttleRun = 0;

        if (!urls.length) {
          // Record loaded fine, CGC simply has no photographs of this book.
          comic.noScans = true;
          await save(file, data);
          permanent += 1;
          console.log('CGC has no scans for this cert');
          await page.waitForTimeout(BETWEEN_MS);
          continue;
        }

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
        delete comic.noScans;
        // Save immediately: a crash should cost one book, not the batch.
        await save(file, data);

        fetched += 1;
        console.log(Object.keys(saved).join(' + '));
      } catch (err) {
        if (/browser has been closed|Target page|context or browser/i.test(err.message)) {
          console.log('ABORTED (browser closed)');
          stoppedEarly = true;
          break;
        }
        if (/crash/i.test(err.message)) {
          try {
            await revivePage();
          } catch {
            console.log('browser crashed and would not restart');
            stoppedEarly = true;
            break;
          }
          if (!crashRetried.has(comic.cert)) {
            crashRetried.add(comic.cert);
            queue.unshift(item);
            done -= 1;
            console.log('browser crashed - restarted, retrying');
            continue;
          }
          console.log('browser crashed twice - skipping');
          continue;
        }
        console.log(`failed: ${err.message.slice(0, 60)}`);
      }
      await page.waitForTimeout(BETWEEN_MS).catch(() => {});
    }
  } finally {
    await context.close().catch(() => {});
  }

  console.log(`\nFetched scans for ${fetched} comic(s).`);
  if (permanent) console.log(`${permanent} confirmed to have no scans at CGC — won't be retried.`);
  const remaining = work.length - fetched - permanent;
  if (remaining > 0 && stoppedEarly) console.warn(`${remaining} not reached — re-run to continue.`);
  return { fetched, permanent, remaining };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refetchImages({ retryKnownMissing: process.argv.includes('--retry-all') }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
