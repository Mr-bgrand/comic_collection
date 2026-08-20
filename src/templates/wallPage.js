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
  /*
   * No container perspective. It sounds right, but a vanishing point fixed to a
   * 2500px-tall grid shifts every slab vertically by its distance from that
   * point, so where a raised slab actually lands stops being predictable and the
   * clamp that keeps it on screen cannot be computed. Each slab carries its own
   * perspective instead, which pivots about its own centre.
   */
  /* Clearance so the readout never covers the last row of slabs. */
  padding-bottom: 5.5rem;
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
  transform-style: preserve-3d;
  /* Sits above its neighbours when lifted, without reordering anything. */
  transition: transform 0.34s cubic-bezier(0.2, 0.7, 0.3, 1), filter 0.34s, z-index 0s 0.34s;
}

/*
 * Ambient drift, on the image rather than the slab.
 *
 * The slab's own transform is spoken for twice over — by the hover tilt and by
 * the FLIP sort — so a third animation there would fight both. Moving the idle
 * motion inward keeps the wall breathing without touching the transform that
 * sorting animates.
 */
.slab img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  animation: drift 9s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.19s);
  will-change: transform;
}

@keyframes drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1.02); }
  50% { transform: translate3d(0, -6px, 0) scale(1.02); }
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

/*
 * The wall steps back, but only a little.
 *
 * The torch below is what actually creates the darkness, and the two multiply.
 * At brightness(0.1) plus the overlay the whole page went black and stopped
 * reading as a collection at all — you could no longer see what you were moving
 * across. The filter now only desaturates and softens; distance from the pointer
 * does the rest.
 */
.wall.focused .slab { filter: brightness(0.55) saturate(0.7); }

/*
 * The lift. --rx/--ry are written by the pointer, so the slab tips toward
 * wherever you are on it — the gesture of picking one up and angling it at a
 * lamp. The sheen below tracks the same position, so light and tilt agree.
 */
/*
 * Big enough to actually read. At a tile's natural ~180px you can see which
 * comic it is but not the cover; at 1.75x plus the perspective gain it comes up
 * near 340px, where the art and the label both become legible. The lift is
 * clamped in JS so it never leaves the viewport at either end.
 */
.wall.focused .slab.active {
  /* Slightly hotter than neutral: the one thing standing in the light. */
  filter: brightness(1.12) saturate(1.05);
  transform:
    perspective(1100px)
    translate3d(0, var(--ty, -10px), 0)
    scale(var(--lift, 1.75))
    rotateX(calc(var(--rx, 0) * 1deg))
    rotateY(calc(var(--ry, 0) * 1deg));
  z-index: 20;
  transition: transform 0.22s cubic-bezier(0.2, 0.7, 0.3, 1), filter 0.3s;
  box-shadow:
    0 2.5rem 6rem rgba(0, 0, 0, 0.9),
    0 0 0 1px rgba(255, 255, 255, 0.14),
    0 0 6rem rgba(232, 182, 76, 0.07);
}

.slab.active::after {
  opacity: 1;
  /* Sheen sits under the pointer instead of crossing on a fixed path. */
  transform: translateX(calc(var(--sheen, 0) * 1%));
  transition: transform 0.12s linear;
  animation: none;
}

@keyframes sweep {
  from { transform: translateX(-120%); }
  to { transform: translateX(120%); }
}

/*
 * The spotlight: a hole punched in a near-opaque sheet, following the pointer.
 * Everything outside the pool is genuinely dark rather than dimmed, which is
 * what makes moving across the wall feel like carrying a light over it.
 */
.torch {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.35s ease;
  background: radial-gradient(
    circle var(--r, 460px) at var(--mx, 50%) var(--my, 50%),
    rgba(8, 8, 10, 0) 0%,
    rgba(8, 8, 10, 0.15) 30%,
    rgba(8, 8, 10, 0.72) 70%,
    rgba(8, 8, 10, 0.93) 100%
  );
}

body.lit .torch { opacity: 1; }

/*
 * The bloom. The torch only removes darkness; this adds light, so the pool reads
 * as a lamp shining on the wall rather than a hole cut in a black sheet. Screen
 * blending means it lifts what is already there instead of washing it out.
 */
