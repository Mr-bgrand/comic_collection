/**
 * The local editor's page. Lists the books with no market value first — those are
 * the actual gap — then everything else, so a market figure can be overridden if
 * you disagree with it.
 */

import { displayTitle, isTopPop, fmvValue, manualValue, formatMoney } from '../model.js';
import { escapeHtml, page, FONT_SANS, FONT_MONO } from './shared.js';

const css = `
:root {
  --bg: #fbfbfa; --surface: #fff; --ink: #16161a; --muted: #5f5f6b;
  --faint: #8b8b98; --line: #e4e4e8; --hairline: #eeeef1;
  --data: #a1601a; --ok: #2f6b3f;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121215; --surface: #1b1b20; --ink: #ececf0; --muted: #9d9daa;
    --faint: #7a7a88; --line: #2c2c34; --hairline: #24242b;
    --data: #e0a75e; --ok: #7fc08f;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: ${FONT_SANS}; background: var(--bg); color: var(--ink);
  line-height: 1.5;
}
.wrap { max-width: 62rem; margin: 0 auto; padding: 2rem 1.1rem 5rem; }
h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; }
.lede { margin-top: 0.35rem; color: var(--muted); font-size: 0.92rem; }
.lede code { font-family: ${FONT_MONO}; font-size: 0.85em; color: var(--ink); }

h2 {
  margin-top: 2.2rem; padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--ink);
  font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em;
}
h2 .n { color: var(--muted); letter-spacing: 0; text-transform: none; }

table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-top: 0.5rem; }
th {
  padding: 0.45rem 0.5rem 0.45rem 0; text-align: left;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--muted); border-bottom: 1px solid var(--line); white-space: nowrap;
}
td {
  padding: 0.4rem 0.5rem 0.4rem 0;
  border-bottom: 1px solid var(--hairline); vertical-align: middle;
}
.title { font-weight: 600; }
.sub { font-size: 0.78rem; color: var(--faint); font-family: ${FONT_MONO}; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.market { color: var(--data); font-weight: 600; }
.none { color: var(--faint); }
.star { color: var(--data); }

input {
  font: inherit; font-size: 0.87rem; color: var(--ink);
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 6px; padding: 0.3rem 0.45rem;
}
input:focus { outline: 2px solid var(--data); outline-offset: 1px; border-color: transparent; }
input.val { width: 5.5rem; text-align: right; font-variant-numeric: tabular-nums; }
input.note { width: 100%; min-width: 10rem; }

tr.saved { background: color-mix(in oklab, var(--ok) 12%, transparent); }
.status { font-size: 0.78rem; color: var(--ok); min-width: 4rem; display: inline-block; }
.status.err { color: #b4392f; }
`;

const script = `
async function save(row) {
  const cert = row.dataset.cert;
  const value = row.querySelector('.val').value.trim();
  const note = row.querySelector('.note').value.trim();
  const status = row.querySelector('.status');
  status.textContent = 'saving…';
  status.classList.remove('err');
  try {
    const res = await fetch('/api/value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert, value, note }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.status);
    status.textContent = body.manual && body.manual.value != null ? 'saved' : 'cleared';
    row.classList.add('saved');
    setTimeout(() => row.classList.remove('saved'), 1200);
  } catch (err) {
    status.textContent = 'failed';
    status.classList.add('err');
    console.error(err);
  }
}

document.querySelectorAll('tr[data-cert]').forEach((row) => {
  row.querySelectorAll('input').forEach((input) => {
    // Save on blur, and on Enter for keyboard-only entry.
    input.addEventListener('change', () => save(row));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
  });
});
`;

function row(comic, bin) {
  const market = fmvValue(comic);
  const manual = manualValue(comic);
  return `        <tr data-cert="${escapeHtml(comic.cert)}">
          <td>
            <div class="title">${escapeHtml(displayTitle(comic))}${
              isTopPop(comic) ? ' <span class="star">★</span>' : ''
            }</div>
            <div class="sub">${escapeHtml(comic.cert)} &middot; bin ${escapeHtml(bin)} &middot; ${escapeHtml(
              comic.grade ?? '',
            )}</div>
          </td>
          <td class="num">${
            market === null
              ? `<span class="none">${
                  comic.fmv?.status === 'no-sales' ? 'no sales' : 'not listed'
                }</span>`
              : `<span class="market">${escapeHtml(formatMoney(market))}</span>`
          }</td>
          <td class="num"><input class="val" type="text" inputmode="decimal" value="${
            manual === null ? '' : escapeHtml(String(manual))
          }" placeholder="$" aria-label="Your value"></td>
          <td><input class="note" type="text" value="${escapeHtml(
            comic.manual?.note ?? '',
          )}" placeholder="how you arrived at it" aria-label="Note"></td>
          <td><span class="status"></span></td>
        </tr>`;
}

export function renderEditorPage({ bins }) {
  const all = bins.flatMap((b) => (b.comics ?? []).map((c) => ({ comic: c, bin: b.bin })));
  const gap = all.filter(({ comic }) => fmvValue(comic) === null);
  const covered = all.filter(({ comic }) => fmvValue(comic) !== null);

  const table = (rows) => `      <table>
        <thead>
          <tr>
            <th>Book</th>
            <th class="num">GoCollect</th>
            <th class="num">Your value</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
${rows.map(({ comic, bin }) => row(comic, bin)).join('\n')}
        </tbody>
      </table>`;

  const body = `<div class="wrap">
  <h1>Value editor</h1>
  <p class="lede">
    Local only — edits write straight to <code>data/bins/*.json</code>. Values save
    when you leave a field. When you are done: <code>npm run build &amp;&amp; npm run print</code>,
    then commit.<br>
    Your figures are kept separate from GoCollect's throughout, and anything you
    enter is labelled as an estimate wherever it is shown.
  </p>

  <h2>No market value <span class="n">— ${gap.length} book${gap.length === 1 ? '' : 's'}</span></h2>
${gap.length ? table(gap) : '  <p class="lede">Nothing here — every book has a market value.</p>'}

  <h2>Already priced by GoCollect <span class="n">— ${covered.length}, override if you disagree</span></h2>
${table(covered)}
</div>

<script>
${script}
</script>`;

  return page({ title: 'Value editor', css, body });
}
