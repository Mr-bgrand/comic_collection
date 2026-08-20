/**
 * The wall — every cover at once, edge to edge.
 *
 * Design notes, because the choices here are deliberate and easy to undo by
 * accident:
 *
 * The subject is not "comic covers", it is *slabs* — rigid glossy plastic with a
 * label at the top, all one proportion. So the covers tessellate with no gaps
 * and no rounded corners: a longbox seen head-on, not a card grid.
 *
 * The page carries almost no colour of its own. Eighty covers supply it. The two
 * accents are taken from the artifact itself — the certification blue and the
 * gold used for census scarcity — rather than an arbitrary highlight hue.
 *
 * The signature is the specular sweep: hovering slides a highlight across the
 * slab and drops the rest of the wall back, which is what tilting a real slab
 * under a lamp does. It is the one bold gesture; everything else stays quiet.
 */

import { displayTitle, isTopPop, fmvValue, manualValue, formatMoney } from '../model.js';
import { escapeHtml } from './shared.js';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&display=swap';

const css = `
:root {
  --void: #08080a;
  --wall: #101014;
  --ink: #f4f4f7;
  --mute: #8e8e9c;
  --cert: #2f6fd0;
  --pop: #e8b64c;
  --display: "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; }

body {
  background: var(--void);
  color: var(--ink);
  font-family: var(--display);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* ---------- chrome: present, but never competing with the wall ---------- */

.bar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(to bottom, rgba(8, 8, 10, 0.92), rgba(8, 8, 10, 0));
  pointer-events: none;
}

.bar > * { pointer-events: auto; }

.mark {
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
  text-decoration: none;
  color: var(--ink);
}

.mark span { color: var(--mute); font-weight: 400; }

.sorts { display: flex; gap: 0.15rem; margin-left: auto; flex-wrap: wrap; }

.sorts button {
  font: inherit;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--mute);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.sorts button:hover { color: var(--ink); background: rgba(255, 255, 255, 0.1); }
.sorts button[aria-pressed="true"] { color: var(--void); background: var(--ink); border-color: var(--ink); }
.sorts button:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }

/* ---------- the wall ---------- */

.wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(88px, 11vw, 190px), 1fr));
  gap: 0;
  width: 100%;
}

.slab {
  position: relative;
  display: block;
  aspect-ratio: 500 / 787;
  overflow: hidden;
  background: var(--wall);
  border: 0;
  padding: 0;
  cursor: pointer;
  /* Sits above its neighbours when lifted, without reordering anything. */
  transition: transform 0.28s cubic-bezier(0.2, 0.7, 0.3, 1), filter 0.28s, z-index 0s 0.28s;
}

.slab img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1);
}

/*
 * The sweep. A narrow band of light crossing the slab at an angle, the way a
 * lamp crosses real plastic. It lives off-canvas until the slab is active.
 */
.slab::after {
  content: "";
  position: absolute;
  inset: -30%;
  background: linear-gradient(
    104deg,
    transparent 42%,
    rgba(255, 255, 255, 0.22) 48%,
    rgba(255, 255, 255, 0.42) 50%,
    rgba(255, 255, 255, 0.22) 52%,
    transparent 58%
  );
  transform: translateX(-120%);
  opacity: 0;
  pointer-events: none;
}

/* The whole wall steps back so one slab can come forward. */
.wall.focused .slab { filter: brightness(0.32) saturate(0.55); }

.wall.focused .slab.active {
  filter: none;
  transform: scale(1.14);
  z-index: 20;
  transition: transform 0.28s cubic-bezier(0.2, 0.7, 0.3, 1), filter 0.28s;
  box-shadow: 0 1.4rem 3rem rgba(0, 0, 0, 0.65);
}

.slab.active::after { opacity: 1; animation: sweep 0.85s cubic-bezier(0.3, 0, 0.2, 1); }
.slab.active img { transform: scale(1.03); }

@keyframes sweep {
  from { transform: translateX(-120%); }
  to { transform: translateX(120%); }
}

.slab:focus-visible { outline: 2px solid var(--cert); outline-offset: -2px; z-index: 21; }

/* A gold hairline marks the books nothing is graded higher than. */
.slab.top::before {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  background: var(--pop);
  z-index: 2;
  opacity: 0.9;
}

/* ---------- readout: the label structure, in our own voice ---------- */

.readout {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.1rem;
  padding: 0.75rem 1.1rem;
  background: rgba(8, 8, 10, 0.93);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px);
  transform: translateY(102%);
  transition: transform 0.24s cubic-bezier(0.2, 0.7, 0.3, 1);
  pointer-events: none;
}

.readout.on { transform: none; }

.grade {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  padding-right: 1.1rem;
  border-right: 1px solid rgba(255, 255, 255, 0.14);
}

.grade.top { color: var(--pop); }

.who h2 {
  font-size: clamp(0.95rem, 2vw, 1.25rem);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.15;
}

.who p {
  margin-top: 0.18rem;
  font-family: var(--mono);
  font-size: 0.73rem;
  color: var(--mute);
  letter-spacing: 0.01em;
}

.who .census { color: var(--pop); }

.money {
  text-align: right;
  font-family: var(--mono);
  font-size: 0.95rem;
  white-space: nowrap;
}

.money .bin {
  display: block;
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mute);
  margin-top: 0.2rem;
}

.money .none { color: var(--mute); font-size: 0.78rem; }

@media (max-width: 34rem) {
  .readout { grid-template-columns: auto 1fr; gap: 0.7rem; padding: 0.6rem 0.8rem; }
  .money { display: none; }
  .wall.focused .slab.active { transform: scale(1.06); }
}

@media (prefers-reduced-motion: reduce) {
  .slab, .slab img, .readout { transition-duration: 0.01ms; }
  .slab.active::after { animation: none; opacity: 0.18; transform: none; }
  .wall.focused .slab.active { transform: none; }
}
`;