.bloom {
  position: fixed;
  inset: 0;
  z-index: 11;
  pointer-events: none;
  opacity: 0;
  mix-blend-mode: screen;
  transition: opacity 0.4s ease;
  background: radial-gradient(
    circle 300px at var(--mx, 50%) var(--my, 50%),
    rgba(255, 236, 205, 0.1) 0%,
    rgba(255, 226, 180, 0.04) 45%,
    rgba(0, 0, 0, 0) 75%
  );
}

body.lit .bloom { opacity: 1; }

/*
 * Film grain, always on and barely there. Digital scans of glossy plastic read
 * a little clinical; a fine grain gives the wall a photographed quality. Static
 * rather than animated — moving noise is a vestibular problem and reads as
 * cheap.
 */
.grain {
  position: fixed;
  inset: 0;
  z-index: 12;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* A permanent vignette: the wall should feel lit from the middle, not flat. */
.vignette {
  position: fixed;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background: radial-gradient(
    ellipse 120% 90% at 50% 45%,
    rgba(0, 0, 0, 0) 55%,
    rgba(0, 0, 0, 0.45) 100%
  );
}

/*
 * Touch gets a different, cheaper build of the same idea.
 *
 * A spotlight that cannot move is just a dark page, so the torch and bloom go.
 * More importantly the desktop version leans on things that are expensive on
 * mobile Safari: a CSS filter on every one of eighty slabs, eighty simultaneous
 * drift animations, and a backdrop-filter on a fixed bar. Together they make the
 * wall stutter badly on iOS.
 *
 * So touch dims with ONE compositor layer — a scrim beneath the raised slab —
 * instead of eighty filters, and holds the covers still.
 */
@media (hover: none), (pointer: coarse) {
  .torch, .bloom { display: none; }
  .slab img { animation: none; }
  .wall.focused .slab { filter: none; }
  .readout { backdrop-filter: none; background: rgba(8, 8, 10, 0.97); }
}

.scrim {
  position: fixed;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  opacity: 0;
  background: rgba(6, 6, 8, 0.86);
  transition: opacity 0.28s ease;
}

/* Only touch uses it; fine pointers already have the torch. */
@media (hover: hover) and (pointer: fine) {
  .scrim { display: none; }
}

body.lit .scrim { opacity: 1; }

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

/*
 * Phone chrome.
 *
 * At full size the header wrapped to two lines and the four sort buttons spilled
 * onto a second row, both sitting on top of the covers. The collection summary
 * is the first thing to go — it is already on the page it links to — and
 * everything else shrinks to hold one line.
 */
@media (max-width: 34rem) {
  .bar { padding: 0.5rem 0.6rem; gap: 0.5rem; }
  .mark { font-size: 0.8rem; }
  .mark span { display: none; }
  .sorts { gap: 0.12rem; flex-wrap: nowrap; }
  .sorts button {
    font-size: 0.6rem;
    padding: 0.26rem 0.4rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .readout { grid-template-columns: auto 1fr; gap: 0.7rem; padding: 0.55rem 0.75rem; }
  .money { display: none; }
  .grade { font-size: 1.45rem; padding-right: 0.7rem; }
  .who h2 { font-size: 0.88rem; line-height: 1.2; }
  .who p { font-size: 0.63rem; line-height: 1.35; }
}

@media (prefers-reduced-motion: reduce) {
  .slab, .readout { transition-duration: 0.01ms; }
  .slab img { animation: none; transform: none; }
  .slab.active::after { opacity: 0.14; transform: none; transition: none; }
  /* Keep the emphasis, drop the movement: brightness still says which one. */
  .wall.focused .slab.active { transform: none; }
  .torch { transition: none; }
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
  document.body.classList.add('lit');

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

  /*
   * Lift far enough to clear the readout when the slab sits low in the viewport.
   * The readout is fixed to the bottom, so without this the one slab you are
   * looking at is the one partly hidden.
   */
  /*
   * Position the lift from the slab's UNTRANSFORMED box.
   *
   * Reading the rect after the active class lands would measure it mid-
   * transition and give a different answer every time. offsetTop/offsetHeight
   * are layout values, unaffected by transforms, so the maths is stable.
   *
   * Scaling happens about the centre, so growing by LIFT adds half the extra
   * height at each end; both ends are then clamped into the viewport.
   */
  // Matches scale() in the CSS exactly, now that perspective is per-element and
  // adds no magnification of its own.
  const LIFT = 1.75;
  const top = slab.getBoundingClientRect().top;
  const h = slab.offsetHeight;
  const grow = ((LIFT - 1) * h) / 2;

  const lowest = window.innerHeight - 96;   // above the readout
  const highest = 58;                        // below the top bar
  let ty = -10;
  if (top + h + grow + ty > lowest) ty = lowest - (top + h + grow);
  if (top - grow + ty < highest) ty = highest - (top - grow);
  // Plain concatenation: a backtick here would close the template literal this
  // whole script is embedded in, and the loss is silent — the build still
  // succeeds and only this statement goes missing.
  slab.style.setProperty('--ty', String(Math.round(ty)) + 'px');

  // Swap in the sharper copy only for the slab actually being looked at.
  const img = slab.querySelector('img');
  if (img.dataset.full && img.src !== img.dataset.full) img.src = img.dataset.full;
}

function clear() {
  if (active) {
    // Reset the tilt, or the slab keeps whatever angle it was left at.
    active.style.removeProperty('--rx');
    active.style.removeProperty('--ry');
    active.style.removeProperty('--sheen');
    active.style.removeProperty('--ty');
    active.classList.remove('active');
  }
  active = null;
  wall.classList.remove('focused');
  document.body.classList.remove('lit');
  readout.classList.remove('on');
}

/*
 * Pointer drives three things at once: where the torch pool sits, how far the
 * active slab tips, and where the sheen falls. They share one rAF-throttled
 * handler so they can never disagree by a frame — a highlight that lags the
 * tilt reads as a bug rather than as light.
 */
/*
 * Start from what the browser claims, then believe what actually happens.
 *
 * Media queries are a guess: some devices report a fine pointer while having no
 * mouse at all, and hybrids have both. The first real touch is proof, so it
 * switches to the touch behaviour permanently. Handlers therefore read the flag at
 * call time rather than being bound differently at load.
 */
let fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
window.addEventListener('touchstart', () => { fine = false; }, { once: true, passive: true });

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let pending = null;

function paint(x, y) {
  document.body.style.setProperty('--mx', x + 'px');
  document.body.style.setProperty('--my', y + 'px');

  if (!active || still) return;
  const r = active.getBoundingClientRect();
  const px = (x - r.left) / r.width;   // 0 at left edge, 1 at right
  const py = (y - r.top) / r.height;
  // Tip away from the pointer, as a held object does.
  active.style.setProperty('--ry', ((px - 0.5) * 16).toFixed(2));
  active.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2));
  active.style.setProperty('--sheen', ((px - 0.5) * 150).toFixed(1));
}

