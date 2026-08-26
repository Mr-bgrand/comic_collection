import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWall3dPage } from './templates/wall3dPage.js';
import { renderWallPage } from './templates/wallPage.js';

const SLABBED = {
  cert: '4418876012',
  title: 'Incredible Hulk',
  issue: '1',
  variant: 'Gleason "Virgin" Edition C',
  publisher: 'Marvel Comics',
  issueYear: '2023',
  grade: '9.6',
  pageQuality: 'WHITE',
  labelCategory: 'Universal',
  population: { atGrade: 2, higher: 0 },
  images: { front: 'a.jpg', back: 'b.jpg' },
  fmv: { value: 60, url: 'https://example.invalid/x', fetchedAt: '2026-08-17T12:00:00Z' },
};

// No scan yet, no price, and a title that tries to close the JSON script block.
const HOSTILE = {
  ...SLABBED,
  cert: '4395549004',
  title: 'Venom</script><script>alert(1)',
  images: undefined,
  fmv: undefined,
  population: { atGrade: 5, higher: 12 },
};

const BINS = [{ bin: '01', updated: '2026-08-17', comics: [SLABBED, HOSTILE] }];
const CONFIG = { collectionName: 'Comic Collection', baseUrl: 'https://example.invalid' };

test('vault embeds its data with every < escaped, so a hostile title cannot break out', () => {
  const html = renderWall3dPage({ bins: BINS, config: CONFIG });
  const payload = html.match(/<script type="application\/json" id="wall-data">(.*?)<\/script>/s);
  assert.ok(payload, 'the data payload exists');
  assert.ok(!payload[1].includes('</script'), 'no raw close tag inside the payload');
  assert.ok(payload[1].includes('\\u003c/script'), 'the < is escaped, not dropped');
  const parsed = JSON.parse(payload[1]);
  assert.equal(parsed.comics.length, 2);
  assert.ok(
    parsed.comics[1].title.startsWith('Venom</script><script>alert(1)'),
    'the title round-trips intact',
  );
});

test('vault pins its three.js version rather than floating on latest', () => {
  const html = renderWall3dPage({ bins: BINS, config: CONFIG });
  assert.ok(html.includes('cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'));
  assert.ok(html.includes('cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/'));
});

test('vault paths climb two levels: it lives at wall/3d/', () => {
  const html = renderWall3dPage({ bins: BINS, config: CONFIG });
  const payload = JSON.parse(
    html.match(/<script type="application\/json" id="wall-data">(.*?)<\/script>/s)[1],
  );
  assert.equal(payload.comics[0].href, '../../bin/01/');
  assert.ok(html.includes("const COVERS = '../../covers/'"));
  assert.ok(html.includes("const MEDIUM = '../../medium/'"));
  assert.ok(html.includes('href="../"'), 'links back to the flat wall');
});

test('vault carries a slab even when there is no scan, with img null', () => {
  const html = renderWall3dPage({ bins: BINS, config: CONFIG });
  const payload = JSON.parse(
    html.match(/<script type="application\/json" id="wall-data">(.*?)<\/script>/s)[1],
  );
  assert.equal(payload.comics[0].img, 'a.jpg');
  assert.equal(payload.comics[1].img, null);
  assert.equal(payload.comics[0].top, 1, 'population.higher === 0 marks a top pop');
  assert.equal(payload.comics[1].top, 0);
});

test('vault offers the formations and the same sorts as the flat wall', () => {
  const html = renderWall3dPage({ bins: BINS, config: CONFIG });
  for (const mode of ['wall', 'longbox', 'helix', 'orbit']) {
    assert.ok(html.includes(`data-mode="${mode}"`), `${mode} formation button`);
  }
  for (const sort of ['bin', 'gradeNum', 'value', 'top']) {
    assert.ok(html.includes(`data-sort="${sort}"`), `${sort} sort button`);
  }
});

test('vault fails soft: a no-WebGL / no-CDN fallback and a noscript both point home', () => {
  const html = renderWall3dPage({ bins: BINS, config: CONFIG });
  assert.ok(html.includes('id="fallback"'));
  assert.ok(html.includes('__vaultBooted'), 'the watchdog flag is wired');
  assert.ok(html.includes('<noscript>'));
});

test('the flat wall links to the vault', () => {
  const html = renderWallPage({ bins: BINS, config: CONFIG });
  assert.ok(html.includes('href="3d/"'));
});