const script = `
const wall = document.getElementById('wall');
const readout = document.getElementById('readout');
const slabs = [...wall.querySelectorAll('.slab')];
let active = null;

function show(slab) {
  if (active === slab) return;
  if (active) active.classList.remove('active');
  active = slab;
  slab.classList.add('active');
  wall.classList.add('focused');

  // textContent throughout: these values come from CGC and contain quotes and
  // punctuation that must never be parsed as markup.
  const d = slab.dataset;
  const grade = document.getElementById('r-grade');
  grade.textContent = d.grade;
  grade.classList.toggle('top', d.top === '1');
  document.getElementById('r-title').textContent = d.title;
  document.getElementById('r-meta').textContent = d.meta;

  const census = document.getElementById('r-census');
  census.textContent = d.census ? ' — ' + d.census : '';
  census.classList.toggle('census', d.top === '1');

  const money = document.getElementById('r-money');
  const amount = document.getElementById('r-amount');
  amount.textContent = d.money || 'no market value';
  amount.classList.toggle('none', !d.money);
  document.getElementById('r-bin').textContent = 'bin ' + d.bin;

  readout.classList.add('on');

  // Swap in the sharper copy only for the slab actually being looked at.
  const img = slab.querySelector('img');
  if (img.dataset.full && img.src !== img.dataset.full) img.src = img.dataset.full;
}

function clear() {
  if (active) active.classList.remove('active');
  active = null;
  wall.classList.remove('focused');
  readout.classList.remove('on');
}

slabs.forEach((slab) => {
  slab.addEventListener('pointerenter', () => show(slab));
  slab.addEventListener('focus', () => show(slab));
  slab.addEventListener('click', () => { window.location.href = slab.dataset.href; });
  slab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = slab.dataset.href; }
  });
});

wall.addEventListener('pointerleave', clear);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { clear(); document.activeElement.blur?.(); } });

/*
 * Sorting reflows the wall. Measure before, reorder, measure after, then play
 * the difference backwards — so eighty covers glide to their new places instead
 * of teleporting. Without this the sort reads as a page reload.
 */
function sortBy(key, button) {
  document.querySelectorAll('.sorts button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));

  const before = new Map(slabs.map((s) => [s, s.getBoundingClientRect()]));
  const dir = key === 'bin' ? 1 : -1;
  const value = (s) => (key === 'bin' ? Number(s.dataset.order) : Number(s.dataset[key] || 0));
  const sorted = [...slabs].sort((a, b) => (value(a) - value(b)) * dir || Number(a.dataset.order) - Number(b.dataset.order));
  sorted.forEach((s) => wall.appendChild(s));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  slabs.forEach((s) => {
    const a = before.get(s);
    const b = s.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (!dx && !dy) return;
    s.animate(
      [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(0.2,0.7,0.3,1)' },
    );
  });
}

document.querySelectorAll('.sorts button').forEach((b) => {
  b.addEventListener('click', () => sortBy(b.dataset.sort, b));
});
`;

