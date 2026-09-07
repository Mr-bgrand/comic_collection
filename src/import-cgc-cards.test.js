import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseCgcCardCapture, importCgcCards } from './import-cgc-cards.js';
import { acceptedCardImage, acceptedCardCertPage } from './card-images.js';
import { isTopPop } from './model.js';
const capture = JSON.parse(await readFile(new URL('../data/incoming/cgc-card-captures.json', import.meta.url), 'utf8'));

test('CGC captures preserve current grading, lookup history, absent card numbers and real census counts', () => {
  const cards = capture.records.map(r => parseCgcCardCapture(r));
  assert.equal(cards.length, 11);
  assert.equal(cards[0].cert, '1401019289294');
  assert.equal(cards[2].cardNumber, '075/064');
  assert.equal(cards[3].cardNumber, null);
  assert.equal(cards[4].grade, '10');
  assert.equal(cards[4].gradeDescription, 'GEM MINT');
  assert.equal(cards[4].cgc.lookupGrade, '9.5');
  assert.equal(cards[4].cgc.gradeChangedFromLookup, true);
  assert.equal(cards[4].population.higher, 284);
  assert.equal(cards[4].cgc.slabLabel.gradeText, 'Gem Mint 9.5');
  assert.equal(cards[4].cgc.scanOrientation.reversed, true);
  assert.equal(isTopPop(cards[4]), false);
  assert.equal(cards[6].language, 'Indonesian');
  assert.equal(cards[10].grade, '9.5');
  assert.equal(cards[10].gradeDescription, 'MINT+');
  assert.ok(cards.every(c => c.valuation === null && !c.vault));
  const absent = structuredClone(capture.records[0]); absent.population = []; absent.scans = [];
  assert.equal(parseCgcCardCapture(absent).population, null);
  assert.equal(parseCgcCardCapture(absent).scanStatus, 'no-scans-on-cert-page');
});

test('CGC accepts observed legacy hosts but rejects other copies, swapped sides, thumbnails and foreign pages', () => {
  for (const r of capture.records) {
    const cert = Object.fromEntries(r.pairs)['Cert #'];
    assert.ok(acceptedCardCertPage('CGC', r.pageUrl, cert));
    for (const s of r.scans) assert.ok(acceptedCardImage('CGC', s.url, s.label === 'Obverse' ? 'front' : 'back', cert));
  }
  const r = capture.records[0], cert = Object.fromEntries(r.pairs)['Cert #'], url = r.scans[0].url;
  for (const bad of [url.replace('/CRD', '/TN_CRD'), url.replace('amazonaws.com', 'amazonaws.com.evil.test'), url.replace('CRD1401019289-294', 'CRD1401019289-295')]) assert.equal(acceptedCardImage('CGC', bad, 'front', cert), false);
  assert.equal(acceptedCardImage('CGC', url, 'back', cert), false);
  const legacy=capture.records[4], legacyCert=Object.fromEntries(legacy.pairs)['Cert #'];
  const actualFront=legacy.scans.find(s=>s.label==='Reverse').url;
  assert.equal(acceptedCardImage('CGC',actualFront,'front',legacyCert),false);
  assert.equal(acceptedCardImage('CGC',actualFront,'front',legacyCert,true),true);
  assert.equal(acceptedCardImage('CGC',actualFront,'back',legacyCert,true),false);
  assert.equal(acceptedCardCertPage('CGC', r.pageUrl.replace('cgccards', 'cgccomics'), cert), false);
  const wrong = structuredClone(r); wrong.pageUrl = capture.records[1].pageUrl;
  assert.throws(() => parseCgcCardCapture(wrong), /mismatch/);
  const mixed = structuredClone(r); mixed.scans[1].url = mixed.scans[1].url.replace('5562729f', '6562729f');
  assert.throws(() => parseCgcCardCapture(mixed), /different image IDs/);
  const census = structuredClone(r); census.population[0].text = census.population[0].text.replace('In 9 Grade', 'In 10 Grade');
  assert.throws(() => parseCgcCardCapture(census), /reported grade/);
});

test('Case import is idempotent, retains other graders and owner edits, and rejects cross-case duplicates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cgc-card-test-'));
  try {
    const file = path.join(root, 'capture.json'), directory = path.join(root, 'cards');
    await writeFile(file, JSON.stringify({ ...capture, records: capture.records.slice(0, 2) }));
    const first = await importCgcCards(file, { directory }); assert.equal(first.added, 2);
    const box = JSON.parse(await readFile(first.destination, 'utf8'));
    box.title = 'Renamed case'; box.cards[0].images = { front: 'verified.jpg' }; box.cards[0].manual = { value: 42 }; box.cards[0].notes = 'Gift';
    box.cards.push({ kind: 'card', grader: 'PSA', cert: box.cards[0].cert });
    await writeFile(first.destination, JSON.stringify(box));
    await writeFile(file, JSON.stringify({ ...capture, records: capture.records.slice(0, 1) }));
    assert.equal((await importCgcCards(file, { directory })).added, 0);
    const again = JSON.parse(await readFile(first.destination, 'utf8'));
    assert.equal(again.cards.length, 3); assert.equal(again.title, 'Renamed case'); assert.equal(again.location, 'Case #1');
    assert.equal(again.cards[0].images.front, 'verified.jpg'); assert.equal(again.cards[0].manual.value, 42); assert.equal(again.cards[0].notes, 'Gift');
    await writeFile(path.join(directory, 'another-case.json'), JSON.stringify({ cards: [again.cards[0]] }));
    await assert.rejects(importCgcCards(file, { directory }), /another container/);
  } finally {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('cgc-card-test-')) throw new Error('Unexpected cleanup path');
    await rm(root, { recursive: true, force: true });
  }
});
