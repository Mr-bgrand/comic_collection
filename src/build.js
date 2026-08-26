/**
 * Build every output from the bin JSON: the 4x6 labels, the 8.5x11 manifest
 * sheets, the bin pages the QR codes point at, and the searchable index.
 *
 *   node src/build.js
 */

import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';

import { binUrl, collectSearchIndex, isTopPop } from './model.js';
import { renderLabel } from './templates/label.js';
import { renderSheet } from './templates/sheet.js';
import { renderBinPage } from './templates/binPage.js';
import { renderIndexPage } from './templates/indexPage.js';
import { renderDashboard } from './templates/dashboard.js';
import { renderWallPage } from './templates/wallPage.js';
import { renderWall3dPage } from './templates/wall3dPage.js';
import { ensureThumbs, THUMB_DIR, MEDIUM_DIR, WALL_DIR } from './thumbs.js';

const DATA_DIR = 'data';
const DIST_DIR = 'dist';

async function loadConfig() {
  const file = path.join(DATA_DIR, 'config.json');
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadBins() {
  const dir = path.join(DATA_DIR, 'bins');
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const bins = [];
  for (const file of files) {
    bins.push(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
  }
  return bins.sort((a, b) => String(a.bin).localeCompare(String(b.bin)));
}

/**
 * §5 of the design: text CGC damaged that we could not confidently repair is
 * surfaced at build time, named by cert, rather than quietly printed.
 */
function warnUnresolved(bins) {
  let found = 0;
  for (const bin of bins) {
    for (const comic of bin.comics ?? []) {
      if (comic.unresolved?.length) {
        found += 1;
        console.warn(
          `  ! bin ${bin.bin} cert ${comic.cert}: unrepaired text ${comic.unresolved.join(', ')}`,
        );
      }
    }
  }
  if (found) {
    console.warn(`  ! ${found} record(s) contain characters CGC damaged beyond repair.`);
    console.warn('    Add the correct spelling to KNOWN_NAMES in src/repair.js.');
  }
}

export async function build() {
  const config = await loadConfig();
  const bins = await loadBins();

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  // GitHub Pages runs Jekyll by default, which skips files starting with "_".
  await writeFile(path.join(DIST_DIR, '.nojekyll'), '');

  const imageSrc = path.join(DATA_DIR, 'images');
  if (existsSync(imageSrc)) {
    await cp(imageSrc, path.join(DIST_DIR, 'images'), { recursive: true });
  }

  // Sized derivatives for the table and its hover preview; the bin pages keep
  // using the full scans.
  await ensureThumbs();
  for (const [dir, name] of [[THUMB_DIR, 'thumbs'], [WALL_DIR, 'covers'], [MEDIUM_DIR, 'medium']]) {
    if (existsSync(dir)) await cp(dir, path.join(DIST_DIR, name), { recursive: true });
  }

  for (const bin of bins) {
    const outDir = path.join(DIST_DIR, 'bin', bin.bin);
    await mkdir(outDir, { recursive: true });

    const url = binUrl(config.baseUrl, bin.bin);
    const qrSvg = await QRCode.toString(url, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
    });

    await writeFile(path.join(outDir, 'index.html'), renderBinPage({ bin }), 'utf8');
    await writeFile(
      path.join(outDir, 'label.html'),
      renderLabel({ bin, qrSvg, url, config }),
      'utf8',
    );
    await writeFile(
      path.join(outDir, 'sheet.html'),
      renderSheet({ bin, url, qrSvg }),
      'utf8',
    );

    const count = (bin.comics ?? []).length;
    const over = count > (config.binCapacity ?? Infinity);
    console.log(
      `  bin ${bin.bin}: ${count} comics${over ? '  <- over bin capacity' : ''}`,
    );
  }

  const searchIndex = collectSearchIndex(bins);
  await writeFile(
    path.join(DIST_DIR, 'search.json'),
    JSON.stringify(searchIndex),
    'utf8',
  );

  const totalComics = searchIndex.length;
  const totalTopPops = bins.reduce(
    (n, b) => n + (b.comics ?? []).filter(isTopPop).length,
    0,
  );

  await writeFile(
    path.join(DIST_DIR, 'index.html'),
    renderIndexPage({ bins, config, totalComics, totalTopPops }),
    'utf8',
  );

  await mkdir(path.join(DIST_DIR, 'wall'), { recursive: true });
  await writeFile(
    path.join(DIST_DIR, 'wall', 'index.html'),
    renderWallPage({ bins, config }),
    'utf8',
  );

  // The experimental WebGL sibling of the wall lives one directory deeper.
  await mkdir(path.join(DIST_DIR, 'wall', '3d'), { recursive: true });
  await writeFile(
    path.join(DIST_DIR, 'wall', '3d', 'index.html'),
    renderWall3dPage({ bins, config }),
    'utf8',
  );

  await mkdir(path.join(DIST_DIR, 'dashboard'), { recursive: true });
  await writeFile(
    path.join(DIST_DIR, 'dashboard', 'index.html'),
    renderDashboard({ bins, config }),
    'utf8',
  );

  warnUnresolved(bins);
  console.log(
    `\nBuilt ${bins.length} bin(s), ${totalComics} comics -> ${DIST_DIR}/`,
  );
  return { bins: bins.length, comics: totalComics };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
