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
import {
  speak, listen, speechAvailable, interpretVoice, bookAnnouncement, VOICE_WORDS,
} from './speech.js';

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

/**
 * Ask for the next action, by keyboard or by ear.
 *
 * Both paths answer in the same words - scan, redo, skip, skipBook, quit - so
 * the scanning loop never needs to know which one is driving it.
 */
async function requestAction({ rl, side, voice }) {
  if (!voice) {
    const answer = (await rl.question(`  ${side.toUpperCase()} - Enter to scan: `))
      .trim()
      .toLowerCase();
    if (answer === 'q') return 'quit';
    if (answer === 'n') return 'skipBook';
    if (answer === 's') return 'skip';
    return 'scan';
  }

  await speak(side === 'front' ? 'Front. Say next when ready.' : 'Turn it over. Say next.');
  process.stdout.write(`  ${side.toUpperCase()} - listening... `);

  // Silence is not an answer, so keep waiting rather than guessing. The cap
  // exists only so a dead microphone ends the session instead of hanging it.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const action = interpretVoice(await listen({ seconds: 30 }));
    if (action) {
      console.log(`heard "${action}"`);
      return action;
    }
    if (attempt === 2) await speak('Still listening.');
  }
  console.log('no answer');
  return 'quit';
}

export async function guidedScan({ voice = false, timed = 0 } = {}) {
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
  // Voice is opt-in and must prove itself before the session commits to it.
  // Discovering the microphone is unavailable halfway through a bin, from
  // across the room, is the worst possible moment to find out.
  if (voice && !(await speechAvailable())) {
    console.log('No speech recogniser available - falling back to the keyboard.');
    voice = false;
  }

  if (voice) {
    console.log('Voice mode. Each book is read aloud; say a word to act.');
    console.log(`  ${VOICE_WORDS.join('   ')}`);
    console.log('  next = scan this side    again = rescan it    Ctrl+C also quits.');
  } else {
    console.log('For each: place the slab on the scanner, then press Enter.');
    console.log('  Enter = scan     s = skip this side     n = skip this book     q = quit');
  }
  if (timed) console.log(`Timed: the back scans ${timed}s after a good front.`);
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let scanned = 0;

  try {
    for (const [i, { file, data, comic, bin }] of work.entries()) {
      console.log(`\n[${i + 1}/${work.length}] bin ${bin} · ${displayTitle(comic)}`);
      console.log(`        cert ${comic.cert} · ${gradeLabel(comic)}`);
      if (voice) await speak(bookAnnouncement(comic, { bin }));

      const sides = ['front', 'back'];
      let sideIndex = 0;
      let quit = false;
      let skipBook = false;

      while (sideIndex < sides.length) {
        const side = sides[sideIndex];

        // In timed mode the back needs no cue: the front succeeding is the cue,
        // and the countdown is exactly the time it takes to turn the slab over.
        let action;
        if (timed && side === 'back' && comic.images?.front) {
          await speak(`Turn it over. Scanning in ${timed} seconds.`);
          console.log(`  BACK - scanning in ${timed}s...`);
          await new Promise((resolve) => setTimeout(resolve, timed * 1000));
          action = 'scan';
        } else {
          action = await requestAction({ rl, side, voice });
        }

        if (action === 'quit') { quit = true; break; }
        if (action === 'skipBook') { skipBook = true; break; }
        if (action === 'skip') { sideIndex += 1; continue; }
        if (action === 'redo') {
          // "again" means the side just finished came out badly. Step back to
          // it; from the front, it simply means rescan the front.
          sideIndex = Math.max(0, sideIndex - 1);
          continue;
        }

        const temp = path.join(TEMP_DIR, `${comic.cert}_${side}.jpg`);
        process.stdout.write('    scanning... ');
        const result = await runScan(path.resolve(temp));

        if (!result.ok) {
          if (result.code === 2) {
            console.log('no scanner found');
            console.log('    Is the SV600 connected and powered on?');
            if (voice) await speak('No scanner found. Stopping.');
            quit = true;
            break;
          }
          console.log(`failed - ${result.err.slice(0, 90)}`);
          if (voice) await speak('That scan failed. Say next to try again.');
          continue; // stay on this side
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
        sideIndex += 1;
      }
      if (skipBook && voice) await speak('Skipping.');
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
  const argv = process.argv.slice(2);
  const timedAt = argv.indexOf('--timed');
  guidedScan({
    voice: argv.includes('--voice'),
    timed: timedAt >= 0 ? Number(argv[timedAt + 1]) || 8 : 0,
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
