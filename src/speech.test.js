import { test } from 'node:test';
import assert from 'node:assert/strict';

import { speakable, bookAnnouncement, interpretVoice, VOICE_WORDS } from './speech.js';

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
