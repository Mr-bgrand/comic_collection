import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairText, fixMojibake, repairRecord } from './repair.js';

const FFFD = '�';

test('leaves clean text untouched and reports no repairs', () => {
  const r = repairText('Ivan Tao cover');
  assert.equal(r.text, 'Ivan Tao cover');
  assert.deepEqual(r.repairs, []);
  assert.deepEqual(r.unresolved, []);
});

test('repairs a known creator name damaged by CGC', () => {
  const r = repairText(`Torunn Gr${FFFD}nbekk story`);
  assert.equal(r.text, 'Torunn Grønbekk story');
  assert.deepEqual(r.repairs, [[`Gr${FFFD}nbekk`, 'Grønbekk']]);
  assert.deepEqual(r.unresolved, []);
});

test('repairs multiple damaged names in one field', () => {
  const r = repairText(`Ken Lashley & Ram${FFFD}n F. Bachs art`);
  assert.equal(r.text, 'Ken Lashley & Ramón F. Bachs art');
  assert.equal(r.repairs.length, 1);
});

test('repairs across multiline art comments', () => {
  const input = [
    `Torunn Gr${FFFD}nbekk story`,
    `Ken Lashley & Ram${FFFD}n F. Bachs art`,
    'Ivan Tao cover',
  ].join('\n');
  const r = repairText(input);
  assert.ok(r.text.includes('Grønbekk'));
  assert.ok(r.text.includes('Ramón'));
  assert.equal(r.repairs.length, 2);
  assert.deepEqual(r.unresolved, []);
});

test('reports damage it cannot confidently repair instead of hiding it', () => {
  const r = repairText(`Zzyzx Q${FFFD}rbleflotz art`);
  assert.equal(r.repairs.length, 0);
  assert.equal(r.unresolved.length, 1);
  assert.ok(r.unresolved[0].includes(FFFD));
  // damaged text is preserved verbatim, never silently substituted
  assert.ok(r.text.includes(FFFD));
});

test('fixMojibake recovers UTF-8-read-as-Latin-1 sequences losslessly', () => {
  assert.equal(fixMojibake('Grï¿½nbekk'), `Gr${FFFD}nbekk`);
  assert.equal(fixMojibake('GrÃ¸nbekk'), 'Grønbekk');
  assert.equal(fixMojibake('RamÃ³n'), 'Ramón');
  assert.equal(fixMojibake('plain ascii'), 'plain ascii');
});

test('repairRecord repairs every text field and collects repairs once', () => {
  const rec = {
    cert: '4395549004',
    title: 'Venom',
    artComments: `Torunn Gr${FFFD}nbekk story\nKen Lashley & Ram${FFFD}n F. Bachs art`,
    keyComments: 'Venom #223',
    grade: '9.8',
  };
  const out = repairRecord(rec);
  assert.ok(out.artComments.includes('Grønbekk'));
  assert.ok(out.artComments.includes('Ramón'));
  assert.equal(out.keyComments, 'Venom #223');
  assert.equal(out.repairs.length, 2);
  assert.equal(out.unresolved, undefined);
});

test('repairRecord surfaces unresolved damage on the record', () => {
  const out = repairRecord({ cert: '1', artComments: `Q${FFFD}rbleflotz art` });
  assert.equal(out.unresolved.length, 1);
});

test('repairRecord does not mutate its input', () => {
  const rec = { cert: '1', artComments: `Gr${FFFD}nbekk` };
  const copy = { ...rec };
  repairRecord(rec);
  assert.deepEqual(rec, copy);
});
