/**
 * The collection dashboard.
 *
 * Form choices follow from what each number's job is:
 *   - Total value, comic count, top pop are single headline numbers, so they are
 *     stat tiles, not charts. A one-bar bar chart is a stat tile with extra steps.
 *   - Grade spread compares magnitude across ordered categories, so: bars, one
 *     hue, direct-labeled.
 *   - Value by bin only appears once there are two or more bins to compare.
 *   - The table is the accessible twin of every chart — no value is chart-only.
 *
 * One data hue throughout. Two near-identical ambers failed CVD separation
 * (ΔE 7.8), and the fix was to stop encoding two things in amber rather than to
 * excuse the pair.
 */

import {
  displayTitle,
  isTopPop,
  fmvValue,
  formatMoney,
  collectionStats,
  gradeDistribution,
  valueByBin,
} from '../model.js';
import { escapeHtml, page, FONT_SANS, FONT_MONO } from './shared.js';

const css = `
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

/* Cert -> CGC verification, FMV -> the book's GoCollect page. */
td.cert a,
td.fmv a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-underline-offset: 2px;
}

td.fmv a { color: var(--data); font-weight: 600; }

td.cert a:hover,
td.fmv a:hover { color: var(--data); text-decoration-color: currentColor; }

@media (max-width: 40rem) {
  .hide-sm { display: none; }
}
`;

const script = `
const table = document.getElementById('inventory');
if (table) {
  const tbody = table.tBodies[0];
  const rows = [...tbody.rows];
  let active = null;
  let asc = true;

  table.querySelectorAll('th').forEach((th, col) => {
    th.addEventListener('click', () => {
      asc = active === col ? !asc : true;
      active = col;

      table.querySelectorAll('th').forEach((h) => {
        h.removeAttribute('aria-sort');
        const a = h.querySelector('.arrow');
        if (a) a.textContent = '';
      });
      th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
      const arrow = th.querySelector('.arrow');
      if (arrow) arrow.textContent = asc ? ' \\u2191' : ' \\u2193';

      const numeric = th.dataset.type === 'number';
      rows.sort((a, b) => {
        const x = a.cells[col].dataset.sort ?? a.cells[col].textContent.trim();
        const y = b.cells[col].dataset.sort ?? b.cells[col].textContent.trim();
        const cmp = numeric
          ? (Number(x) || 0) - (Number(y) || 0)
          : x.localeCompare(y, 'en', { numeric: true });
        return asc ? cmp : -cmp;
      });
      rows.forEach((r) => tbody.appendChild(r));
    });
  });
}
`;

function barChart(rows, { max, format }) {
  const ceiling = max || 1;
  return rows
    .map(
      (r) => `      <div class="bar-row" title="${escapeHtml(`${r.label}: ${format(r.value)}`)}">
        <span class="cat">${escapeHtml(r.label)}</span>
        <span class="track"><span class="fill" style="width:${Math.max(
          (r.value / ceiling) * 100,
          0.6,
        ).toFixed(1)}%"></span></span>
        <span class="val">${escapeHtml(format(r.value))}</span>
      </div>`,
    )
    .join('\n');
}

