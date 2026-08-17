/**
 * The site index: every bin, plus a search that answers the question the whole
 * system exists to answer — "which bin is this comic in?"
 *
 * Search runs client-side over a generated search.json. No backend, so it keeps
 * working as a plain static site forever.
 */

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

.wrap { max-width: 46rem; margin: 0 auto; padding: 2.2rem 1.1rem 4rem; }

h1 {
  font-size: clamp(1.9rem, 7vw, 2.7rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.tagline { margin-top: 0.35rem; color: var(--muted); }

.search { margin: 1.8rem 0 1rem; }

input[type="search"] {
  width: 100%;
  padding: 0.75rem 0.9rem;
  font: inherit;
  font-size: 1rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  -webkit-appearance: none;
}

input[type="search"]:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: transparent;
}

.count { margin-top: 0.5rem; font-size: 0.85rem; color: var(--muted); }

.hits { margin-top: 0.6rem; }

.hit {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
  color: inherit;
}

.hit:hover .hit-title { color: var(--accent); }
.hit-title { font-weight: 600; font-size: 0.95rem; }
.hit-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.1rem; }
.hit-cert { font-family: ${FONT_MONO}; }

.hit-right { text-align: right; white-space: nowrap; }
.hit-grade { font-weight: 800; font-variant-numeric: tabular-nums; }
.hit-bin {
  display: block;
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

h2.section {
  margin-top: 2.4rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--ink);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.bins { margin-top: 0.4rem; }

.bin-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
  color: inherit;
}

.bin-link:hover .bin-name { color: var(--accent); }
.bin-name { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }
.bin-meta { font-size: 0.85rem; color: var(--muted); }
.star { color: var(--star); }

.empty { padding: 1rem 0; color: var(--muted); font-size: 0.9rem; }
`;

const script = `
const box = document.getElementById('q');
const hits = document.getElementById('hits');
const count = document.getElementById('count');

let data = [];
try {
  const res = await fetch('search.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  data = await res.json();
} catch (err) {
  // Most often this is the page being opened as a local file, where fetch is
  // blocked. Say so instead of leaving the box disabled saying "Loading...".
  box.placeholder = 'Search unavailable';
  count.textContent = location.protocol === 'file:'
    ? 'Search needs this page served over http:// — try: npx serve dist'
    : 'Could not load the search index (' + err.message + ').';
  throw err;
}

function render(query) {
  const q = query.trim().toLowerCase();
  if (!q) { hits.innerHTML = ''; count.textContent = ''; return; }

  const matches = data.filter((c) =>
    c.cert.includes(q) ||
    c.title.toLowerCase().includes(q) ||
    c.publisher.toLowerCase().includes(q) ||
    String(c.year).includes(q));

  count.textContent = matches.length
    ? matches.length + (matches.length === 1 ? ' match' : ' matches')
    : 'No match for "' + query.trim() + '"';

  hits.innerHTML = matches.slice(0, 60).map((c) =>
    '<a class="hit" href="bin/' + c.bin + '/">' +
      '<span><span class="hit-title">' + c.title + '</span>' +
      '<span class="hit-sub"><span class="hit-cert">' + c.cert + '</span>' +
      (c.publisher ? ' &middot; ' + c.publisher : '') +
      (c.year ? ' &middot; ' + c.year : '') + '</span></span>' +
      '<span class="hit-right"><span class="hit-grade">' + c.grade + '</span>' +
      '<span class="hit-bin">Bin ' + c.bin + '</span></span>' +
    '</a>').join('');
}

box.addEventListener('input', (e) => render(e.target.value));
box.disabled = false;
box.placeholder = 'Search ' + data.length + ' comics by cert number, title, or publisher';
`;

export function renderIndexPage({ bins, config, totalComics, totalTopPops }) {
  const binList = bins
    .map((bin) => {
      const comics = bin.comics ?? [];
      const tops = comics.filter((c) => c.population?.higher === 0).length;
      return `    <a class="bin-link" href="bin/${escapeHtml(bin.bin)}/">
      <span>
        <span class="bin-name">Bin ${escapeHtml(bin.bin)}</span>
        ${bin.location ? `<span class="bin-meta"> &middot; ${escapeHtml(bin.location)}</span>` : ''}
      </span>
      <span class="bin-meta">${comics.length} comics${
        tops ? ` &middot; <span class="star">★ ${tops}</span>` : ''
      }</span>
    </a>`;
    })
    .join('\n');

  const body = `<div class="wrap">
  <h1>${escapeHtml(config.collectionName ?? 'Comic Collection')}</h1>
  <p class="tagline">${totalComics} CGC-graded comics across ${bins.length} bin${
    bins.length === 1 ? '' : 's'
  }${totalTopPops ? ` &middot; <span class="star">★ ${totalTopPops} top pop</span>` : ''}</p>

  <div class="search">
    <label for="q" class="visually-hidden" hidden>Search the collection</label>
    <input id="q" type="search" disabled placeholder="Loading&hellip;" autocomplete="off" spellcheck="false">
    <div class="count" id="count"></div>
    <div class="hits" id="hits"></div>
  </div>

  <h2 class="section">Bins</h2>
  <div class="bins">
${binList || '    <p class="empty">No bins yet.</p>'}
  </div>
</div>

<script type="module">
${script}
</script>`;

  return page({ title: config.collectionName ?? 'Comic Collection', css, body });
}