export function renderWallPage({ bins, config }) {
  const comics = bins.flatMap((bin) => (bin.comics ?? []).map((comic) => ({ comic, bin: bin.bin })));

  const tiles = comics
    .map(({ comic, bin }, i) => {
      const value = fmvValue(comic) ?? manualValue(comic);
      const top = isTopPop(comic);
      const front = comic.images?.front;

      /*
       * Every data-* value is PLAIN TEXT. An earlier version put markup in these
       * attributes — a styled census span, a money block — and the quotes inside
       * it broke straight out of the attribute, spraying raw HTML across the
       * wall as visible text. The readout builds its own markup from these
       * strings instead, so nothing here can escape its slot.
       */
      const meta = [
        comic.publisher,
        comic.issueYear && comic.issueYear !== '1900' ? comic.issueYear : '',
        comic.pageQuality ? `${comic.pageQuality.toLowerCase()} pages` : '',
        `cert ${comic.cert}`,
      ]
        .filter(Boolean)
        .join(' · ');

      const census = top
        ? `top pop — ${comic.population.atGrade} at ${comic.grade}, none higher`
        : comic.population && typeof comic.population.higher === 'number'
          ? `${comic.population.atGrade} at ${comic.grade} · ${comic.population.higher} higher`
          : '';

      const img = front
        ? `<img src="../covers/${escapeHtml(front)}" data-full="../medium/${escapeHtml(front)}" alt="" loading="eager" decoding="async">`
        : '';

      return `      <button class="slab${top ? ' top' : ''}"
        data-order="${i}"
        data-grade="${escapeHtml(comic.grade ?? '')}"
        data-value="${value ?? 0}"
        data-top="${top ? 1 : 0}"
        data-bin="${escapeHtml(bin)}"
        data-href="../bin/${escapeHtml(bin)}/"
        data-title="${escapeHtml(displayTitle(comic))}"
        data-meta="${escapeHtml(meta)}"
        data-census="${escapeHtml(census)}"
        data-money="${value !== null ? escapeHtml(formatMoney(value)) : ''}"
        aria-label="${escapeHtml(`${displayTitle(comic)}, CGC ${comic.grade}, bin ${bin}`)}">
        ${img}
      </button>`;
    })
    .join('\n');

  const topPops = comics.filter(({ comic }) => isTopPop(comic)).length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The wall — ${escapeHtml(config.collectionName ?? 'Comic Collection')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${css}
</style>
</head>
<body>

<div class="bar">
  <a class="mark" href="../">${escapeHtml(config.collectionName ?? 'Collection')} <span>&mdash; ${comics.length} slabs, ${topPops} top pop</span></a>
  <div class="sorts">
    <button data-sort="bin" aria-pressed="true">Bin</button>
    <button data-sort="grade" aria-pressed="false">Grade</button>
    <button data-sort="value" aria-pressed="false">Value</button>
    <button data-sort="top" aria-pressed="false">Top pop</button>
  </div>
</div>

<main class="wall" id="wall">
${tiles}
</main>

<aside class="readout" id="readout" aria-live="polite">
  <div class="grade" id="r-grade"></div>
  <div class="who">
    <h2 id="r-title"></h2>
    <p><span id="r-meta"></span><span id="r-census"></span></p>
  </div>
  <div class="money" id="r-money">
    <span id="r-amount"></span>
    <span class="bin" id="r-bin"></span>
  </div>
</aside>

<script>
${script}
</script>
</body>
</html>
`;
}
