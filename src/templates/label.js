/**
 * The 4x6 bin label — goes in the bin's front label slot.
 *
 * Every comic in the bin gets one line, so the bin can be read without a phone.
 * The grade sits in a fixed right-hand column; long variant strings shrink to fit
 * rather than wrapping, so that column stays straight all the way down.
 *
 * Row height is computed from the space actually left after the header and
 * footer, divided by the comic count — so the label fits whatever the bin holds
 * instead of depending on a hand-tuned constant that only worked for one count.
 */

import { labelRow, fitFontSize, labelMetrics } from '../model.js';
import { escapeHtml, page, FONT_NARROW, INK } from './shared.js';

const TITLE_COLUMN_IN = 2.8;
const HEADER_IN = 1.16;
const FOOTER_IN = 0.2;
const GAP_IN = 0.06;

const styles = (m) => `
@page { size: 4in 6in; margin: 0.18in; }

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 3.64in;
  font-family: ${FONT_NARROW};
  color: ${INK};
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.1in;
  height: ${HEADER_IN}in;
  padding-bottom: 0.06in;
  border-bottom: 1.5pt solid ${INK};
  overflow: hidden;
}

.bin-no {
  font-size: 24pt;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 0.92;
}

.bin-meta {
  margin-top: 0.04in;
  font-size: 7pt;
  line-height: 1.3;
  color: #55555e;
}

.bin-meta strong { color: ${INK}; font-weight: 700; }
.bin-title { font-size: 7pt; font-weight: 700; margin-top: .04in; line-height: 1.15; overflow-wrap: anywhere; }

.qr { width: 1.0in; height: 1.0in; flex: none; }
.qr svg { width: 100%; height: 100%; display: block; }

ol { list-style: none; margin-top: ${GAP_IN}in; }

li {
  display: grid;
  grid-template-columns: ${TITLE_COLUMN_IN}in 1fr;
  align-items: center;
  column-gap: 0.05in;
  height: ${m.rowHeightIn}in;
  border-bottom: 0.3pt solid #e4e4e8;
  overflow: hidden;
}

li:last-child { border-bottom: 0; }

.t {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
  font-weight: 700;
}

.g {
  font-size: ${m.gradePt}pt;
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: 1.15;
}

.star { font-size: ${Math.max(5.5, m.gradePt - 1.5)}pt; }

footer {
  height: ${FOOTER_IN}in;
  /* No margin here — the height budget in labelMetrics counts this box only. */
  padding-top: 0.04in;
  border-top: 0.75pt solid ${INK};
  font-size: 6pt;
  color: #55555e;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
`;

export function renderLabel({ bin, qrSvg, url, config }) {
  const comics = bin.comics ?? [];
  if(bin.isPhysicalCase&&comics.length>28){
    const documents=[];
    for(let start=0;start<comics.length;start+=28)documents.push(renderLabel({bin:{...bin,comics:comics.slice(start,start+28),labelRange:`${start+1}–${Math.min(start+28,comics.length)} of ${comics.length}`},qrSvg,url,config}));
    const body=documents.map(html=>`<section class="label-page">${html.match(/<body>([\s\S]*)<\/body>/)[1]}</section>`).join('');
    return documents[0].replace('</head>','<style>.label-page{break-after:page}.label-page:last-child{break-after:auto}</style></head>').replace(/<body>[\s\S]*<\/body>/,`<body>${body}</body>`);
  }
  const metrics = labelMetrics(comics.length, {
    headerIn: HEADER_IN,
    footerIn: FOOTER_IN,
    gapIn: GAP_IN,
  });

  const rows = comics
    .map((comic) => {
      const row = labelRow(comic);
      // Shrink for width, then cap at whatever the row height allows.
      const size = Math.min(fitFontSize(row.title, TITLE_COLUMN_IN), metrics.titlePt);
      return `      <li><span class="t" style="font-size:${size}pt">${escapeHtml(
        row.title,
      )}</span><span class="g">${escapeHtml(row.grade)}${
        row.star ? '<span class="star"> ★</span>' : ''
      }</span></li>`;
    })
    .join('\n');

  const topPops = comics.filter((c) => c.population?.higher === 0).length;

  const body = `<header>
  <div>
    <div class="bin-no"${bin.isPhysicalCase?' style="font-size:19pt;line-height:1.05"':''}>${escapeHtml(bin.isPhysicalCase?bin.title:'BIN '+bin.bin)}</div>
${!bin.isPhysicalCase&&bin.title && bin.title !== `Bin ${bin.bin}` ? `    <div class="bin-title">${escapeHtml(bin.title)}</div>` : ''}
    <div class="bin-meta">
      <strong>${escapeHtml(bin.labelRange||comics.length)}</strong> ${bin.isPhysicalCase?'copies':'CGC graded'}${
        bin.location ? ` &middot; ${escapeHtml(bin.location)}` : ''
      }<br>
      ${topPops ? `★ ${topPops} top pop<br>` : ''}${bin.isPhysicalCase?'Printed '+new Date().toISOString().slice(0,10):'Updated '+escapeHtml(bin.updated ?? '')}
    </div>
  </div>
  <div class="qr">${qrSvg}</div>
</header>

<ol>
${rows}
</ol>

<footer>
  <span>Scan for full records &amp; cover scans</span>
  <span>${escapeHtml(url.replace(/^https?:\/\//, ''))}</span>
</footer>`;

  return page({ title: `${bin.isPhysicalCase?bin.title:'Bin '+bin.bin} label`, css: styles(metrics), body });
}
