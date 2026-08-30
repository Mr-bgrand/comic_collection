/**
 * Voice for the guided scanner.
 *
 * The scanner sits across the room from the keyboard, so scanning a bin means
 * walking back and forth once per side — fifty trips for a bin of twenty-five.
 * This lets the session be driven by ear and voice instead: it reads out the
 * next book, and listens for a single word to trigger each scan.
 *
 * Both halves are built into Windows and need no install, no account and no
 * network: System.Speech.Synthesis to talk, System.Speech.Recognition to
 * listen, reached through scripts/speech.ps1 the same way the scanner itself is
 * reached through scripts/wia-scan.ps1.
 *
 * Recognition uses a closed four-word grammar rather than open dictation. That
 * is the whole reason it is dependable at a distance — measured at 99%
 * confidence from where the scanner actually stands, where dictation would not
 * come close.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import { gradeLabel } from './model.js';

const PS_SCRIPT = path.join('scripts', 'speech.ps1');

/** The entire vocabulary. Keep it short: every added word costs accuracy. */
/*
 * "back" is deliberately absent: this loop scans a front and a back, so the
 * word is ambiguous the one place it would be spoken. "again" says the same
 * thing with nothing to confuse it with.
 */
export const VOICE_WORDS = ['next', 'again', 'skip', 'stop'];

const ACTIONS = { next: 'scan', again: 'redo', skip: 'skip', stop: 'quit' };

/**
 * How sure the recogniser must be before a word counts.
 *
 * Mishearing "next" costs one wasted scan. Mishearing "stop" ends the session
 * and sends you back across the room, so it has to clear a higher bar.
 */
const FLOOR = 0.6;
const FLOOR_QUIT = 0.8;

/**
 * Make a string fit to be read aloud.
 *
 * Text that looks right on a printed label reads badly out loud: a synthesiser
 * says "hash" for #, reads quotation marks as words, and runs a colon straight
 * through without a pause.
 */
export function speakable(text) {
  if (typeof text !== 'string' || text === '') return '';
  return text
    .replace(/#\s*/g, 'number ')
    .replace(/["“”]/g, '')
    .replace(/\s*:\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What to say before a book is scanned.
 *
 * Enough to identify the slab in your hand without looking at the screen, which
 * matters most for the case this exists for: a run of near-identical variants of
 * the same issue, where only the variant name tells them apart.
 */
export function bookAnnouncement(comic, { bin } = {}) {
  const binPhrase = /^\d+$/.test(String(bin ?? ''))
    ? `Bin ${Number(bin)}` // "08" reads as "bin eight", not "bin oh eight"
    : `The ${bin ?? 'collection'}`;

  const parts = [comic?.title ?? ''];
  // CGC writes "nn" for a book with no issue number; saying it aloud is noise.
  const issue = String(comic?.issue ?? '').trim();
  if (issue && issue.toLowerCase() !== 'nn') parts.push(`#${issue}`);

  let line = parts.join(' ').trim();
  const variant = (comic?.variant ?? '').trim();
  if (variant) line += `, ${variant}`;

  return `${binPhrase}. ${speakable(line)}. ${gradeLabel(comic)}.`;
}

/**
 * Turn something heard into an action, or into nothing.
 *
 * Silence, an unrecognised word and a low-confidence guess are all the same
 * answer: do nothing and wait. Acting on a doubtful hearing is worse than not
 * hearing at all, because the person is across the room and will not see it.
 */
export function interpretVoice(heard, { floor = FLOOR, floorQuit = FLOOR_QUIT } = {}) {
  const word = String(heard?.text ?? '').trim().toLowerCase();
  if (!word) return null;

  const action = ACTIONS[word];
  if (!action) return null;

  const confidence = Number(heard?.confidence ?? 0);
  const needed = action === 'quit' ? floorQuit : floor;
  return confidence >= needed ? action : null;
}

/** Run the PowerShell speech helper and resolve its single output line. */
function runSpeech(args) {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_SCRIPT, ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    ps.stdout.on('data', (d) => { out += d.toString(); });
    ps.on('error', () => resolve(''));
    ps.on('close', () => resolve(out.trim()));
  });
}

/** Say something. Resolves when the sentence has finished being spoken. */
export async function speak(text) {
  if (!text) return;
  await runSpeech(['-Speak', String(text)]);
}

/**
 * Listen for one word.
 * @returns {Promise<{text: string, confidence: number} | null>} null on silence.
 */
export async function listen({ seconds = 20 } = {}) {
  const out = await runSpeech(['-Listen', '-Seconds', String(seconds), '-Words', VOICE_WORDS.join(',')]);
  // The helper prints exactly one line: "HEARD|<word>|<confidence>" or "NONE".
  const line = out.split(/\r?\n/).find((l) => l.startsWith('HEARD|'));
  if (!line) return null;
  const [, text, confidence] = line.split('|');
  return { text, confidence: Number(confidence) };
}

/** True when the machine can actually do this, so the caller can fall back. */
export async function speechAvailable() {
  const out = await runSpeech(['-Check']);
  return out.includes('READY');
}
