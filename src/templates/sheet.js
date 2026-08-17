/**
 * The 8.5x11 manifest sheet that lives inside the bin — the appraisal document.
 *
 * Printed double-sided: 13 entries per side puts a 25-comic bin on one sheet.
 *
 * Height budget, measured rather than assumed. A letter page with 0.5in margins
 * leaves 10in. Masthead and footer take ~0.5in, so 13 entries get 0.73in each.
 * That is four lines of text, which is why entries use `compactDetailLines`
 * (art credits folded onto one line) instead of the six-line long form. The first
 * cut used the long form and produced four pages instead of two.
 *
 * Comic scans are 500x787, so a 0.45in-wide thumbnail is 0.71in tall and sits
 * exactly inside one entry.
 */

import { displayTitle, compactDetailLines, isTopPop, paginate } from '../model.js';
import { escapeHtml, page, FONT_SANS, FONT_MONO, INK } from './shared.js';

export const PER_SIDE = 13;

const css = `
@page { size: letter; margin: 0.5in; }

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: ${FONT_SANS};
  color: ${INK};
  background: #fff;
  font-size: 8.2pt;
  line-height: 1.28;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.side { page-break-after: always; }
.side:last-child { page-break-after: auto; }

.masthead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 0.04in;
  margin-bottom: 0.05in;
  border-bottom: 2pt solid ${INK};
}

.masthead h1 { font-size: 14pt; font-weight: 800; letter-spacing: -0.025em; }
.masthead .sub { font-size: 7.5pt; color: #55555e; }

.entry {
  display: grid;
  grid-template-columns: 0.43in 1fr;
  column-gap: 0.12in;
  height: 0.7in;
  padding: 0.01in 0;
  border-bottom: 0.3pt solid #e4e4e8;
  overflow: hidden;
  break-inside: avoid;
}

.entry:last-child { border-bottom: 0; }

.cover {
  width: 0.43in;
  height: 0.68in;
  object-fit: cover;
  border: 0.3pt solid #c8c8d0;
  background: #f4f4f6;
}

.cover-none {
  width: 0.43in;
  height: 0.68in;
  border: 0.3pt dashed #c8c8d0;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.1in;
}

.name {
  font-weight: 700;
  font-size: 9pt;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grade {
  font-weight: 800;
  font-size: 10pt;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/*
 * Entries are a fixed height so the page count is deterministic. A very long
 * credit line ellipsises here; the complete text is always on the bin page the
 * QR code opens, and in the JSON.
 */
.meta {
  color: #2a2a31;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta .cert { font-family: ${FONT_MONO}; font-size: 7.5pt; }
.pop { font-weight: 600; color: #7a5410; }

.pagefoot {
  margin-top: 0.06in;
  padding-top: 0.04in;
  border-top: 0.75pt solid #c8c8d0;
  font-size: 6.5pt;
  color: #55555e;
  display: flex;
  justify-content: space-between;
}
`;

function renderEntry(comic, imagePrefix) {
  const cover = comic.images?.front
    ? `<img class="cover" src="${escapeHtml(imagePrefix + comic.images.front)}" alt="">`
    : '<div class="cover-none"></div>';

  const lines = compactDetailLines(comic)
    .map((line) => {
      const html = escapeHtml(line)
        .replace(/(Cert )(\d+)/, '$1<span class="cert">$2</span>')
        .replace(/(★ Top Pop[^·]*)/, '<span class="pop">$1</span>');
      return `      <div class="meta">${html}</div>`;
    })
    .join('\n');

  return `    <div class="entry">
      ${cover}
      <div>
        <div class="head">
          <span class="name">${escapeHtml(displayTitle(comic))}</span>
          <span class="grade">${escapeHtml(comic.grade ?? '')}${
            isTopPop(comic) ? ' ★' : ''
          }</span>
        </div>
${lines}
      </div>
    </div>`;
}

export function renderSheet({ bin, url, imagePrefix = '../../images/' }) {
  const comics = bin.comics ?? [];
  const sides = paginate(comics, PER_SIDE);

  const body = sides
    .map((side, i) => {
      const entries = side.map((c) => renderEntry(c, imagePrefix)).join('\n');
      return `<section class="side">
  <div class="masthead">
    <h1>Bin ${escapeHtml(bin.bin)}</h1>
    <div class="sub">${comics.length} CGC-graded comics${
      bin.location ? ` &middot; ${escapeHtml(bin.location)}` : ''
    } &middot; updated ${escapeHtml(bin.updated ?? '')}</div>
  </div>
${entries}
  <div class="pagefoot">
    <span>${escapeHtml(url.replace(/^https?:\/\//, ''))}</span>
    <span>Side ${i + 1} of ${sides.length}</span>
  </div>
</section>`;
    })
    .join('\n');

  return page({ title: `Bin ${bin.bin} manifest`, css, body });
}
