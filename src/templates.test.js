import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard } from './templates/dashboard.js';
import { renderBinPage } from './templates/binPage.js';

const PRICED = {
  cert: '4418876012',
  title: 'Incredible Hulk',
  issue: '1',
  variant: 'Gleason "Virgin" Edition C',
  publisher: 'Marvel Comics',
  issueYear: '2023',
  grade: '9.6',
  pageQuality: 'WHITE',
  labelCategory: 'Universal',
  population: { atGrade: 2, higher: 36 },
  images: { front: 'a.jpg', back: 'b.jpg' },
  fmv: {
    value: 60,
    url: 'https://gocollect.com/app/comic/incredible-hulk-1-gleason-virgin-edition',
    fetchedAt: '2026-08-17T12:00:00Z',
  },
};

const UNPRICED = { ...PRICED, cert: '4395549004', title: 'Venom', issue: '23', fmv: undefined };

const BINS = [{ bin: '01', updated: '2026-08-17', comics: [PRICED, UNPRICED] }];
const CONFIG = { collectionName: 'Comic Collection', baseUrl: 'https://example.invalid' };

test('dashboard links each cert number to its CGC verification page', () => {
  const html = renderDashboard({ bins: BINS, config: CONFIG });
  assert.ok(
    html.includes('href="https://www.cgccomics.com/certlookup/4418876012/"'),
    'cert is a CGC hotlink',
  );
  assert.ok(html.includes('>4418876012</a>'), 'the cert number itself is the link text');
});

test('dashboard links the FMV figure to that book on GoCollect', () => {
  const html = renderDashboard({ bins: BINS, config: CONFIG });
  assert.ok(
    html.includes(
      'href="https://gocollect.com/app/comic/incredible-hulk-1-gleason-virgin-edition"',
    ),
    'FMV is a GoCollect hotlink',
  );
  assert.ok(html.includes('>$60</a>'), 'the price itself is the link text');
});

test('dashboard shows an unpriced book as a dash, not a broken link', () => {
  const html = renderDashboard({ bins: BINS, config: CONFIG });
  assert.ok(html.includes('<span class="dim">—</span>'));
  assert.ok(!html.includes('href="null"'));
  assert.ok(!html.includes('href="undefined"'));
});

test('bin page links cert numbers to CGC', () => {
  const html = renderBinPage({ bin: BINS[0] });
  assert.ok(html.includes('href="https://www.cgccomics.com/certlookup/4418876012/"'));
});

test('bin page shows FMV with its date, linked to GoCollect', () => {
  const html = renderBinPage({ bin: BINS[0] });
  assert.ok(
    html.includes('href="https://gocollect.com/app/comic/incredible-hulk-1-gleason-virgin-edition"'),
  );
  assert.ok(html.includes('$60'));
  assert.ok(html.includes('as of 2026-08-17'), 'a price without a date is worse than no price');
});

test('bin page omits the FMV block entirely when a book has no price', () => {
  const html = renderBinPage({ bin: { bin: '01', comics: [UNPRICED] } });
  assert.ok(!html.includes('GoCollect FMV'));
});

test('titles with quotes are escaped rather than breaking the markup', () => {
  const html = renderDashboard({ bins: BINS, config: CONFIG });
  assert.ok(html.includes('Gleason &quot;Virgin&quot; Edition C'));
});
