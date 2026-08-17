import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdit } from './editor.js';

const makeBins = () => [
  {
    file: 'data/bins/bin-01.json',
    data: {
      bin: '01',
      comics: [
        { cert: '111', title: 'Venom', issue: '23', fmv: { value: 85, status: 'priced' } },
        { cert: '222', title: 'w0rldtr33', issue: '1', fmv: { value: null, status: 'not-listed' } },
      ],
    },
  },
];

test('applyEdit stores a hand-entered value with its note', () => {
  const bins = makeBins();
  const { comic } = applyEdit(bins, { cert: '222', value: '45', note: 'paid at con' });
  assert.equal(comic.manual.value, 45);
  assert.equal(comic.manual.note, 'paid at con');
  assert.ok(comic.manual.setAt, 'records when it was set');
});

test('applyEdit accepts decimals and a leading dollar sign is not required', () => {
  const bins = makeBins();
  assert.equal(applyEdit(bins, { cert: '222', value: '45.50' }).comic.manual.value, 45.5);
});

test('applyEdit leaves the market figure untouched when overriding', () => {
  const bins = makeBins();
  const { comic } = applyEdit(bins, { cert: '111', value: '100' });
  assert.equal(comic.manual.value, 100);
  assert.equal(comic.fmv.value, 85, 'GoCollect value is never overwritten');
});

test('applyEdit clears the estimate on a blank value rather than storing zero', () => {
  // A book worth nothing and a book you have not valued are different facts.
  const bins = makeBins();
  applyEdit(bins, { cert: '222', value: '45' });
  const { comic } = applyEdit(bins, { cert: '222', value: '' });
  assert.equal(comic.manual, undefined);
});

test('applyEdit treats unparseable input as a clear, not as NaN', () => {
  const bins = makeBins();
  const { comic } = applyEdit(bins, { cert: '222', value: 'lots' });
  assert.equal(comic.manual, undefined);
});

test('applyEdit keeps a note even when no value is given', () => {
  const bins = makeBins();
  const { comic } = applyEdit(bins, { cert: '222', value: '', note: 'ask Dave' });
  assert.equal(comic.manual.note, 'ask Dave');
  assert.equal(comic.manual.value, undefined);
});

test('applyEdit reports the file to write, so only that bin is rewritten', () => {
  assert.equal(applyEdit(makeBins(), { cert: '222', value: '1' }).file, 'data/bins/bin-01.json');
});

test('applyEdit rejects an unknown cert instead of silently doing nothing', () => {
  assert.throws(() => applyEdit(makeBins(), { cert: '999', value: '1' }), /unknown cert 999/);
});
