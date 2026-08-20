/**
 * Guided scanning for books CGC never photographed.
 *
 *   npm run scan
 *
 * Walks the books that have no cover image, one at a time, and drives the
 * scanner directly. The filename is derived from the cert being scanned, which
 * is the whole point: the failure mode of scanning 21 near-identical Spider-Man
 * variants by hand is mislabelling, and a mislabelled cover is very hard to
 * notice later.
 *
 * Nothing is written to the collection until a scan actually succeeds, and each
 * book is saved as it completes, so stopping halfway keeps what you did.
 *
 * The scanner is reached through WIA (scripts/wia-scan.ps1). Any WIA scanner
 * works; the SV600 is simply what this was built against.
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { displayTitle, gradeLabel } from './model.js';
import { cropToSlab } from './crop.js';

const BIN_DIR = path.join('data', 'bins');
const IMAGE_DIR = path.join('data', 'images');
const TEMP_DIR = path.join('.cache', 'scans');
const PS_SCRIPT = path.join('scripts', 'wia-scan.ps1');
const DPI = 300;
const MAX_EDGE = 1400;

function runScan(outPath) {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_SCRIPT, '-Out', outPath, '-Dpi', String(DPI)],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let err = '';
    ps.stderr.on('data', (d) => { err += d.toString(); });
    ps.on('close', (code) => resolve({ ok: code === 0, code, err: err.trim() }));
  });
}

/**
 * Crop the scanner mat away and downscale.
 *
 * A full A3 bed at 300dpi is mostly empty mat around one slab; a real scan came
 * back with roughly a third of the frame black. See crop.js for why brightness
 * rather than sharp's `trim` does this job.
 */
async function tidy(inputPath) {
  const { buffer } = await cropToSlab(inputPath, { maxEdge: MAX_EDGE });
  return buffer;
}

async function loadWork() {
  if (!existsSync(BIN_DIR)) return [];
  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  const work = [];
  for (const f of files) {
    const file = path.join(BIN_DIR, f);
    const data = JSON.parse(await readFile(file, 'utf8'));
    for (const comic of data.comics ?? []) {
      if (!comic.images?.front) work.push({ file, data, comic, bin: data.bin });
    }
  }
  return work;
}

export async function guidedScan() {
  const work = await loadWork();
  if (!work.length) {
    console.log('Every comic already has a cover image.');
    return { scanned: 0 };
  }

  if (!existsSync(PS_SCRIPT)) {
    console.error(`Missing ${PS_SCRIPT}`);
    return { scanned: 0 };
  }

  await mkdir(IMAGE_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  console.log(`${work.length} book(s) need cover images.\n`);
  console.log('For each: place the slab on the scanner, then press Enter.');
  console.log('  Enter = scan     s = skip this side     n = skip this book     q = quit\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let scanned = 0;

  try {
    for (const [i, { file, data, comic, bin }] of work.entries()) {
      console.log(`\n[${i + 1}/${work.length}] bin ${bin} · ${displayTitle(comic)}`);
      console.log(`        cert ${comic.cert} · ${gradeLabel(comic)}`);

      let quit = false;
      for (const side of ['front', 'back']) {
        const answer = (await rl.question(`  ${side.toUpperCase()} — Enter to scan: `))
          .trim()
          .toLowerCase();
        if (answer === 'q') { quit = true; break; }
        if (answer === 'n') break;
        if (answer === 's') continue;

        const temp = path.join(TEMP_DIR, `${comic.cert}_${side}.jpg`);
        process.stdout.write('    scanning... ');
        const result = await runScan(path.resolve(temp));

        if (!result.ok) {
          if (result.code === 2) {
            console.log('no scanner found');
            console.log('    Is the SV600 connected and powered on?');
            quit = true;
            break;
          }
          console.log(`failed — ${result.err.slice(0, 90)}`);
          continue;
        }

        const name = `${comic.cert}_${side === 'front' ? 'OBV' : 'REV'}.jpg`;
        await writeFile(path.join(IMAGE_DIR, name), await tidy(temp));
        await rm(temp, { force: true });

        comic.images = { ...(comic.images ?? {}), [side]: name };
        comic.imageSource = 'owner';
        delete comic.noScans;
        // Save per side: stopping halfway keeps everything already done.
        await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

        scanned += 1;
        console.log(`saved ${name}`);
      }
      if (quit) break;
    }
  } finally {
    rl.close();
  }

  console.log(`\nScanned ${scanned} image(s).`);
  const left = (await loadWork()).length;
  if (left) console.log(`${left} book(s) still without a front cover — re-run to continue.`);
  if (scanned) console.log('\nNext: npm run build && npm run print');
  return { scanned, remaining: left };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  guidedScan().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
