import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseTagCapture, importTag } from './import-tag.js';
const fixture = JSON.parse(await readFile(new URL('../data/incoming/tag-card-captures.json', import.meta.url), 'utf8'));

test('TAG preserves bilingual identity, leading-zero numbers and grading evidence without invented value or higher count', () => {
  const c = parseTagCapture(fixture.records[0]);
  assert.equal(c.cardNumber, '065/063');assert.equal(c.grade, '9');
  assert.equal(c.subject, "シロナのロズレイド CYNTHIA'S ROSERADE");
  assert.equal(c.displaySubject, "CYNTHIA'S ROSERADE");
  assert.equal(c.gradeDate, '2025-06-02');assert.equal(c.population.asOf, '2026-09-06');
  assert.equal(c.population.higher, null);assert.equal(c.tag.score, null);assert.equal(c.valuation, null);assert.equal(c.location, null);
  assert.equal(c.tag.centering.front, '57L/43R 47T/53B');
  const rankFirst = parseTagCapture(fixture.records[2]);assert.equal(rankFirst.tag.rank.overall, '1st');assert.equal(rankFirst.population.higher, null);
});

test('TAG rejects mismatched identities, effects, mixed-copy sides and invalid report measurements', () => {
  const copy = () => structuredClone(fixture.records[0]);
  const wrong = copy();wrong.renderedCert = 'Q9999999';assert.throws(() => parseTagCapture(wrong), /mismatch/);
  const sfx = copy();sfx.scans[0].url = sfx.scans[0].url.replace('_MAIN', '_SFX');assert.throws(() => parseTagCapture(sfx), /MAIN/);
  const mixed = copy();mixed.scans[1].url = fixture.records[1].scans[1].url;assert.throws(() => parseTagCapture(mixed), /different image IDs/);
  const centering = copy();centering.centering.front = '90L/90R 50T/50B';assert.throws(() => parseTagCapture(centering), /centering/);
  const pop = copy();pop.population.atGrade = 999999;assert.throws(() => parseTagCapture(pop), /population/);
  const scored=copy();scored.score=960;assert.throws(()=>parseTagCapture(scored),/explicitly labeled/);
  scored.scoreLabel='TAG SCORE';assert.equal(parseTagCapture(scored).tag.score,960);assert.equal(parseTagCapture(scored).tag.scoreStatus,'reported');
});

test('TAG accepts reports without an optional set line or variety', () => {
  const base = structuredClone(fixture.records[0]);
  base.identity = ['JAYDEN DANIELS', '2024 PANINI MOSAIC #302'];
  const sports = parseTagCapture(base);
  assert.equal(sports.brand, 'PANINI MOSAIC');assert.equal(sports.cardNumber, '302');assert.equal(sports.variety, null);
  base.identity = ['HENRY DAVIS','2021 BOWMAN DRAFT SAPPHIRE EDITION #BDC-48','YELLOW REFRACTOR'];
  const parallel=parseTagCapture(base);assert.equal(parallel.brand,'BOWMAN DRAFT SAPPHIRE EDITION');assert.equal(parallel.variety,'YELLOW REFRACTOR');assert.deepEqual(parallel.tag.identityLines,base.identity);
  base.identity = ["ヒビキのピチュー ETHAN'S PICHU", '2025 POKÉMON SCARLET & VIOLET JAPANESE #036/063', 'HEAT WAVE ARENA'];
  assert.equal(parseTagCapture(base).variety, null);
});

test('TAG case import preserves other graders and rejects duplicate locations or unsafe containers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tag-case-test-'));
  try {
    const file = path.join(root, 'capture.json'), directory = path.join(root, 'cards');await mkdir(directory);
    const container = {id:'case-02',title:'Case #2',location:'Case #2',physical:true,virtual:false};
    const other = {grader:'CGC',cert:fixture.records[0].cert,subject:'Keep this copy'};
    await writeFile(path.join(directory,'case-02.json'),JSON.stringify({...container,cards:[other]}));
    const data={container,records:[fixture.records[0]]};await writeFile(file,JSON.stringify(data));
    const result=await importTag(file,{directory});assert.equal(result.added,1);
    const box=JSON.parse(await readFile(result.destination,'utf8'));assert.equal(box.cards.length,2);assert.deepEqual(box.cards[1],other);assert.equal(box.title,'Case #2');assert.equal(box.physical,true);
    const refresh=await importTag(file,{directory});assert.equal(refresh.added,0);
    delete data.container;await writeFile(file,JSON.stringify(data));await assert.rejects(importTag(file,{directory}),/another container/);
    data.container={...container,id:'../escape'};await writeFile(file,JSON.stringify(data));await assert.rejects(importTag(file,{directory}),/physical container/);
  } finally { if (path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('tag-case-test-'))throw Error('Unexpected cleanup path');await rm(root,{recursive:true,force:true}); }
});

test('TAG refresh retains scans, owner fields and earlier copies; duplicate ownership is rejected', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tag-import-test-'));
  try {
    const file = path.join(root, 'capture.json'), directory = path.join(root, 'cards');
    await writeFile(file, JSON.stringify({ records: fixture.records.slice(0, 2), pending: [{cert:'X0000000'}] }));
    const first = await importTag(file, { directory });assert.equal(first.added, 2);assert.equal(first.pending, 1);
    const stored = JSON.parse(await readFile(first.destination, 'utf8'));
    Object.assign(stored.cards[0], { images: { front: 'kept.jpg' }, scanStatus: 'complete', location: 'Office', manual: { value: 42 }, notes: 'Gift' });
    await writeFile(first.destination, JSON.stringify(stored));
    await writeFile(file, JSON.stringify({ records: fixture.records.slice(0, 1) }));
    const second = await importTag(file, { directory });assert.equal(second.added, 0);
    const refreshed = JSON.parse(await readFile(second.destination, 'utf8'));
    assert.equal(refreshed.cards.length, 2);assert.equal(refreshed.cards[0].images.front, 'kept.jpg');assert.equal(refreshed.cards[0].manual.value, 42);assert.equal(refreshed.cards[0].location, 'Office');assert.equal(refreshed.cards[0].notes, 'Gift');
    await writeFile(path.join(directory, 'another-box.json'), JSON.stringify({ cards: [refreshed.cards[0]] }));
    await assert.rejects(importTag(file, { directory }), /another container/);
  } finally { if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('tag-import-test-')) throw new Error('Unexpected cleanup path');await rm(root, { recursive: true, force: true }); }
});
