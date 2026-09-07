# Actual theme tokens

Light: background #fbfbfa, surface #ffffff, ink #16161a, muted #5f5f6b, line #e4e4e8, accent #a1601a. Dark: background #121215, surface #1b1b20, ink #ececf0, muted #9d9daa, line #2c2c34, accent #e0a75e. System sans and monospace for records. Home measure 46rem; bin 44rem; dashboard 60rem. Inputs radius 8px. Body 1.5 line-height. Dark follows OS preference. Wall and 3D use distinct dark, amber-accented theme and Google font imports. No Tailwind config or global CSS file.

### src/templates/shared.js

```js
/** Shared helpers and design tokens for every generated page. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * System stacks only — no webfonts. Print has to be byte-identical offline, and
 * a label printed in five years should not depend on a font CDN still existing.
 */
export const FONT_SANS =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const FONT_NARROW =
  '"Helvetica Neue Condensed", "Arial Narrow", "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** Ink-economical near-black; pure #000 prints heavy and reads harsh on screen. */
export const INK = '#16161a';

export function page({ title, css, body, lang = 'en' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

```
### src/templates/indexPage.js inline CSS

```css

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

.dash-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.dash-link:hover { text-decoration: underline; }

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

```

### src/templates/dashboard.js inline CSS

```css

:root {
  --bg: #fbfbfa;
  --surface: #ffffff;
  --ink: #16161a;
  --muted: #5f5f6b;
  --faint: #8b8b98;
  --line: #e4e4e8;
  --hairline: #eeeef1;
  --data: #a1601a;
  --data-soft: #f0e2cf;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121215;
    --surface: #1b1b20;
    --ink: #ececf0;
    --muted: #9d9daa;
    --faint: #7a7a88;
    --line: #2c2c34;
    --hairline: #24242b;
    --data: #e0a75e;
    --data-soft: #3a2f21;
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

.wrap { max-width: 60rem; margin: 0 auto; padding: 2.2rem 1.1rem 5rem; }

a { color: inherit; }

.crumb { font-size: 0.85rem; color: var(--muted); text-decoration: none; }
.crumb:hover { color: var(--data); }

h1 {
  margin-top: 0.8rem;
  font-size: clamp(1.9rem, 6vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.asof { margin-top: 0.3rem; color: var(--muted); font-size: 0.9rem; }

/* ---------- KPI row: headline numbers, not charts ---------- */

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 1px;
  margin: 1.8rem 0 0.6rem;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.kpi { background: var(--surface); padding: 1rem 1.1rem; }

.kpi .label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

/* Proportional figures on display numbers — tabular digits read loose at size. */
.kpi .value {
  margin-top: 0.3rem;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.kpi.hero .value { font-size: clamp(2.2rem, 6vw, 3rem); color: var(--data); }
.kpi .sub { margin-top: 0.15rem; font-size: 0.78rem; color: var(--faint); }

.notice {
  margin: 0.9rem 0 0;
  padding: 0.7rem 0.9rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 3px solid var(--data);
  border-radius: 6px;
  font-size: 0.88rem;
  color: var(--muted);
}

.notice code {
  font-family: ${FONT_MONO};
  font-size: 0.85em;
  color: var(--ink);
}

/* ---------- charts ---------- */

section { margin-top: 2.6rem; }

h2 {
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--ink);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.chart { margin-top: 1rem; }

/* 2px surface gap between adjacent bars, not borders. */
.bar-row {
  display: grid;
  grid-template-columns: 3.2rem 1fr auto;
  align-items: center;
  gap: 0.7rem;
  padding: 2px 0;
}

.bar-row .cat {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  text-align: right;
}

/*
 * Both of these must be block boxes. As a grid item .track is blockified
 * automatically, but .fill sits inside it — not in a grid — so without an
 * explicit display it stays inline, silently ignores width/height, and every bar
 * renders full width regardless of its value.
 */
.track {
  display: block;
  background: var(--hairline);
  border-radius: 4px;
  height: 0.72rem;
  overflow: hidden;
}

/* Thin mark, rounded data-end, anchored to the baseline at left. */
.fill {
  display: block;
  height: 100%;
  background: var(--data);
  border-radius: 4px;
  min-width: 3px;
  transition: opacity 0.12s;
}

.bar-row:hover .fill { opacity: 0.82; }

.bar-row .val {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 3.2rem;
}

/* ---------- table: the accessible twin of every chart ---------- */

.tablewrap { margin-top: 1rem; overflow-x: auto; }

table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }

th {
  padding: 0.5rem 0.6rem 0.5rem 0;
  border-bottom: 1px solid var(--ink);
  text-align: left;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

th:hover { color: var(--data); }
th[aria-sort] { color: var(--ink); }
th .arrow { opacity: 0.45; font-size: 0.9em; }

td {
  padding: 0.5rem 0.6rem 0.5rem 0;
  border-bottom: 1px solid var(--hairline);
  vertical-align: top;
}

tbody tr:hover { background: var(--surface); }

.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cert { font-family: ${FONT_MONO}; font-size: 0.82rem; color: var(--muted); }
.star { color: var(--data); }
.dim { color: var(--faint); }
.t-title { font-weight: 600; }

.titlecell { display: flex; align-items: center; gap: 0.6rem; }

/* Row thumbnail. The enlarged preview is a child so hover/focus reveals it. */
.thumb {
  position: relative;
  flex: none;
  width: 1.6rem;
  display: block;
  cursor: zoom-in;
}

.thumb > img {
  width: 1.6rem;
  aspect-ratio: 500 / 787;
  object-fit: cover;
  display: block;
  border-radius: 2px;
  border: 1px solid var(--line);
  background: var(--surface);
}

.thumb-none {
  width: 1.6rem;
  aspect-ratio: 500 / 787;
  border: 1px dashed var(--line);
  border-radius: 2px;
}

.pop {
  position: absolute;
  z-index: 20;
  top: 50%;
  left: calc(100% + 0.5rem);
  transform: translateY(-50%) scale(0.96);
  width: 15rem;
  padding: 0.3rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.12s ease, transform 0.12s ease;
  pointer-events: none;
}

.pop img { width: 100%; display: block; border-radius: 4px; }

.thumb:hover .pop,
.thumb:focus-visible .pop,
.thumb.open .pop {
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) scale(1);
}

/* Rows near the bottom would push the preview off-screen, so flip it upward. */
.thumb.flip-up .pop { top: auto; bottom: -0.5rem; transform: none; }
.thumb.flip-up:hover .pop,
.thumb.flip-up:focus-visible .pop,
.thumb.flip-up.open .pop { transform: none; }

@media (max-width: 44rem) {
  .pop { width: 11rem; left: calc(100% + 0.3rem); }
}

@media (prefers-reduced-motion: reduce) {
  .pop { transition: none; }
}

/* Cert -> CGC verification, FMV -> the book's GoCollect page. */
td.cert a,
td.fmv a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-underline-offset: 2px;
}

td.fmv a { color: var(--data); font-weight: 600; }
td.fmv a.nosale { color: var(--faint); font-weight: 400; font-size: 0.82rem; }

/* Estimates read as estimates — different weight, and an explicit marker. */
td.fmv .est { color: var(--muted); font-weight: 500; }

.est-mark {
  margin-left: 0.25rem;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--faint);
  vertical-align: 0.1em;
}

td.cert a:hover,
td.fmv a:hover { color: var(--data); text-decoration-color: currentColor; }

@media (max-width: 40rem) {
  .hide-sm { display: none; }
}

```

