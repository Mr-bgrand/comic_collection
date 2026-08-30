import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  speakable, bookAnnouncement, interpretVoice, VOICE_WORDS,
  createWordQueue, parseHeard, SPOKEN_PROMPTS,
} from './speech.js';

/*
 * The text transform. A synthesiser reads punctuation literally, so the strings
 * that look right on a label read badly out loud: "#1" becomes "hash one" and a
 * quoted variant becomes "quote virgin quote".
 */

test('speakable turns # into the word number', () => {
  assert.equal(speakable('Deadpool #1'), 'Deadpool number 1');
});

test('speakable drops quotes that would be read aloud', () => {
  assert.equal(
    speakable('Black Saber Comics "Virgin" Edition'),
    'Black Saber Comics Virgin Edition',
  );
});

test('speakable turns a colon into a pause', () => {
  assert.equal(speakable('Venom: Lethal Protector II'), 'Venom, Lethal Protector II');
});

test('speakable collapses whitespace left by removals', () => {
  assert.equal(speakable('Ninja   Funk  #1'), 'Ninja Funk number 1');
});

test('speakable leaves ordinary text alone', () => {
  assert.equal(speakable('Amazing Spider-Man'), 'Amazing Spider-Man');
});

test('speakable handles empty and missing input', () => {
  assert.equal(speakable(''), '');
  assert.equal(speakable(undefined), '');
});

/*
 * The announcement. Read between books, while the scanner is across the room,
 * so it has to carry enough to identify the slab in hand without looking at the
 * screen: which bin, which book, which grade.
 */

test('bookAnnouncement names the bin, the book and the grade', () => {
  const said = bookAnnouncement(
    { title: 'Deadpool', issue: '1', grade: '9.8', grader: 'CGC' },
    { bin: '08' },
  );
  assert.match(said, /bin 8/i);
  assert.match(said, /Deadpool number 1/);
  assert.match(said, /9\.8/);
});

test('bookAnnouncement says bin 8, not bin zero eight', () => {
  const said = bookAnnouncement({ title: 'X', issue: '1', grade: '9.8' }, { bin: '08' });
  assert.match(said, /bin 8\b/i);
  assert.doesNotMatch(said, /bin 08/i);
});

test('bookAnnouncement handles a named bin', () => {
  const said = bookAnnouncement({ title: 'X', issue: '1', grade: '9.8' }, { bin: 'wall' });
  assert.match(said, /wall/i);
});

test('bookAnnouncement omits the issue when there is not one', () => {
  const said = bookAnnouncement({ title: 'Fame Mike Tyson', issue: 'nn', grade: '9.8' }, { bin: '01' });
  assert.doesNotMatch(said, /number nn/i);
});

