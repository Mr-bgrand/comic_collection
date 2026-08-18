/**
 * The 8.5x11 manifest sheet that lives inside the bin — the appraisal document.
 * Printed double-sided and laminated back to back, so it must stay at two sides.
 *
 * Two columns, seven entries each: 14 per side, 28 across a sheet, which covers a
 * full 25-comic bin.
 *
 * Why two columns. Cover height is capped by row height, and width follows from
 * the 500x787 scan aspect. In a single column of 13 rows the row is ~0.68in, so
 * the cover can never exceed ~0.43in wide however much horizontal space is going
 * spare — and a lot was, since the detail text only used about a third of a 7in
 * column. Halving the column width and taking seven rows instead of thirteen buys
 * back the height: rows go to ~1.25in and covers to 0.76in, nearly double.
 *
 * The cost is real and deliberate: the narrower text column clips long detail
 * lines sooner. `compactDetailLines` already orders them most-valuable-first for
 * exactly this reason, and nothing is lost — the QR opens the full record.
 */

import { displayTitle, compactDetailLines, isTopPop, paginate } from '../model.js';
import { escapeHtml, page, FONT_SANS, FONT_MONO, INK } from './shared.js';

export const PER_COLUMN = 7;
export const PER_SIDE = PER_COLUMN * 2;

const css = `
@page { size: letter; margin: 0.5in; }

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: ${FONT_SANS};
  color: ${INK};
  background: #fff;
  font-size: 7.6pt;
  line-height: 1.26;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.side { page-break-after: always; }
.side:last-child { page-break-after: auto; }

.masthead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.15in;
  padding-bottom: 0.04in;
  margin-bottom: 0.06in;
  border-bottom: 2pt solid ${INK};
}

.masthead h1 { font-size: 14pt; font-weight: 800; letter-spacing: -0.025em; }
.masthead .sub { margin-top: 0.02in; font-size: 7.5pt; color: #55555e; }

/*
 * The QR repeats on every side, because each side is a standalone page — whoever
 * is holding side 2 should not have to go find side 1 to scan through.
 */
.mast-qr { flex: none; width: 0.8in; text-align: center; }
.mast-qr svg { width: 0.8in; height: 0.8in; display: block; }
.mast-qr .cap { margin-top: 0.01in; font-size: 5.5pt; line-height: 1.1; color: #55555e; }

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 0.24in;
}

.entry {
  display: grid;
  grid-template-columns: 0.76in 1fr;
  column-gap: 0.1in;
  height: 1.25in;
  padding: 0.02in 0;
  border-bottom: 0.3pt solid #e4e4e8;
  overflow: hidden;
  break-inside: avoid;
}

.cover {
  width: 0.76in;
  height: 1.2in;
  object-fit: cover;
  border: 0.3pt solid #c8c8d0;
  background: #f4f4f6;
}

.cover-none {
  width: 0.76in;
  height: 1.2in;
  border: 0.3pt dashed #c8c8d0;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.06in;
}

.name {
  font-weight: 700;
  font-size: 8.2pt;
  letter-spacing: -0.01em;
  line-height: 1.2;
  /* Two lines for the title; variant strings rarely fit one at this width. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grade {
  font-weight: 800;
  font-size: 9.5pt;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/*
 * Detail lines wrap up to two lines each and then clip. Entries are a fixed
 * height so the page count stays deterministic; compactDetailLines puts the
 * appraisal-critical figures first so the clipping falls on the prose.
 */
.meta {
  margin-top: 0.015in;
  color: #2a2a31;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta .cert { font-family: ${FONT_MONO}; font-size: 7pt; }
.pop { font-weight: 700; color: #7a5410; }

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
      return `        <div class="meta">${html}</div>`;
    })
    .join('\n');

  return `      <div class="entry">
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

export function renderSheet({ bin, url, qrSvg = '', imagePrefix = '../../images/' }) {
  const comics = bin.comics ?? [];
  const sides = paginate(comics, PER_SIDE);

  const qrBlock = qrSvg
    ? `    <div class="mast-qr">${qrSvg}<div class="cap">Scan for cover scans</div></div>`
    : '';

  const body = sides
    .map((side, i) => {
      const columns = paginate(side, PER_COLUMN);
      const cols = columns
        .map((col) => `    <div>\n${col.map((c) => renderEntry(c, imagePrefix)).join('\n')}\n    </div>`)
        .join('\n');

      return `<section class="side">
  <div class="masthead">
    <div>
      <h1>Bin ${escapeHtml(bin.bin)}</h1>
      <div class="sub">${comics.length} CGC-graded comics${
        bin.location ? ` &middot; ${escapeHtml(bin.location)}` : ''
      } &middot; updated ${escapeHtml(bin.updated ?? '')}</div>
    </div>
${qrBlock}
  </div>
  <div class="cols">
${cols}
  </div>
  <div class="pagefoot">
    <span>${escapeHtml(url.replace(/^https?:\/\//, ''))}</span>
    <span>Side ${i + 1} of ${sides.length}</span>
  </div>
</section>`;
    })
    .join('\n');

  return page({ title: `Bin ${bin.bin} manifest`, css, body });
}