### src/templates/binPage.js inline CSS

```css

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

a.cert {
  font-family: ${FONT_MONO};
  font-size: 0.82rem;
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-underline-offset: 2px;
}

a.cert:hover { color: var(--accent); text-decoration-color: currentColor; }

.fmv { margin-top: 0.5rem; font-size: 0.95rem; font-weight: 700; }

.fmv a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.fmv-meta { font-weight: 400; font-size: 0.8rem; color: var(--muted); }
.fmv a.nosale { color: var(--muted); font-weight: 500; }

.pop { color: var(--star); font-weight: 600; }

.warn {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--accent);
}

@media (max-width: 30rem) {
  .comic { grid-template-columns: 7.2rem 1fr; gap: 0.75rem; }

  /*
   * Front cover full width, back stacked beneath it and smaller.
   *
   * These were side by side, which halved the front cover on exactly the device
   * the QR code is meant for — the front is the image you want when you scan a
   * bin, and the back is supporting detail. Before that they were hidden
   * entirely below this width, which was worse. Neither is right: the front
   * needs the room, the back just needs to be reachable.
   */
  .scans { flex-direction: column; gap: 0.35rem; }
  .scans img { width: 100%; flex: none; }
  .scans img:nth-child(2) { width: 62%; }
}

```

### src/templates/wallPage.js inline CSS

```css

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

/* The door to the experimental room, gold so it reads as an invitation. */
.vault {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pop);
  background: rgba(232, 182, 76, 0.09);
  border: 1px solid rgba(232, 182, 76, 0.4);
  padding: 0.3rem 0.6rem;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}

.vault:hover { color: var(--void); background: var(--pop); }
.vault:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }

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
  .sorts button, .vault {
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

```

