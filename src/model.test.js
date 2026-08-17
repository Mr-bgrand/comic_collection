import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayTitle,
  isTopPop,
  labelRow,
  detailLines,
  paginate,
  binUrl,
  formatPageQuality,
  collectSearchIndex,
  fitFontSize,
  labelMetrics,
  compactDetailLines,
} from './model.js';

const VENOM = {
  cert: '4395549004',
  title: 'Venom',
  issue: '23',
  issueDate: '9/23',
  issueYear: '2023',
  publisher: 'Marvel Comics',
  variant: 'Black Saber Comics "Virgin" Edition',
  grade: '9.8',
  pageQuality: 'WHITE',
  gradeDate: '2024-03-26',
  labelCategory: 'Universal',
  artComments: 'Torunn Grønbekk story\nKen Lashley & Ramón F. Bachs art\nIvan Tao cover',
  keyComments: 'Venom #223',
  population: { atGrade: 83, higher: 0, topPop: true },
};

test('displayTitle matches the text printed on the slab, variant included', () => {
  assert.equal(
    displayTitle(VENOM),
    'Venom #23 : Black Saber Comics "Virgin" Edition',
  );
});

test('displayTitle omits the variant separator when there is no variant', () => {
  assert.equal(displayTitle({ ...VENOM, variant: '' }), 'Venom #23');
  assert.equal(displayTitle({ ...VENOM, variant: null }), 'Venom #23');
});

test('isTopPop is true only when nothing is graded higher', () => {
  assert.equal(isTopPop(VENOM), true);
  assert.equal(isTopPop({ ...VENOM, population: { atGrade: 83, higher: 4 } }), false);
});

test('isTopPop is false when population data is missing rather than assumed', () => {
  assert.equal(isTopPop({ ...VENOM, population: null }), false);
  assert.equal(isTopPop({ ...VENOM, population: undefined }), false);
  assert.equal(isTopPop({ ...VENOM, population: { atGrade: 83 } }), false);
});

test('labelRow splits title and grade so the grade column stays aligned', () => {
  const row = labelRow(VENOM);
  assert.equal(row.title, 'Venom #23 : Black Saber Comics "Virgin" Edition');
  assert.equal(row.grade, '9.8');
  assert.equal(row.star, true);
});

test('formatPageQuality renders CGC shout-case as prose', () => {
  assert.equal(formatPageQuality('WHITE'), 'White pages');
  assert.equal(formatPageQuality('OFF-WHITE'), 'Off-white pages');
  assert.equal(formatPageQuality('CREAM TO OFF-WHITE'), 'Cream to off-white pages');
  assert.equal(formatPageQuality(''), '');
});

test('detailLines carries every CGC field onto the sheet', () => {
  const lines = detailLines(VENOM);
  const all = lines.join(' | ');
  assert.ok(all.includes('Marvel Comics'));
  assert.ok(all.includes('9/23'));
  assert.ok(all.includes('2023'));
  assert.ok(all.includes('Universal'));
  assert.ok(all.includes('White pages'));
  assert.ok(all.includes('Grønbekk'));
  assert.ok(all.includes('Venom #223'));
  assert.ok(all.includes('2024-03-26'));
  assert.ok(all.includes('4395549004'));
  assert.ok(all.includes('83'));
});

test('detailLines omits absent optional fields rather than printing empties', () => {
  const bare = { cert: '1', title: 'Spawn', issue: '1', grade: '9.6' };
  const all = detailLines(bare).join(' | ');
  assert.ok(!all.includes('undefined'));
  assert.ok(!all.includes('null'));
  assert.ok(!/·\s*·/.test(all), 'no doubled separators from empty fields');
});

test('fitFontSize leaves short titles at full size', () => {
  assert.equal(fitFontSize('Venom #23', 2.9), 9.5);
});

test('fitFontSize shrinks a long variant string to keep it on one line', () => {
  const size = fitFontSize(displayTitle(VENOM), 2.9);
  assert.ok(size < 9.5, `expected shrink, got ${size}`);
  assert.ok(size >= 6.5, `expected readable, got ${size}`);
});

test('fitFontSize never shrinks below the readable floor', () => {
  assert.equal(fitFontSize('x'.repeat(400), 2.9), 6.5);
});

test('fitFontSize handles empty input without dividing by zero', () => {
  assert.equal(fitFontSize('', 2.9), 9.5);
  assert.equal(fitFontSize(null, 2.9), 9.5);
});

test('paginate splits 25 comics across two sheet sides', () => {
  const comics = Array.from({ length: 25 }, (_, i) => ({ cert: String(i) }));
  const pages = paginate(comics, 13);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 13);
  assert.equal(pages[1].length, 12);
});

test('paginate returns a single page when everything fits', () => {
  assert.equal(paginate([{ cert: '1' }], 13).length, 1);
});

test('paginate returns no pages for an empty bin', () => {
  assert.deepEqual(paginate([], 13), []);
});

