/**
 * GoCollect fair market values.
 *
 * Unlike CGC data, FMV is not a look-up-once fact. A grade is fixed for the life
 * of the slab; a market value moves. So every price carries `fetchedAt`, the
 * dashboard prints an "as of" date, and this is safe to re-run whenever you want
 * fresh numbers.
 *
 * GoCollect needs a login, and this never asks for your password. Instead:
 *
 *   npm run login   opens the automation Chrome profile at GoCollect so you can
 *                   sign in by hand, once. The session persists in the profile.
 *   npm run fmv     reuses that session to price every book.
 *
 * That is the same profile holding the Cloudflare clearance cookie for CGC.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DASHBOARD_URL = 'https://gocollect.com/app/dashboard';
const PROFILE_DIR = path.join('.cache', 'chrome-profile');
const BIN_DIR = path.join('data', 'bins');
const BETWEEN_LOOKUPS_MS = 3_000;

/** "$1,234" -> 1234. "--", "" and anything unparseable -> null. */
export function parseMoney(text) {
  if (typeof text !== 'string') return null;
  const m = text.replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** "(1 Sold)" -> 1. Absent or unparseable -> null. */
export function parseSold(text) {
  if (typeof text !== 'string') return null;
  const m = text.replace(/,/g, '').match(/(\d+)\s*sold/i);
  return m ? Number(m[1]) : null;
}

/**
 * Build an FMV record from the values scraped off the result card.
 * Pure, so the shape is testable without a login.
 */
export function buildFmv(raw, now) {
  const value = parseMoney(raw.fmvText ?? '');
  if (value === null) return null;
  return {
    value,
    currency: 'USD',
    avg30: parseMoney(raw.avg30 ?? ''),
    avg90: parseMoney(raw.avg90 ?? ''),
    avg365: parseMoney(raw.avg365 ?? ''),
    sold365: parseSold(raw.sold365 ?? ''),
    url: raw.url || null,
    fetchedAt: now,
  };
}

/** Extraction that runs in the page. Text-anchored, since class names churn. */
function extractFmvInPage() {
  const text = document.body.innerText;

  const after = (label, window = 60) => {
    const i = text.indexOf(label);
    return i < 0 ? '' : text.slice(i + label.length, i + label.length + window);
  };

  // The comic's own page — this is the "Complete Census & Value" destination.
  const link = [...document.querySelectorAll('a')]
    .map((a) => a.href)
    .find((h) => /\/app\/comic\//.test(h));

  // Averages appear as a labelled row: 30 Day Avg | 90 Day Avg | 365 Day Avg
  const block = after('GoCollect FMV', 400);

  return {
    fmvText: block,
    avg30: after('30 Day Avg', 40),
    avg90: after('90 Day Avg', 40),
    avg365: after('365 Day Avg', 40),
    sold365: after('365 Day Avg', 80),
    url: link ?? '',
    signedOut: /sign in|log in to continue/i.test(text) && !/GoCollect FMV/.test(text),
  };
}

async function launchProfile({ headless }) {
  const { chromium } = await import('playwright');
  await mkdir(PROFILE_DIR, { recursive: true });
  const options = {
    headless,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
  };
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel });
    } catch {
      /* try next */
    }
  }
  return chromium.launchPersistentContext(PROFILE_DIR, options);
}

/** Open the automation profile at GoCollect so the user can sign in by hand. */
export async function login() {
  console.log('Opening GoCollect in the automation browser profile.');
  console.log('Sign in, then close the browser window when the dashboard loads.\n');

  const context = await launchProfile({ headless: false });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(DASHBOARD_URL);

  // Wait for the window to be closed by hand — that is the "I'm done" signal.
  await new Promise((resolve) => context.on('close', resolve));
  console.log('Session saved to the profile. Now run: npm run fmv');
}

async function lookupOne(page, cert) {
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

  const certLookup = page.getByRole('link', { name: /cert lookup/i }).first();
  await certLookup.click({ timeout: 20_000 });

  const input = page.getByPlaceholder(/cert/i).first();
  await input.fill(String(cert), { timeout: 20_000 });
  await page.getByRole('button', { name: /^\s*lookup\s*$/i }).first().click();

  await page.waitForFunction(
    (c) => document.body.innerText.includes(`#${c}`) ||
      /GoCollect FMV/.test(document.body.innerText),
    String(cert),
    { timeout: 30_000 },
  );
  await page.waitForTimeout(800); // let the value card settle

  const raw = await page.evaluate(extractFmvInPage);
  if (raw.signedOut) throw new Error('not signed in — run `npm run login` first');
  return buildFmv(raw, new Date().toISOString());
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

export async function fetchAllFmv({ force = false } = {}) {
  const bins = await loadBins();
  if (!bins.length) {
    console.log('No bins found.');
    return { priced: 0, failed: [] };
  }

  const context = await launchProfile({ headless: false });
  const page = context.pages()[0] ?? (await context.newPage());
  const failed = [];
  let priced = 0;

  try {
    for (const { file, data } of bins) {
      const todo = (data.comics ?? []).filter((c) => force || !c.fmv);
      if (!todo.length) {
        console.log(`bin ${data.bin}: already priced (use --force to refresh)`);
        continue;
      }

      for (const [i, comic] of todo.entries()) {
        process.stdout.write(`[${i + 1}/${todo.length}] ${comic.cert} ... `);
        try {
          const fmv = await lookupOne(page, comic.cert);
          if (fmv) {
            comic.fmv = fmv;
            priced += 1;
            console.log(`$${fmv.value}${fmv.url ? '' : '  (no comic link found)'}`);
          } else {
            console.log('no FMV listed');
            failed.push(comic.cert);
          }
        } catch (err) {
          console.log('FAILED');
          console.warn(`  ! ${err.message}`);
          failed.push(comic.cert);
          if (/not signed in/.test(err.message)) throw err;
        }
        if (i < todo.length - 1) await page.waitForTimeout(BETWEEN_LOOKUPS_MS);
      }

      data.updated = new Date().toISOString().slice(0, 10);
      await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      console.log(`  wrote ${file}`);
    }
  } finally {
    await context.close();
  }

  console.log(`\nPriced ${priced} book(s).`);
  if (failed.length) console.warn(`No value for: ${failed.join(', ')}`);
  return { priced, failed };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--login')) return login();
  return fetchAllFmv({ force: argv.includes('--force') });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
