/**
 * Write ready-to-print files into `print/`, committed to the repo.
 *
 * `dist/` is build output — gitignored and wiped on every build — so it is the
 * wrong place to keep something you actually want to open and print. This writes
 * a PDF per bin instead, which also sidesteps the main way printing goes wrong:
 * a browser silently scaling an HTML page to "fit". A PDF carries its own page
 * size, so 4x6 comes out 4x6.
 *
 * The HTML is written alongside for anyone who wants to tweak and re-print.
 *
 *   npm run print
 */

import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';

import { binUrl } from './model.js';
import { renderLabel } from './templates/label.js';
import { renderSheet } from './templates/sheet.js';
import { ensureThumbs } from './thumbs.js';

const PRINT_DIR = 'print';
const BIN_DIR = path.join('data', 'bins');
const THUMB_ABS = path.resolve('data', 'thumbs');

async function loadConfig() {
  return JSON.parse(await readFile(path.join('data', 'config.json'), 'utf8'));
}

async function loadBins() {
  if (!existsSync(BIN_DIR)) return [];
  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(BIN_DIR, f), 'utf8'))),
  );
}

export async function makePrintables() {
  const config = await loadConfig();
  const bins = await loadBins();
  if (!bins.length) {
    console.log('No bins to print.');
    return { files: [] };
  }

  await mkdir(PRINT_DIR, { recursive: true });
  await ensureThumbs({ quiet: true });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const written = [];
  const locked = [];

  try {
    for (const bin of bins) {
      const count = (bin.comics ?? []).length;
      if (!count) continue;

      const url = binUrl(config.baseUrl, bin.bin);
      const qrSvg = await QRCode.toString(url, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      });

      // The committed HTML sits in print/, so images resolve one level up.
      const docs = [
        {
          name: `bin-${bin.bin}-label`,
          html: renderLabel({ bin, qrSvg, url, config }),
        },
        {
          name: `bin-${bin.bin}-sheet`,
          // 120px thumbnails, not the full scans: at 0.40in wide that is exactly
          // 300dpi, and it takes the sheet PDF from 8MB to a few hundred KB.
          html: renderSheet({ bin, url, qrSvg, imagePrefix: '../data/thumbs/' }),
        },
      ];

      for (const doc of docs) {
        const htmlPath = path.join(PRINT_DIR, `${doc.name}.html`);
        const pdfPath = path.join(PRINT_DIR, `${doc.name}.pdf`);
        await writeFile(htmlPath, doc.html, 'utf8');

        // Render the PDF from a copy that points at absolute image paths, so the
        // committed HTML keeps working relative paths either way.
        const absolute = doc.html.replaceAll(
          '../data/thumbs/',
          `${pathToFileURL(THUMB_ABS).href}/`,
        );
        const tmp = path.join(PRINT_DIR, `.${doc.name}.tmp.html`);
        await writeFile(tmp, absolute, 'utf8');

        await page.goto(pathToFileURL(path.resolve(tmp)).href);
        await page.waitForLoadState('networkidle');

        try {
          await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
          written.push(pdfPath);
          console.log(`  ${pdfPath}`);
          console.log(`  ${htmlPath}`);
        } catch (err) {
          // On Windows an open PDF viewer holds a lock on the file.
          if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {
            locked.push(pdfPath);
            console.warn(`  ! ${pdfPath} is open in another program — close it and re-run`);
          } else {
            throw err;
          }
        }

        const { rm } = await import('node:fs/promises');
        await rm(tmp, { force: true });
      }
      console.log(`bin ${bin.bin}: ${count} comics\n`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${written.length} PDF(s) to ${PRINT_DIR}/`);
  if (locked.length) {
    console.warn(
      `\n${locked.length} file(s) could not be written because they are open:\n` +
        locked.map((f) => `  ${f}`).join('\n') +
        '\nClose them and run `npm run print` again.',
    );
  }
  return { files: written, locked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  makePrintables()
    .then((r) => process.exit(r.locked?.length ? 1 : 0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
