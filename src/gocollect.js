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
const LOGIN_URL = 'https://gocollect.com/login';
const CERT_LOOKUP_URL = 'https://gocollect.com/app/comics/cert-lookup';
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
 *
 * A missing price is not a failure, and there are two distinct reasons for one:
 *
 *   priced      GoCollect has sales data and quotes a value.
 *   no-sales    The book is in their database — there is a page to link to —
 *               but nothing has sold, so every average reads "--".
 *   not-listed  The book is not in their database at all; no page exists.
 *
 * The middle case still has a URL worth keeping, which is why a record is
 * returned rather than null.
 */
export function buildFmv(raw, now) {
  const value = parseMoney(raw.fmvText ?? '');
  const url = raw.url || null;
  if (value === null && !url) {
    return { value: null, url: null, status: 'not-listed', fetchedAt: now };
  }

  return {
    value,
    currency: 'USD',
    avg30: parseMoney(raw.avg30 ?? ''),
    avg90: parseMoney(raw.avg90 ?? ''),
    avg365: parseMoney(raw.avg365 ?? ''),
    sold365: parseSold(raw.sold365 ?? ''),
    url,
    status: value === null ? 'no-sales' : 'priced',
    fetchedAt: now,
  };
}

/**
 * The page hands back raw text and the comic link; all parsing happens in Node so
 * it can be tested against a captured card without a browser or a login.
 */
function extractFmvInPage() {
  return {
    text: document.body.innerText,
    url:
      [...document.querySelectorAll('a')]
        .map((a) => a.href)
        .find((h) => /\/app\/comic\//.test(h)) ?? '',
  };
}

/**
 * Parse a GoCollect result card.
 *
 * The card renders each label immediately above its value:
 *
 *   GoCollect FMV / $60 / 30 Day Avg / -- / 90 Day Avg / -- / 365 Day Avg / $60 / (1 Sold)
 *
 * so each value must be read *between* its own label and the next one. Reading a
 * fixed character window instead overshoots the "--" placeholders and picks up
 * the following figure — which reported a 30-day average of $60 for a book with
 * no 30-day sales at all.
 */
export function parseFmvCard(text, url, now) {
  const between = (start, end) => {
    const i = text.indexOf(start);
    if (i < 0) return '';
    const from = i + start.length;
    const j = end ? text.indexOf(end, from) : -1;
    return text.slice(from, j >= 0 ? j : from + 60);
  };

  const tail = between('365 Day Avg', null);

  return buildFmv(
    {
      fmvText: between('GoCollect FMV', '30 Day Avg'),
      avg30: between('30 Day Avg', '90 Day Avg'),
      avg90: between('90 Day Avg', '365 Day Avg'),
      avg365: tail,
      sold365: tail,
      url,
    },
    now,
  );
}

/**
 * Load .env if present. Credentials are entirely optional — the saved browser
 * session is the primary path and needs no password stored anywhere. These exist
 * only so an unattended refresh can re-authenticate when the session lapses.
 */
function loadEnv() {
  if (existsSync('.env')) {
    try {
      process.loadEnvFile('.env');
    } catch {
      /* malformed .env is not worth failing the run over */
    }
  }
  const email = process.env.GOCOLLECT_EMAIL?.trim();
  const password = process.env.GOCOLLECT_PASSWORD?.trim();
  return email && password ? { email, password } : null;
}

/** True when the page is showing a sign-in prompt rather than the app. */
async function isSignedOut(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    return (
      /sign in|log in/i.test(text) &&
      !/GoCollect FMV|Cert Lookup|Dashboard/i.test(text)
    );
  });
}

/**
 * Sign in with stored credentials if the saved session has lapsed. Returns true
 * when a sign-in was performed.
 */
async function signInIfNeeded(page, creds) {
  if (!(await isSignedOut(page))) return false;

  if (!creds) {
    throw new Error(
      'session expired and no credentials in .env — run `npm run login` to sign in by hand',
    );
  }

  console.log('  session lapsed; signing in with stored credentials');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  await page.locator('input[type="email"], input[name="email"]').first()
    .fill(creds.email, { timeout: 20_000 });
  await page.locator('input[type="password"], input[name="password"]').first()
    .fill(creds.password, { timeout: 20_000 });
  await page.getByRole('button', { name: /sign in|log in|submit/i }).first().click();

  await page.waitForURL(/\/app\//, { timeout: 30_000 }).catch(() => {});
  if (await isSignedOut(page)) throw new Error('sign-in failed — check GOCOLLECT_PASSWORD in .env');

  console.log('  signed in');
  return true;
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
  // Straight to the comics cert-lookup page. Clicking "Cert Lookup" in the nav
  // is unreliable — there is one per collectible type and they are not always
  // visible — and the page has its own URL anyway.
  await page.goto(CERT_LOOKUP_URL, { waitUntil: 'domcontentloaded' });

  // Target the cert field by id. The site-wide search box precedes it in the
  // DOM, so a positional selector fills the wrong input and the lookup returns
  // "Provide a Certification Number".
  const input = page.locator('#cert_number_input');
  await input.waitFor({ state: 'visible', timeout: 25_000 });
  await input.fill(String(cert));
  await page.getByRole('button', { name: /^\s*lookup\s*$/i }).first().click();

  // Wait for the cert card, which always renders. Waiting on "GoCollect FMV"
  // instead timed out for every book with no sales — the label is simply absent
  // when there is nothing to quote, which is a real answer, not a failure.
  await page.waitForFunction(
    (c) => document.body.innerText.includes(`CGC Cert #${c}`),
    String(cert),
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2_000); // let the value card settle

  const raw = await page.evaluate(extractFmvInPage);
  if (/sign in|log in to continue/i.test(raw.text) && !/GoCollect FMV/.test(raw.text)) {
    throw new Error('not signed in — run `npm run login` first');
  }
  return parseFmvCard(raw.text, raw.url, new Date().toISOString());
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

  const creds = loadEnv();
  const context = await launchProfile({ headless: false });
  const page = context.pages()[0] ?? (await context.newPage());
  const failed = [];
  let priced = 0;

  try {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await signInIfNeeded(page, creds);

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
          comic.fmv = fmv;
          if (fmv.status === 'priced') {
            priced += 1;
            console.log(`$${fmv.value}`);
          } else if (fmv.status === 'no-sales') {
            console.log('no sales yet (page linked)');
          } else {
            console.log('not in GoCollect');
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
