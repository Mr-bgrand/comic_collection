/**
 * Sign in to CGC in the automation browser profile.
 *
 * Anonymous cert lookup renders no cover scans for some books — the page loads
 * completely, the census is there, and the <img> elements simply do not exist.
 * The same certs may show covers to a signed-in submitter, so this opens the
 * shared profile at CGC and lets you sign in by hand, once.
 *
 * Your password is never asked for, typed by this script, or stored anywhere.
 * The session lives in the browser profile at .cache/chrome-profile, which is
 * the same profile holding the Cloudflare clearance for cert lookup — so once
 * you are signed in, `npm run images` picks the session up automatically.
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROFILE_DIR = path.join('.cache', 'chrome-profile');
const SIGNIN_URL = 'https://www.cgccomics.com/login/';

async function launch() {
  const { chromium } = await import('playwright');
  await mkdir(PROFILE_DIR, { recursive: true });
  const options = {
    headless: false,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
  };
  // Real Chrome first. Cloudflare reliably flags the bundled Chromium, so the
  // fallbacks rarely get through — they exist only so this is not a hard stop.
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel });
    } catch {
      /* try next */
    }
  }
  return chromium.launchPersistentContext(PROFILE_DIR, options);
}

export async function cgcLogin() {
  console.log('Opening CGC in the automation browser profile.');
  console.log('Sign in, then close the browser window when you are done.\n');

  const context = await launch();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(SIGNIN_URL).catch(() => {});

  // Closing the window by hand is the "I'm finished" signal.
  await new Promise((resolve) => context.on('close', resolve));
  console.log('Session saved to the profile. Now run: npm run images -- --retry-all');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cgcLogin().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
