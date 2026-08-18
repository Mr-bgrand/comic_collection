/**
 * Print verification (design doc §10).
 *
 * The layout claims in the design are load-bearing and easy to break by editing
 * CSS: 25 comics on one 4x6in page, 25 comics on two letter pages. This renders a
 * deliberately worst-case bin — long variant strings, long titles — to real PDFs
 * and asserts the page sizes and page counts.
 *
 * Needs a browser: `npx playwright install chromium`. Not run in CI.
 *
 *   npm run verify:print
 */

import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';

import { binUrl } from './model.js';
import { renderLabel } from './templates/label.js';
import { renderSheet, PER_SIDE } from './templates/sheet.js';

async function loadRealBins() {
  const dir = path.resolve('data', 'bins');
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))),
  );
}

const OUT_DIR = path.resolve('dist', 'verify');
const IMAGE_DIR = path.resolve('data', 'medium');

/** Long, awkward records — if these fit, real ones will. */
const SAMPLES = [
  ['Venom', 23, 'Black Saber Comics "Virgin" Edition', '9.8', 0],
  ['Amazing Spider-Man', 300, 'Todd McFarlane Cover / 1st Full Venom', '9.6', 41],
  ['Batman', 423, 'Todd McFarlane Cover', '9.4', 812],
  ['Spawn', 301, 'Diamond Retailer Summit Exclusive Foil Variant Cover Edition', '9.8', 0],
  ['X-Men', 1, 'Jim Lee Gatefold Cover Special Collector Edition', '9.2', 1904],
  ['Incredible Hulk', 181, 'Marvel Value Stamp Intact', '7.5', 3211],
  ['Saga', 1, 'Fiona Staples Cover', '9.8', 12],
  ['Walking Dead', 1, 'Tony Moore Cover First Printing', '9.6', 88],
  ['Ultimate Fallout', 4, 'Djurdjevic Variant 1:25 Retailer Incentive', '9.8', 3],
  ['Daredevil', 181, 'Frank Miller Death of Elektra', '9.0', 640],
];

function worstCaseBin(size = 25) {
  const comics = Array.from({ length: size }, (_, i) => {
    const [title, issue, variant, grade, higher] = SAMPLES[i % SAMPLES.length];
    return {
      cert: String(4395549000 + i),
      title,
      issue: String(issue + Math.floor(i / SAMPLES.length)),
      issueDate: '9/23',
      issueYear: '2023',
      publisher: i % 2 ? 'Marvel Comics' : 'Image Comics',
      variant,
      grade,
      pageQuality: 'WHITE',
      gradeDate: '2024-03-26',
      labelCategory: 'Universal',
      artComments:
        'Torunn Grønbekk story\nKen Lashley & Ramón F. Bachs art\nIvan Tao cover',
      keyComments: 'First appearance',
      population: { atGrade: 83, higher, topPop: higher === 0 },
      images: { front: '4395549004_OBV.jpg', back: '4395549004_REV.jpg' },
    };
  });
  return {
    bin: '99',
    title: 'Bin 99',
    location: 'Print verification',
    updated: '2026-08-16',
    comics,
  };
}

/** Read page size and page count straight out of the generated PDF. */
async function inspectPdf(file) {
  const text = (await readFile(file)).toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  return {
    pages,
    widthIn: box ? Number((box[1] / 72).toFixed(2)) : null,
    heightIn: box ? Number((box[2] / 72).toFixed(2)) : null,
  };
}

