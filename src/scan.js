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

import { displayTitle, gradeLabel, isReflectiveCover } from './model.js';
import { cropToSlab } from './crop.js';
import { startPreview } from './preview.js';
import {
  speakAsync, startListener, interpretVoice, bookAnnouncement, VOICE_WORDS,
} from './speech.js';

const BIN_DIR = path.join('data', 'bins');
const IMAGE_DIR = path.join('data', 'images');
const TEMP_DIR = path.join('.cache', 'scans');
const PS_SCRIPT = path.join('scripts', 'wia-scan.ps1');
const DPI = 300;
const MAX_EDGE = 1400;
// Foil and metal covers return almost no diffuse light. These lift what little
// there is; the exact figure is empirical and is meant to be tuned with --shiny.
const SHINY_BRIGHTNESS = 70;
const SHINY_CONTRAST = 20;
const SHINY_QUALITY = 90;

function runScan(outPath, { brightness = 0, contrast = 0, quality = 0 } = {}) {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_SCRIPT, '-Out', outPath, '-Dpi', String(DPI),
        '-Brightness', String(brightness), '-Contrast', String(contrast), '-Quality', String(quality)],
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

/**
 * Whether a book is part of this run.
 *
 * Exported because it was wrong once and nothing noticed: a targeted run
 * silently scanned the whole backlog instead of the books named. Syntax
 * checks and the unit tests both passed, because neither reached this.
 */
export function shouldScan(comic, wanted) {
  if (wanted?.size) return wanted.has(String(comic?.cert));
  return !comic?.images?.front;
}

/**
 * The books to scan.
 *
 * Normally those with no front cover. Naming certs overrides that and takes
 * them whether or not they already have one - which is how a cover that came
 * out badly gets another attempt, since by definition it is not missing.
 */
async function loadWork({ only = [] } = {}) {
  const wanted = new Set(only.map(String));
  if (!existsSync(BIN_DIR)) return [];
  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  const work = [];
  for (const f of files) {
    const file = path.join(BIN_DIR, f);
    const data = JSON.parse(await readFile(file, 'utf8'));
    for (const comic of data.comics ?? []) {
      if (shouldScan(comic, wanted)) work.push({ file, data, comic, bin: data.bin });
    }
  }
  return work;
}

/**
 * Ask for the next action, by keyboard or by ear.
 *
 * Both paths answer in the same words - scan, redo, skip, skipBook, quit - so
 * the scanning loop never needs to know which one is driving it.
 *
 * The voice path does not speak and then listen. The microphone has been open
 * since the session began, and `since` marks the moment this side started, so
 * a word said over the top of the announcement counts. Waiting for the sentence
 * to finish is what made this feel slow - and the sentence is the long part.
 */
async function requestAction({ rl, side, voice, listener, since }) {
  if (!voice) {
    const answer = (await rl.question(`  ${side.toUpperCase()} - Enter to scan: `))
      .trim()
      .toLowerCase();
    if (answer === 'q') return 'quit';
    if (answer === 'n') return 'skipBook';
    if (answer === 's') return 'skip';
    return 'scan';
  }

  process.stdout.write(`  ${side.toUpperCase()} - listening... `);

  // Silence is not an answer, and neither is a doubtful hearing, so keep
  // waiting rather than guessing. There is deliberately no timeout: the person
  // is across the room, and quietly giving up on them is worse than waiting.
  for (;;) {
    const heard = await listener.next(since);
    const action = interpretVoice(heard);
    if (action) {
      console.log(`heard "${heard.text}"`);
      return action;
    }
  }
}

