import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { importCardImages } from './import-card-images.js';
import { acceptedTagSlabPhoto } from './card-images.js';

const CDN = 'https://d39lwrz0lm7c9r.cloudfront.net/card-images/';
const MAIN_FRONT = CDN + 'b0e770a3-f004_FRONT_MAIN.jpg';
const MAIN_BACK = CDN + 'b0e770a3-f004_BACK_MAIN.jpg';
const SLAB_FRONT = CDN + '77aa1b2c-9d10_FRONT_SLAB.jpg';
const SLAB_BACK = CDN + '77aa1b2c-9d10_BACK_SLAB.jpg';

test('a MAIN scan is never accepted as a slab photo, and side markers must agree', () => {
  assert.ok(acceptedTagSlabPhoto(SLAB_FRONT, 'front'));
  assert.ok(acceptedTagSlabPhoto(SLAB_BACK, 'back'));
  // A filename without a side marker is legal: the capture's page label decides.
  assert.ok(acceptedTagSlabPhoto(CDN + '77aa1b2c-9d10-photo.jpg', 'front'));
  assert.ok(!acceptedTagSlabPhoto(MAIN_FRONT, 'front'), 'a scan cannot masquerade as a slab photo');
  assert.ok(!acceptedTagSlabPhoto(SLAB_BACK, 'front'), 'marker must agree with the recorded side');
  assert.ok(!acceptedTagSlabPhoto('https://elsewhere.example/card-images/x_FRONT_SLAB.jpg', 'front'));
  assert.ok(!acceptedTagSlabPhoto(SLAB_FRONT + '?w=100', 'front'), 'no query strings');
});

/** A fixture repo in a temp dir, since the importer writes relative paths. */
async function fixture(card) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'card-images-'));
  await mkdir(path.join(root, 'data', 'cards'), { recursive: true });
  await writeFile(
    path.join(root, 'data', 'cards', 'case-t.json'),
    JSON.stringify({ id: 'case-t', kind: 'card', cards: [card] }, null, 2) + '\n',
  );
  return root;
}

function jpegResponder(log = []) {
  const pixel = sharp({ create: { width: 8, height: 12, channels: 3, background: '#802030' } })
    .jpeg()
    .toBuffer();
  return async (url) => {
    log.push(url);
    return new Response(await pixel, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };
}

const manifest = (entry) => ({ provider: 'TAG', discoveredAt: '2026-09-08T00:00:00.000Z', records: [entry] });

const ENTRY = {
  grader: 'TAG',
  cert: 'H1234567',
  pageUrl: 'https://my.taggrading.com/card/H1234567',
  front: MAIN_FRONT,
  back: MAIN_BACK,
  slabFront: SLAB_FRONT,
  slabBack: SLAB_BACK,
};

test('slab photos become the display images; MAIN scans stay first-class as scanFront/scanBack', async () => {
  const root = await fixture({ grader: 'TAG', cert: 'H1234567' });
  const cwd = process.cwd();
  process.chdir(root);
  try {
    await writeFile('manifest.json', JSON.stringify(manifest(ENTRY)));
    const result = await importCardImages('manifest.json', 'data/cards/case-t.json', { fetchImpl: jpegResponder() });
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    const card = JSON.parse(await readFile('data/cards/case-t.json', 'utf8')).cards[0];
    assert.equal(card.images.front, 'TAG_H1234567_FRONT_SLAB.jpg');
    assert.equal(card.images.back, 'TAG_H1234567_BACK_SLAB.jpg');
    assert.equal(card.images.scanFront, 'TAG_H1234567_FRONT.jpg');
    assert.equal(card.images.scanBack, 'TAG_H1234567_BACK.jpg');
    assert.equal(card.imageSources.front.kind, 'slab-photo');
    assert.equal(card.imageSources.front.url, SLAB_FRONT);
    assert.match(card.imageSources.front.sideBasis, /GRADED IMAGES/);
    assert.equal(card.imageSources.scanFront.kind, 'plain-scan');
    assert.equal(card.imageSources.scanFront.url, MAIN_FRONT);
    assert.equal(card.scanStatus, 'complete');
    for (const file of Object.values(card.images)) {
      assert.ok(existsSync('data/images/' + file), file + ' master exists');
      assert.ok(existsSync('data/medium/' + file), file + ' medium exists');
      assert.ok(existsSync('data/wall/' + file), file + ' wall exists');
      assert.ok(existsSync('data/originals/' + file), file + ' original kept');
    }
  } finally {
    process.chdir(cwd);
  }
});

test('an already-downloaded display scan is re-slotted, not refetched, and no history is invented', async () => {
  const scanSource = {
    url: MAIN_FRONT, pageUrl: ENTRY.pageUrl, side: 'front', kind: 'plain-scan',
    discoveredAt: '2026-09-07T00:00:00.000Z', retrievedAt: '2026-09-07T00:00:01.000Z',
    sideBasis: 'TAG rendered card page: explicit FRONT_MAIN / BACK_MAIN suffix',
  };
  const root = await fixture({
    grader: 'TAG', cert: 'H1234567',
    images: { front: 'TAG_H1234567_FRONT.jpg' },
    imageSources: { front: scanSource },
    scanStatus: 'partial',
  });
  const cwd = process.cwd();
  process.chdir(root);
  try {
    // The previously downloaded scan and its retained original.
    await mkdir('data/images', { recursive: true });
    await mkdir('data/originals', { recursive: true });
    const jpeg = await sharp({ create: { width: 8, height: 12, channels: 3, background: '#204060' } }).jpeg().toBuffer();
    await writeFile('data/images/TAG_H1234567_FRONT.jpg', jpeg);
    await writeFile('data/originals/TAG_H1234567_FRONT.jpg', jpeg);
    await writeFile('manifest.json', JSON.stringify(manifest({ ...ENTRY, back: undefined, slabBack: undefined })));

    const fetched = [];
    const result = await importCardImages('manifest.json', 'data/cards/case-t.json', { fetchImpl: jpegResponder(fetched) });
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.deepEqual(fetched, [SLAB_FRONT], 'only the slab photo is downloaded');

    const card = JSON.parse(await readFile('data/cards/case-t.json', 'utf8')).cards[0];
    assert.equal(card.images.front, 'TAG_H1234567_FRONT_SLAB.jpg');
    assert.equal(card.images.scanFront, 'TAG_H1234567_FRONT.jpg');
    assert.equal(card.imageSources.scanFront.url, MAIN_FRONT, 'the verified source record moved with the file');
    assert.equal(card.imageHistory, undefined, 'a re-slotted scan is not a replacement');
  } finally {
    process.chdir(cwd);
  }
});

test('slab photos are refused outside TAG', async () => {
  const root = await fixture({ grader: 'PSA', cert: '12345678' });
  const cwd = process.cwd();
  process.chdir(root);
  try {
    await writeFile('manifest.json', JSON.stringify(manifest({
      grader: 'PSA', cert: '12345678', pageUrl: 'https://www.psacard.com/cert/12345678/psa',
      slabFront: SLAB_FRONT,
    })));
    await assert.rejects(
      () => importCardImages('manifest.json', 'data/cards/case-t.json', { fetchImpl: jpegResponder() }),
      /only defined for TAG/,
    );
  } finally {
    process.chdir(cwd);
  }
});