export async function verifyPrint({ size = 25 } = {}) {
  const { chromium } = await import('playwright');

  const bin = worstCaseBin(size);
  const config = { baseUrl: 'https://example.invalid/comic_collection', binCapacity: 25 };
  const url = binUrl(config.baseUrl, bin.bin);
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
  });

  await mkdir(OUT_DIR, { recursive: true });
  const labelHtml = path.join(OUT_DIR, 'label.html');
  const sheetHtml = path.join(OUT_DIR, 'sheet.html');
  await writeFile(labelHtml, renderLabel({ bin, qrSvg, url, config }), 'utf8');
  await writeFile(
    sheetHtml,
    renderSheet({ bin, url, qrSvg, imagePrefix: `${pathToFileURL(IMAGE_DIR).href}/` }),
    'utf8',
  );

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];

  try {
    // How much of the label is actually used, and did any title get clipped?
    await page.goto(pathToFileURL(labelHtml).href);
    // Measure the body, not documentElement — documentElement.scrollHeight
    // reports the viewport height and silently hid the real overflow.
    await page.emulateMedia({ media: 'print' });
    const fit = await page.evaluate(() => ({
      rows: document.querySelectorAll('li').length,
      clipped: [...document.querySelectorAll('.t')].filter(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ).length,
      contentIn: Number((document.body.scrollHeight / 96).toFixed(3)),
    }));
    console.log(
      `label: ${fit.rows} rows, content ${fit.contentIn}in of 5.64in usable, ` +
        `${fit.clipped} title(s) ellipsised`,
    );
    if (fit.contentIn > 5.64) {
      failures.push(`label content ${fit.contentIn}in exceeds 5.64in usable`);
    }
    if (fit.rows !== size) failures.push(`label rendered ${fit.rows} rows, expected ${size}`);

    const checks = [
      { html: labelHtml, pdf: 'label.pdf', w: 4, h: 6, pages: 1, name: 'worst-case 4x6 label' },
      { html: sheetHtml, pdf: 'sheet.pdf', w: 8.5, h: 11, pages: 2, name: 'worst-case letter sheet' },
    ];

    // Also check the bins that actually exist — a synthetic worst case is a
    // guarantee, but the real data is what gets printed.
    for (const real of await loadRealBins()) {
      const n = (real.comics ?? []).length;
      if (!n) continue;
      const realUrl = binUrl(config.baseUrl, real.bin);
      const realQr = await QRCode.toString(realUrl, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      });
      const lHtml = path.join(OUT_DIR, `bin-${real.bin}-label.html`);
      const sHtml = path.join(OUT_DIR, `bin-${real.bin}-sheet.html`);
      await writeFile(lHtml, renderLabel({ bin: real, qrSvg: realQr, url: realUrl, config }), 'utf8');
      await writeFile(
        sHtml,
        renderSheet({
          bin: real,
          url: realUrl,
          qrSvg: realQr,
          imagePrefix: `${pathToFileURL(IMAGE_DIR).href}/`,
        }),
        'utf8',
      );
      checks.push(
        { html: lHtml, pdf: `bin-${real.bin}-label.pdf`, w: 4, h: 6, pages: 1, name: `bin ${real.bin} label (${n} comics)` },
        {
          html: sHtml,
          pdf: `bin-${real.bin}-sheet.pdf`,
          w: 8.5,
          h: 11,
          pages: Math.ceil(n / PER_SIDE),
          name: `bin ${real.bin} sheet (${n} comics)`,
        },
      );
    }

    for (const check of checks) {
      await page.goto(pathToFileURL(check.html).href);
      await page.waitForLoadState('networkidle');
      const pdfPath = path.join(OUT_DIR, check.pdf);
      await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });

      const got = await inspectPdf(pdfPath);
      const sizeOk =
        Math.abs(got.widthIn - check.w) < 0.02 && Math.abs(got.heightIn - check.h) < 0.02;
      const pagesOk = got.pages === check.pages;

      console.log(
        `${check.name}: ${got.widthIn}x${got.heightIn}in, ${got.pages} page(s) ` +
          `${sizeOk && pagesOk ? 'OK' : 'FAIL'}`,
      );
      if (!sizeOk) {
        failures.push(
          `${check.name} is ${got.widthIn}x${got.heightIn}in, expected ${check.w}x${check.h}in`,
        );
      }
      if (!pagesOk) {
        failures.push(
          `${check.name} is ${got.pages} page(s), expected ${check.pages}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error('\nPrint verification FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    return { ok: false, failures };
  }
  console.log(`\nPrint verification passed. PDFs in ${OUT_DIR}`);
  return { ok: true, failures: [] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyPrint()
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