export function renderDashboard({ bins, config }) {
  const stats = collectionStats(bins);
  const grades = gradeDistribution(bins);
  const byBin = valueByBin(bins);

  const asOf = stats.oldestFmv ? stats.oldestFmv.slice(0, 10) : null;

  const comics = bins.flatMap((bin) =>
    (bin.comics ?? []).map((comic) => ({ comic, bin: bin.bin })),
  );

  const rows = comics
    .map(({ comic, bin }) => {
      const value = fmvValue(comic);
      const cert = comic.cert ?? '';

      // The cert number and the price are themselves the links — a separate
      // "links" column repeated the same two destinations on every row.
      const certCell = cert
        ? `<a href="https://www.cgccomics.com/certlookup/${escapeHtml(
            cert,
          )}/" target="_blank" rel="noopener">${escapeHtml(cert)}</a>`
        : '';

      let fmvCell = '<span class="dim">—</span>';
      if (value !== null) {
        const money = escapeHtml(formatMoney(value));
        fmvCell = comic.fmv?.url
          ? `<a href="${escapeHtml(comic.fmv.url)}" target="_blank" rel="noopener">${money}</a>`
          : money;
      }

      return `        <tr>
          <td class="t-title">${escapeHtml(displayTitle(comic))}</td>
          <td class="num" data-sort="${escapeHtml(comic.grade ?? '')}">${escapeHtml(
            comic.grade ?? '',
          )}${isTopPop(comic) ? ' <span class="star">★</span>' : ''}</td>
          <td class="num fmv" data-sort="${value ?? -1}">${fmvCell}</td>
          <td class="num">${escapeHtml(bin)}</td>
          <td class="cert hide-sm">${certCell}</td>
        </tr>`;
    })
    .join('\n');

  const maxGrade = Math.max(...grades.map((g) => g.count), 1);

  // Only compare bins once there is something to compare them against.
  const binSection =
    bins.length > 1
      ? `<section>
    <h2>Value by bin</h2>
    <div class="chart">
${barChart(
  byBin.map((b) => ({ label: `Bin ${b.bin}`, value: b.value })),
  { max: Math.max(...byBin.map((b) => b.value), 1), format: formatMoney },
)}
    </div>
  </section>`
      : '';

  const pricedNotice =
    stats.priced === 0
      ? `<p class="notice">No fair market values yet. Sign in once with <code>npm run login</code>, then run <code>npm run fmv</code> to pull values from GoCollect.</p>`
      : stats.unpriced > 0
        ? `<p class="notice">${stats.unpriced} of ${stats.comics} books have no fair market value yet — run <code>npm run fmv</code> to fill them in.</p>`
        : '';

  const body = `<div class="wrap">
  <a class="crumb" href="./">&larr; ${escapeHtml(config.collectionName ?? 'Collection')}</a>
  <h1>Dashboard</h1>
  <p class="asof">${stats.comics} CGC-graded comics across ${stats.bins} bin${
    stats.bins === 1 ? '' : 's'
  }${asOf ? ` &middot; values as of ${escapeHtml(asOf)}` : ''}</p>

  <div class="kpis">
    <div class="kpi hero">
      <div class="label">Total value</div>
      <div class="value">${escapeHtml(stats.priced ? formatMoney(stats.totalValue) : '—')}</div>
      <div class="sub">${
        stats.priced ? `across ${stats.priced} priced book${stats.priced === 1 ? '' : 's'}` : 'not yet priced'
      }</div>
    </div>
    <div class="kpi">
      <div class="label">Comics</div>
      <div class="value">${stats.comics}</div>
      <div class="sub">in ${stats.bins} bin${stats.bins === 1 ? '' : 's'}</div>
    </div>
    <div class="kpi">
      <div class="label">Top pop</div>
      <div class="value">${stats.topPop}</div>
      <div class="sub">none graded higher</div>
    </div>
    <div class="kpi">
      <div class="label">Avg value</div>
      <div class="value">${escapeHtml(
        stats.priced ? formatMoney(stats.totalValue / stats.priced) : '—',
      )}</div>
      <div class="sub">per priced book</div>
    </div>
  </div>

  ${pricedNotice}

  <section>
    <h2>Grade spread</h2>
    <div class="chart">
${barChart(
  grades.map((g) => ({ label: g.grade, value: g.count })),
  { max: maxGrade, format: (v) => String(v) },
)}
    </div>
  </section>

  ${binSection}

  <section>
    <h2>Every book</h2>
    <div class="tablewrap">
      <table id="inventory">
        <thead>
          <tr>
            <th>Title<span class="arrow"></span></th>
            <th class="num" data-type="number">Grade<span class="arrow"></span></th>
            <th class="num" data-type="number">FMV<span class="arrow"></span></th>
            <th class="num" data-type="number">Bin<span class="arrow"></span></th>
            <th class="hide-sm">Cert<span class="arrow"></span></th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
  </section>
</div>

<script>
${script}
</script>`;

  return page({ title: `Dashboard — ${config.collectionName ?? 'Comic Collection'}`, css, body });
}
