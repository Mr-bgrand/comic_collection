/**
 * Scan raw comics, two at a time.
 *
 *   npm run scan:raw -- 15                  keyboard (npm strips --bin; a bare 15 works)
 *   npm run scan:raw -- 15 --voice          hands-free, with the live preview
 *   npm run scan:raw -- 15 --from .cache/raw/raw-15-scan-004.jpg
 *                                           process a kept bed without the scanner
 *
 * Raw books are bagged and boarded - the back is covered - so this scans fronts
 * only, and the SV600's bed is wide enough for two side by side with mat to
 * spare. One press, one bed, two books: each half is cropped, saved and given a
 * stable id (`raw:15-001`) in `data/comics/comic-bin-15.json`, the container the
 * Lab and the print pipeline already treat as a raw comic bin.
 *
 * Nothing here tries to work out what the books are. Many are virgin covers
 * with no text at all, and identifying them is a matching problem for later.
 * What this guarantees is that later has something to work with: a clean crop
 * per book, a kept bed to re-crop from, and an `identification` slot on every
 * record for the answer to land in.
 */

import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runScan } from './scan.js';
import { cropToSlabs } from './crop.js';
import { startPreview } from './preview.js';
import { speakAsync, startListener, interpretVoice } from './speech.js';
import {
  rawRecord, rawImageName, emptyRawBin, nextRawSequence, bedId, lastScanNumber, recordsFromBed,
} from './raw.js';

const COMICS_DIR = path.join('data', 'comics');
const IMAGE_DIR = path.join('data', 'images');
const TEMP_DIR = path.join('.cache', 'scans');
const RAW_DIR = path.join('.cache', 'raw');
const MAX_EDGE = 1400;
// The lamp setting that actually recovered a mirror-finish cover: +32, not the
// +70 first guessed. Light from a second angle matters more than exposure.
const BRIGHT = { brightness: 32, contrast: 20, quality: 90 };

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

export async function loadRawBin(bin) {
  const file = path.join(COMICS_DIR, `comic-bin-${bin}.json`);
  if (!existsSync(file)) return { file, data: emptyRawBin(bin), created: true };
  const data = JSON.parse(await readFile(file, 'utf8'));
  data.comics ??= [];
  return { file, data, created: false };
}

async function saveBin(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Turn one bed image into records: crop each book, save it, keep the bed.
 *
 * When `replace` names a bed already in the bin, the records it produced are
 * removed first and their sequence numbers reused - "again" means the same two
 * books, scanned better, not two more books.
 *
 * Pure with respect to the scanner: give it any bed file. That is what lets a
 * kept bed be re-processed, and what lets the whole path be verified without a
 * scanner attached.
 */
export async function processBed(bedPath, { bin, data, scanNumber, replace = false, view = null }) {
  const { default: sharp } = await import('sharp');
  const bed = bedId(bin, scanNumber);
  const now = new Date().toISOString();

  // Sequence numbers: reuse the ones a replaced bed freed, then continue.
  const freed = [];
  if (replace) {
    for (const old of recordsFromBed(data.comics, bed)) {
      const m = /^raw:\d+-(\d+)$/.exec(old.id);
      if (m) freed.push(Number(m[1]));
      for (const name of Object.values(old.images ?? {})) {
        await rm(path.join(IMAGE_DIR, name), { force: true });
      }
    }
    data.comics = data.comics.filter((c) => c?.imageSources?.front?.bed !== bed);
    freed.sort((a, b) => a - b);
  }
  let next = nextRawSequence(bin, data.comics);
  const takeSequence = () => (freed.length ? freed.shift() : next++);

  const source = await readFile(bedPath);
  const crops = await cropToSlabs(source, { max: 2, maxEdge: MAX_EDGE });
  const found = crops.filter((c) => c.box);
  // No box at all means the whole bed came back as one image. Save nothing:
  // an uncropped bed is not a book, and the kept bed can be re-cropped by hand.
  const books = found.length ? found : [];

  await mkdir(IMAGE_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });
  await copyFile(bedPath, path.join(RAW_DIR, `${bed}.jpg`));

  const records = [];
  const figures = [];
  for (const [i, { buffer }] of books.entries()) {
    const position = books.length === 1 ? 'only' : i === 0 ? 'left' : 'right';
    const sequence = takeSequence();
    const meta = await sharp(buffer).metadata();
    const record = rawRecord({
      bin, sequence, bed, position,
      width: meta.width, height: meta.height, sha256: sha256(buffer), now,
    });
    await writeFile(path.join(IMAGE_DIR, rawImageName(record.id, 'front')), buffer);
    data.comics.push(record);
    records.push(record);
    figures.push({ buffer, label: `${position} · ${record.id}` });
  }

  if (view && figures.length) {
    await view.showMany(figures, { title: `Bin ${bin} · scan ${scanNumber}`, bin });
  }
  return { bed, records, found: books.length, keptAt: path.join(RAW_DIR, `${bed}.jpg`) };
}

/**
 * Ask for the next action, by keyboard or by ear. Same words either way:
 * scan, redo, shiny, quit.
 */