test('bookAnnouncement includes the variant so near-identical books are told apart', () => {
  const said = bookAnnouncement(
    { title: 'Venom', issue: '23', variant: '"Virgin" Edition', grade: '9.8' },
    { bin: '01' },
  );
  assert.match(said, /Virgin Edition/);
  assert.doesNotMatch(said, /"/);
});

/*
 * Voice interpretation. A misheard word costs a wasted scan or, worse, quits
 * halfway through a bin, so anything below the confidence floor is treated as
 * not having been said at all.
 */

test('interpretVoice maps the four words to actions', () => {
  assert.equal(interpretVoice({ text: 'next', confidence: 0.9 }), 'scan');
  assert.equal(interpretVoice({ text: 'again', confidence: 0.9 }), 'redo');
  assert.equal(interpretVoice({ text: 'skip', confidence: 0.9 }), 'skip');
  assert.equal(interpretVoice({ text: 'stop', confidence: 0.9 }), 'quit');
});

test('interpretVoice rejects a low-confidence hearing', () => {
  assert.equal(interpretVoice({ text: 'stop', confidence: 0.3 }), null);
});

test('interpretVoice rejects silence', () => {
  assert.equal(interpretVoice(null), null);
  assert.equal(interpretVoice({ text: '', confidence: 0.99 }), null);
});

test('interpretVoice is case and space insensitive', () => {
  assert.equal(interpretVoice({ text: '  NEXT ', confidence: 0.9 }), 'scan');
});

test('interpretVoice ignores a word outside the grammar', () => {
  assert.equal(interpretVoice({ text: 'banana', confidence: 0.99 }), null);
});

test('quit needs more confidence than scan, since it ends the session', () => {
  // 0.7 is above the ordinary floor but below the one for a destructive action.
  assert.equal(interpretVoice({ text: 'next', confidence: 0.7 }), 'scan');
  assert.equal(interpretVoice({ text: 'stop', confidence: 0.7 }), null);
});

test('the grammar has no word that collides with a scan side', () => {
  // The loop scans a "front" and a "back" - a cue word of "back" would be
  // ambiguous exactly where it is spoken.
  assert.ok(!VOICE_WORDS.includes('back'));
  assert.ok(!VOICE_WORDS.includes('front'));
});

test('VOICE_WORDS is what the grammar is built from', () => {
  assert.deepEqual([...VOICE_WORDS].sort(), ['again', 'next', 'skip', 'stop']);
});

/*
 * The word queue. The recogniser runs continuously, so words can land at any
 * moment - including while the announcement is still being read out, which is
 * the whole point. But a word shouted during a scan must not carry over and
 * trigger the next side before the book has been turned over.
 */

test('a word said during the announcement still counts', () => {
  const q = createWordQueue();
  const started = 1000;
  q.push({ text: 'next', confidence: 0.9, at: 1200 }); // mid-sentence
  assert.equal(q.takeSince(started)?.text, 'next');
});

test('a word said before this side began is stale and dropped', () => {
  const q = createWordQueue();
  q.push({ text: 'next', confidence: 0.9, at: 900 }); // heard during the last scan
  assert.equal(q.takeSince(1000), null);
});

test('taking a word removes it, so one word triggers one scan', () => {
  const q = createWordQueue();
  q.push({ text: 'next', confidence: 0.9, at: 1200 });
  assert.equal(q.takeSince(1000)?.text, 'next');
  assert.equal(q.takeSince(1000), null);
});

test('a stale word does not block a fresh one behind it', () => {
  const q = createWordQueue();
  q.push({ text: 'stop', confidence: 0.9, at: 900 });
  q.push({ text: 'next', confidence: 0.9, at: 1200 });
  assert.equal(q.takeSince(1000)?.text, 'next');
});

test('the queue does not grow without bound', () => {
  const q = createWordQueue({ max: 3 });
  for (let i = 0; i < 10; i += 1) q.push({ text: 'next', confidence: 0.9, at: 1000 + i });
  assert.ok(q.size() <= 3);
});

test('parseHeard reads one line from the recogniser', () => {
  assert.deepEqual(parseHeard('HEARD|next|0.99'), { text: 'next', confidence: 0.99 });
  assert.deepEqual(parseHeard('HEARD|stop|1.00'), { text: 'stop', confidence: 1 });
});

test('parseHeard ignores anything that is not a hearing', () => {
  assert.equal(parseHeard('NONE'), null);
  assert.equal(parseHeard('READY'), null);
  assert.equal(parseHeard(''), null);
  assert.equal(parseHeard('HEARD|'), null);
});

/*
 * Nothing the synthesiser says may itself be a cue word, or the session talks
 * itself into scanning. This is why the prompts never say "next".
 */
test('no spoken prompt contains a cue word', () => {
  for (const line of SPOKEN_PROMPTS) {
    for (const word of VOICE_WORDS) {
      assert.ok(
        !new RegExp(`\b${word}\b`, 'i').test(line),
        `prompt ${JSON.stringify(line)} contains the cue word "${word}"`,
      );
    }
  }
});

test('announcements cannot contain a cue word either', () => {
  const said = bookAnnouncement(
    { title: 'Next Men', issue: '1', grade: '9.8' },
    { bin: '01' },
  );
  for (const word of VOICE_WORDS) {
    assert.ok(!new RegExp(`\b${word}\b`, 'i').test(said), `announcement said "${word}"`);
  }
});