### src/templates/wall3dPage.js inline CSS

```css

:root {
  --void: #08080a;
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
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* The scene owns the whole viewport; everything else floats above it. */
#scene {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  outline: none;
}

#scene:focus-visible { outline: 2px solid var(--cert); outline-offset: -2px; }

/* ---------- chrome, borrowed wholesale from the flat wall ---------- */

.bar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(to bottom, rgba(8, 8, 10, 0.92), rgba(8, 8, 10, 0));
  pointer-events: none;
  flex-wrap: wrap;
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

.modes, .sorts { display: flex; gap: 0.15rem; }

.modes { margin-left: auto; }

.modes button, .sorts button, .flat {
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
  text-decoration: none;
}

.modes button:hover, .sorts button:hover, .flat:hover { color: var(--ink); background: rgba(255, 255, 255, 0.1); }
.modes button[aria-pressed="true"] { color: var(--void); background: var(--pop); border-color: var(--pop); }
.sorts button[aria-pressed="true"] { color: var(--void); background: var(--ink); border-color: var(--ink); }
.modes button:focus-visible, .sorts button:focus-visible, .flat:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }

/* A thin gold line at the very top is the whole loading UI. */
.progress {
  position: fixed;
  inset: 0 auto auto 0;
  height: 2px;
  width: 0%;
  z-index: 50;
  background: var(--pop);
  opacity: 0.9;
  transition: width 0.25s ease, opacity 0.6s ease 0.3s;
  pointer-events: none;
}

.hint {
  position: fixed;
  bottom: 0.9rem;
  left: 1.1rem;
  z-index: 25;
  font-family: var(--mono);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  color: var(--mute);
  opacity: 0;
  transition: opacity 1s ease;
  pointer-events: none;
}

.hint.on { opacity: 0.85; }

/* ---------- atmosphere: same grain and vignette as the flat wall ---------- */

.grain {
  position: fixed;
  inset: 0;
  z-index: 12;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

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

/* ---------- readout: identical structure to the flat wall ---------- */

.readout {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
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
 * Riffle arrows, shown only while a book is in hand. On a keyboard the arrow
 * keys do this; on touch these are the only way to flip to the neighbouring
 * book without putting this one back first.
 */
.nav {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 35;
  width: 3rem;
  height: 6rem;
  display: grid;
  place-items: center;
  font: 400 2.1rem var(--mono);
  line-height: 1;
  color: var(--mute);
  background: rgba(8, 8, 10, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, color 0.15s, background 0.15s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  padding: 0;
}

body.holding .nav { opacity: 1; pointer-events: auto; }
.nav:hover { color: var(--pop); background: rgba(8, 8, 10, 0.8); }
.nav:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }
.nav.prev { left: 0.6rem; }
.nav.next { right: 0.6rem; }

/* Appears only while a slab is held out; the one clickable thing down here. */
.go {
  display: none;
  pointer-events: auto;
  font-family: var(--mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--void);
  background: var(--pop);
  border: 1px solid var(--pop);
  padding: 0.45rem 0.7rem;
  text-decoration: none;
  white-space: nowrap;
}

.readout.held .go { display: block; }
.go:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }

/* ---------- boot and failure states ---------- */

.boot {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: var(--void);
  transition: opacity 0.7s ease;
}

.boot.gone { opacity: 0; pointer-events: none; }

.boot p {
  font-family: var(--mono);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mute);
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

.fallback {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  text-align: center;
  background: var(--void);
  padding: 2rem;
}

.fallback[hidden] { display: none; }

.fallback h1 { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }

.fallback p { margin-top: 0.6rem; color: var(--mute); font-size: 0.9rem; max-width: 26rem; }

.fallback a { color: var(--pop); }

@media (max-width: 34rem) {
  .bar { padding: 0.5rem 0.6rem; gap: 0.4rem; }
  .mark { font-size: 0.8rem; }
  .mark span { display: none; }
  .modes { margin-left: 0; }
  .modes button, .sorts button, .flat { font-size: 0.6rem; padding: 0.26rem 0.4rem; letter-spacing: 0.03em; }
  .hint { display: none; }
  .readout { grid-template-columns: auto 1fr auto; gap: 0.7rem; padding: 0.55rem 0.75rem; }
  .money { display: none; }
  .grade { font-size: 1.45rem; padding-right: 0.7rem; }
  .who h2 { font-size: 0.88rem; line-height: 1.2; }
  .who p { font-size: 0.63rem; line-height: 1.35; }
}

@media (prefers-reduced-motion: reduce) {
  .readout { transition-duration: 0.01ms; }
  .boot p { animation: none; }
}

```