async function requestAction({ rl, voice, listener, since }) {
  if (!voice) {
    const answer = (await rl.question('  Enter = scan   a = again   s = shiny   q = quit : '))
      .trim().toLowerCase();
    if (answer === 'q') return 'quit';
    if (answer === 'a') return 'redo';
    if (answer === 's') return 'shiny';
    return 'scan';
  }
  process.stdout.write('  listening... ');
  for (;;) {
    const heard = await listener.next(since);
    const action = interpretVoice(heard);
    // "skip" has no meaning here; wait for a word that does.
    if (action && action !== 'skip') {
      console.log(`heard "${heard.text}"`);
      return action;
    }
  }
}

export async function scanRaw({ bin, voice = false, preview = false, from = null } = {}) {
  if (!bin) throw new Error('a bin is required: npm run scan:raw -- 15   (or node src/scan-raw.js --bin 15)');
  const { file, data, created } = await loadRawBin(bin);
  if (created) console.log(`Creating ${file}`);
  console.log(`${data.title}: ${data.comics.length} book(s) so far.`);

  // A kept bed, no scanner: process it once and stop.
  if (from) {
    const scanNumber = Number((/scan-(\d+)/.exec(path.basename(from)) ?? [])[1])
      || lastScanNumber(bin, data.comics) + 1;
    const replace = recordsFromBed(data.comics, bedId(bin, scanNumber)).length > 0;
    const r = await processBed(from, { bin, data, scanNumber, replace });
    await saveBin(file, data);
    console.log(`${r.bed}: ${r.found} book(s) -> ${r.records.map((x) => x.id).join(', ') || 'none'}`);
    return { scanned: r.found };
  }

  await mkdir(TEMP_DIR, { recursive: true });

  const wantPreview = preview || voice;
  const view = wantPreview ? await startPreview() : null;
  if (view) console.log(`Preview: ${view.url}`);

  let listener = null;
  if (voice) {
    listener = startListener();
    if (!(await listener.ready())) {
      console.log('No speech recogniser available - falling back to the keyboard.');
      listener.stop();
      listener = null;
      voice = false;
    }
  }

  console.log('\nPlace up to two books side by side, fronts up, with mat between them.');
  if (voice) console.log('  say: next = scan   again = rescan the last bed   shiny = bright mode   stop = quit');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let scanNumber = lastScanNumber(bin, data.comics);
  let bright = false;
  let scanned = 0;
  let lastBed = null;

  try {
    for (;;) {
      const upcoming = scanNumber + 1;
      console.log(`\n[scan ${upcoming}] bin ${bin} · ${data.comics.length} book(s) in bin`);
      let since = Date.now();
      let saying = voice ? speakAsync(`Scan ${upcoming}. Place two books.`) : null;

      const action = await requestAction({ rl, voice, listener, since });
      saying?.cancel();

      if (action === 'quit') break;
      if (action === 'shiny') {
        bright = !bright;
        console.log(`    bright mode ${bright ? 'on' : 'off'}`);
        if (voice) speakAsync(bright ? 'Bright mode.' : 'Normal mode.');
        continue;
      }

      const replace = action === 'redo';
      if (replace && !lastBed) { console.log('    nothing to rescan yet'); continue; }
      const thisScan = replace ? lastBed : upcoming;
      if (replace && voice) speakAsync('Rescanning.');

      const temp = path.join(TEMP_DIR, `raw-${bin}-${thisScan}.jpg`);
      process.stdout.write('    scanning... ');
      const result = await runScan(path.resolve(temp), bright ? BRIGHT : {});
      if (!result.ok) {
        if (result.code === 2) {
          console.log('no scanner found');
          if (voice) speakAsync('No scanner found. Stopping.');
          break;
        }
        console.log(`failed - ${result.err.slice(0, 90)}`);
        if (voice) speakAsync('That scan failed.');
        continue;
      }

      const r = await processBed(temp, { bin, data, scanNumber: thisScan, replace, view });
      await rm(temp, { force: true });
      await saveBin(file, data);

      if (!replace) scanNumber = thisScan;
      lastBed = thisScan;
      scanned += r.found;

      const ids = r.records.map((x) => x.id).join(', ');
      console.log(r.found ? `saved ${r.found}: ${ids}` : 'nothing found on the bed');
      if (voice) {
        speakAsync(r.found === 2 ? 'Two saved.' : r.found === 1 ? 'One saved.' : 'Nothing found on the bed.');
      }
    }
  } finally {
    rl.close();
    listener?.stop();
    view?.stop();
  }

  console.log(`\nSaved ${scanned} book(s). ${data.title} now holds ${data.comics.length}.`);
  if (scanned) console.log('Next: npm run build   (then commit data/images and data/comics)');
  return { scanned };
}

/**
 * Read the command line.
 *
 * npm treats --bin as one of its own config keys and strips it before the
 * script runs, forwarding only the value: `npm run scan:raw -- --bin 15`
 * arrives as `15`, exactly as --only and the original --bin did. So the bin
 * is also accepted as a plain argument, which survives npm; --bin still works
 * when node is invoked directly.
 */
export function parseRawArgs(argv) {
  const takesValue = new Set(['--bin', '--from']);
  const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] ?? null : null; };
  const positional = argv.filter((a, i) => !a.startsWith('--') && !takesValue.has(argv[i - 1]));
  return {
    bin: arg('--bin') ?? positional[0] ?? null,
    voice: argv.includes('--voice'),
    preview: argv.includes('--preview'),
    from: arg('--from'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanRaw(parseRawArgs(process.argv.slice(2))).catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
