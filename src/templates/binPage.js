/**
 * The bin page — where the QR code on the label lands.
 *
 * Same record as the printed sheet, plus full-size front and back scans, laid out
 * for a phone held in one hand while the other hand holds the bin.
 */

import { displayTitle, detailLines, isTopPop } from '../model.js';
import { escapeHtml, page, FONT_SANS, FONT_MONO } from './shared.js';

const css = `
:root {
  --bg: #fbfbfa;
  --surface: #ffffff;
  --ink: #16161a;
  --muted: #5f5f6b;
  --line: #e4e4e8;
  --accent: #a1601a;
  --star: #b7791f;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121215;
    --surface: #1b1b20;
    --ink: #ececf0;
    --muted: #9d9daa;
    --line: #2c2c34;
    --accent: #e0a75e;
    --star: #e8bf72;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: ${FONT_SANS};
  background: var(--bg);
  color: var(--ink);
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

.wrap { max-width: 44rem; margin: 0 auto; padding: 1.5rem 1.1rem 4rem; }

.back {
  display: inline-block;
  margin-bottom: 1.1rem;
  font-size: 0.85rem;
  color: var(--muted);
  text-decoration: none;
}
.back:hover { color: var(--accent); }

header.bin {
  padding-bottom: 1rem;
  margin-bottom: 1.4rem;
  border-bottom: 2px solid var(--ink);
}

header.bin h1 {
  font-size: clamp(1.9rem, 7vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

header.bin .sub { margin-top: 0.3rem; color: var(--muted); font-size: 0.92rem; }

.comic {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 1rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--line);
}

.comic:last-child { border-bottom: 0; }

.scans { display: flex; flex-direction: column; gap: 0.4rem; }

.scans img {
  width: 100%;
  aspect-ratio: 500 / 787;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: var(--surface);
}

.title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.title-row h2 {
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.3;
}

.grade {
  font-size: 1.35rem;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.detail { margin-top: 0.45rem; font-size: 0.88rem; color: var(--muted); }
.detail div + div { margin-top: 0.12rem; }
.cert { font-family: ${FONT_MONO}; font-size: 0.82rem; }

.pop { color: var(--star); font-weight: 600; }

.warn {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--accent);
}

@media (max-width: 30rem) {
  .comic { grid-template-columns: 4.2rem 1fr; gap: 0.8rem; }
  .scans img:nth-child(2) { display: none; }
}
`;

function renderComic(comic, imagePrefix) {
  const scans = ['front', 'back']
    .filter((side) => comic.images?.[side])
    .map(
      (side) =>
        `<img src="${escapeHtml(imagePrefix + comic.images[side])}" alt="${escapeHtml(
          `${displayTitle(comic)} ${side} cover`,
        )}" loading="lazy">`,
    )
    .join('\n        ');

  const detail = detailLines(comic)
    .map((line) => {
      const cls = /^★ Top Pop/.test(line) ? 'pop' : '';
      const html = escapeHtml(line).replace(
        /(Cert )(\d+)/,
        '$1<span class="cert">$2</span>',
      );
      return `        <div class="${cls}">${html}</div>`;
    })
    .join('\n');

  const warning = comic.unresolved?.length
    ? `      <div class="warn">Unverified characters in CGC source text: ${escapeHtml(
        comic.unresolved.join(', '),
      )}</div>`
    : '';

  return `    <article class="comic">
      <div class="scans">
        ${scans || ''}
      </div>
      <div>
        <div class="title-row">
          <h2>${escapeHtml(displayTitle(comic))}</h2>
          <span class="grade">${escapeHtml(comic.grade ?? '')}${
            isTopPop(comic) ? ' ★' : ''
          }</span>
        </div>
        <div class="detail">
${detail}
        </div>
${warning}
      </div>
    </article>`;
}

export function renderBinPage({ bin, imagePrefix = '../../images/', rootPrefix = '../../' }) {
  const comics = bin.comics ?? [];
  const topPops = comics.filter((c) => isTopPop(c)).length;

  const body = `<div class="wrap">
  <a class="back" href="${rootPrefix}">&larr; All bins</a>

  <header class="bin">
    <h1>Bin ${escapeHtml(bin.bin)}</h1>
    <div class="sub">
      ${comics.length} CGC-graded comics${topPops ? ` &middot; ${topPops} top pop` : ''}${
        bin.location ? ` &middot; ${escapeHtml(bin.location)}` : ''
      }<br>Updated ${escapeHtml(bin.updated ?? '')}
    </div>
  </header>

${comics.map((c) => renderComic(c, imagePrefix)).join('\n')}
</div>`;

  return page({ title: `Bin ${bin.bin}`, css, body });
}