window.addEventListener('pointermove', (e) => {
  if (!fine || pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    paint(e.clientX, e.clientY);
  });
}, { passive: true });

/*
 * Touch has no hover, so a single tap cannot both reveal and navigate.
 *
 * Binding hover-to-show on touch meant the first tap raised the slab and
 * immediately followed the link — you could never actually look at a cover. So
 * on touch the first tap raises it and the second opens its bin, which is the
 * ordinary two-tap idiom and needs no explaining.
 */
slabs.forEach((slab) => {
  slab.addEventListener('pointerenter', () => { if (fine) show(slab); });

  /*
   * Keyboard focus only. Tapping a button also focuses it, so an unconditional
   * focus handler raised the slab before the click handler ran — which then saw
   * it as already active and followed the link, defeating two-tap entirely.
   * :focus-visible is exactly the distinction between "reached by keyboard" and
   * "just tapped".
   */
  slab.addEventListener('focus', () => {
    if (slab.matches(':focus-visible')) show(slab);
  });

  slab.addEventListener('click', (e) => {
    if (!fine && active !== slab) {
      e.preventDefault();
      show(slab);
      return;
    }
    window.location.href = slab.dataset.href;
  });

  slab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = slab.dataset.href; }
  });
});

wall.addEventListener('pointerleave', () => { if (fine) clear(); });

// Tapping the background puts the wall back, the way tapping outside a sheet does.
document.addEventListener('click', (e) => {
  if (!fine && !e.target.closest('.slab')) clear();
});
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

      return `      <button class="slab${top ? ' top' : ''}" style="--i:${i}"
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

<div class="vignette" aria-hidden="true"></div>
<div class="scrim" aria-hidden="true"></div>
<div class="torch" aria-hidden="true"></div>
<div class="bloom" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>

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