export async function guidedScan({
  voice = false, timed = 0, shiny = SHINY_BRIGHTNESS, only = [], forceBright = false,
  preview = false,
} = {}) {
  const work = await loadWork({ only });
  if (!work.length) {
    console.log(only.length
      ? `No book found for: ${only.join(', ')}`
      : 'Every comic already has a cover image.');
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
  // A rescan is always a comparison, so a targeted run previews by default.
  const wantPreview = preview || voice || only.length > 0;
  const view = wantPreview ? await startPreview() : null;
  if (view) console.log(`Preview: ${view.url}`);
  else if (wantPreview) console.log('Could not open the preview; carrying on.');

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

      // The mark goes down before a word of the announcement is spoken, so
      // saying "next" over the top of it counts. Anything heard earlier - while
      // the previous scan was running - is stale and deliberately ignored.
      let since = Date.now();

      // Reflective covers are flagged but not switched automatically. Bright
      // mode recovered the art on two of the three foil covers tried and did
      // nothing for the third, a mirror-finish metal cover - worth offering,
      // not worth deciding for you. Say "shiny", or pass --bright.
      let bright = forceBright;
      if (isReflectiveCover(comic)) {
        console.log('        reflective cover - say "shiny" if it scans black');
      }

      const opener = bright
        ? `${bookAnnouncement(comic, { bin })} Bright mode.`
        : bookAnnouncement(comic, { bin });
      let saying = voice ? speakAsync(opener) : null;

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
          saying?.cancel();
          saying = speakAsync(`Turn it over. Scanning in ${timed} seconds.`);
          console.log(`  BACK - scanning in ${timed}s...`);
          await new Promise((resolve) => setTimeout(resolve, timed * 1000));
          action = 'scan';
        } else {
          if (voice && side === 'back' && !timed) {
            saying?.cancel();
            saying = speakAsync('Turn it over.');
          }
          action = await requestAction({ rl, side, voice, listener, since });
          saying?.cancel();
        }

        if (action === 'shiny') {
          // A toggle, not a switch. Bright mode guessed wrong blows out an
          // ordinary cover, and saying the same word again is the fastest way
          // back - the alternative is walking to the keyboard, which is the
          // thing this whole mode exists to avoid.
          bright = !bright;
          console.log(`    bright mode ${bright ? 'on' : 'off'} for this book`);
          saying?.cancel();
          saying = speakAsync(bright ? 'Bright mode.' : 'Normal mode.');
          since = Date.now();
          continue;
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
        const result = await runScan(path.resolve(temp), bright
          ? { brightness: shiny, contrast: SHINY_CONTRAST, quality: SHINY_QUALITY }
          : {});

        if (!result.ok) {
          if (result.code === 2) {
            console.log('no scanner found');
            console.log('    Is the SV600 connected and powered on?');
            if (voice) speakAsync('No scanner found. Stopping.');
            quit = true;
            break;
          }
          console.log(`failed - ${result.err.slice(0, 90)}`);
          if (voice) { saying?.cancel(); saying = speakAsync('That scan failed.'); }
          since = Date.now();
          continue; // stay on this side
        }

        const name = `${comic.cert}_${side === 'front' ? 'OBV' : 'REV'}.jpg`;
        const dest = path.join(IMAGE_DIR, name);

        // Read the outgoing cover before overwriting it: the comparison is the
        // whole point of a rescan, and a moment later it is gone.
        const before = view && existsSync(dest)
          ? await readFile(dest).catch(() => null)
          : null;

        const image = await tidy(temp);
        await writeFile(dest, image);
        await rm(temp, { force: true });

        await view?.show(image, {
          title: displayTitle(comic),
          cert: comic.cert,
          side,
          bin,
          mode: bright ? 'bright' : 'normal',
          before,
        });

        comic.images = { ...(comic.images ?? {}), [side]: name };
        comic.imageSource = 'owner';
        if (bright) comic.scanMode = 'bright';
        else delete comic.scanMode;
        delete comic.noScans;
        // Save per side: stopping halfway keeps everything already done.
        await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

        scanned += 1;
        since = Date.now();
        console.log(`saved ${name}`);
        sideIndex += 1;
      }
      if (skipBook && voice) { saying?.cancel(); speakAsync('Skipping.'); }
      saying?.cancel();
      if (quit) break;
    }
  } finally {
    rl.close();
    listener?.stop();
    view?.stop();
  }

  console.log(`\nScanned ${scanned} image(s).`);
  const left = only.length ? 0 : (await loadWork()).length;
  if (left) console.log(`${left} book(s) still without a front cover — re-run to continue.`);
  if (scanned) console.log('\nNext: npm run build && npm run print');
  return { scanned, remaining: left };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const timedAt = argv.indexOf('--timed');
  const shinyAt = argv.indexOf('--shiny');
  // npm treats --only as one of its own config flags and eats it before the
  // script ever sees it, exactly as it does --bin. --redo is not an npm config,
  // so it survives `npm run scan -- --redo ...`; --only still works when the
  // script is invoked through node directly.
  const onlyAt = Math.max(argv.indexOf('--redo'), argv.indexOf('--only'));
  const forceBright = argv.includes('--bright');
  guidedScan({
    voice: argv.includes('--voice'),
    timed: timedAt >= 0 ? Number(argv[timedAt + 1]) || 8 : 0,
    shiny: shinyAt >= 0 ? Number(argv[shinyAt + 1]) || SHINY_BRIGHTNESS : SHINY_BRIGHTNESS,
    only: onlyAt >= 0 ? String(argv[onlyAt + 1] ?? '').split(',').filter(Boolean) : [],
    forceBright,
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