test('labelMetrics keeps every row inside the printable 4x6 area', () => {
  // The invariant that a hand-tuned row height violated: header + gap + all rows
  // + footer must fit the 5.64in of a 4x6 page left after margins.
  const HEADER = 1.16, FOOTER = 0.2, GAP = 0.06, USABLE = 5.64;
  for (const count of [1, 10, 20, 23, 25, 30, 40]) {
    const m = labelMetrics(count, { headerIn: HEADER, footerIn: FOOTER, gapIn: GAP });
    const total = HEADER + GAP + m.rowHeightIn * count + FOOTER;
    assert.ok(
      total <= USABLE + 0.001,
      `${count} comics need ${total.toFixed(3)}in of ${USABLE}in`,
    );
  }
});

test('labelMetrics keeps the type readable at the real bin size', () => {
  const m = labelMetrics(25);
  assert.ok(m.titlePt >= 8, `expected readable type, got ${m.titlePt}pt`);
  assert.ok(m.titlePt <= 9.5);
});

test('labelMetrics leaves room for the line box inside each row', () => {
  for (const count of [20, 25, 30]) {
    const m = labelMetrics(count);
    const lineHeightIn = (m.titlePt * 1.22) / 72;
    assert.ok(
      lineHeightIn <= m.rowHeightIn + 0.0005,
      `${count}: ${lineHeightIn.toFixed(4)}in line in ${m.rowHeightIn}in row`,
    );
  }
});

test('labelMetrics shrinks type as a bin gets fuller', () => {
  assert.ok(labelMetrics(45).titlePt < labelMetrics(25).titlePt);
});

test('labelMetrics does not divide by zero on an empty bin', () => {
  const m = labelMetrics(0);
  assert.ok(Number.isFinite(m.rowHeightIn));
  assert.equal(m.titlePt, 9.5);
});

test('compactDetailLines folds the record onto at most three lines', () => {
  assert.ok(compactDetailLines(VENOM).length <= 3);
});

test('compactDetailLines keeps every field the long form has', () => {
  const all = compactDetailLines(VENOM).join(' | ');
  for (const needle of [
    'Marvel Comics', '9/23', '2023', 'Universal', 'White pages',
    'Grønbekk', 'Ramón', 'Ivan Tao', 'Venom #223', '2024-03-26',
    '4395549004', 'Top Pop', '83',
  ]) {
    assert.ok(all.includes(needle), `missing ${needle}`);
  }
});

test('compactDetailLines joins art credits onto one line', () => {
  const lines = compactDetailLines(VENOM);
  const credits = lines.find((l) => l.includes('Grønbekk'));
  assert.ok(credits.includes('Ivan Tao'), 'all credits on the same line');
  assert.ok(!credits.includes('\n'));
});

test('detailLines drops CGC date placeholders instead of printing them as fact', () => {
  const undated = { ...VENOM, issueDate: 'No Date', issueYear: '1900' };
  const all = detailLines(undated).join(' | ');
  assert.ok(!all.includes('No Date'), 'placeholder date not printed');
  assert.ok(!all.includes('1900'), 'placeholder year not printed');
  assert.ok(all.includes('Marvel Comics'), 'real fields still printed');
  assert.ok(!/·\s*·/.test(all), 'no doubled separators where placeholders were');
});

test('compactDetailLines drops the same placeholders', () => {
  const all = compactDetailLines({ ...VENOM, issueDate: 'No Date', issueYear: '1900' }).join(' | ');
  assert.ok(!all.includes('1900'));
  assert.ok(!all.includes('No Date'));
});

test('a real issue year is never mistaken for a placeholder', () => {
  assert.ok(detailLines({ ...VENOM, issueYear: '1963' }).join(' ').includes('1963'));
});

test('compactDetailLines omits absent fields without leaving separators', () => {
  const all = compactDetailLines({ cert: '1', title: 'Spawn', issue: '1', grade: '9.6' }).join(' | ');
  assert.ok(!all.includes('undefined'));
  assert.ok(!/·\s*·/.test(all));
});

test('binUrl builds the QR destination without doubling slashes', () => {
  assert.equal(
    binUrl('https://mr-bgrand.github.io/comic_collection', '01'),
    'https://mr-bgrand.github.io/comic_collection/bin/01/',
  );
  assert.equal(
    binUrl('https://mr-bgrand.github.io/comic_collection/', '01'),
    'https://mr-bgrand.github.io/comic_collection/bin/01/',
  );
});

test('collectSearchIndex makes every comic findable by cert and by title', () => {
  const bins = [{ bin: '01', comics: [VENOM] }];
  const idx = collectSearchIndex(bins);
  assert.equal(idx.length, 1);
  assert.equal(idx[0].cert, '4395549004');
  assert.equal(idx[0].bin, '01');
  assert.ok(idx[0].title.includes('Venom'));
  assert.equal(idx[0].grade, '9.8');
});
