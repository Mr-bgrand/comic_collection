import { escapeHtml as esc, page } from './shared.js';
import { displayTitle, gradeLabel, effectiveValue, formatMoney } from '../model.js';

/** Print controls live outside the paper and disappear in printed output. */
export function withPrintControls(html, { size, title }) {
  const controls = `<div class="lab-print-tools"><a href="/review/">← Collection</a><div><strong>${esc(title)}</strong><span>${esc(size)} · Actual size / 100% · Turn off browser headers and footers</span></div><button id="print-document">Print / Save PDF</button></div>`;
  const css = `<style>.lab-print-tools{font:13px Arial,sans-serif;display:flex;align-items:center;gap:22px;background:#0c1922;color:#edf4f8;padding:18px 24px;margin-bottom:25px}.lab-print-tools a{color:#b5c7d3;white-space:nowrap}.lab-print-tools div{flex:1}.lab-print-tools span{display:block;font-size:11px;color:#a8bcc8;margin-top:6px}.lab-print-tools button{border:0;border-radius:4px;background:#d8ffa3;color:#132014;padding:14px 18px;cursor:pointer;font-weight:700;white-space:nowrap}@media screen{html,body{width:auto;min-width:0}.lab-print-tools{position:sticky;top:0;z-index:10}.side{max-width:7.5in;margin:24px auto}.label-paper{width:3.64in;margin:25px auto 40px}@media(max-width:650px){.lab-print-tools{flex-wrap:wrap;gap:12px;padding:16px}.lab-print-tools div{min-width:180px}.side{margin:20px 12px}}}@media print{.lab-print-tools{display:none!important}.label-paper{margin:0}}</style>`;
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  const paper = size.startsWith('4') ? `<div class="label-paper">${body}</div>` : body;
  return html.replace('</head>', css + '</head>').replace(/<body>[\s\S]*<\/body>/, `<body>${controls}${paper}<script>document.getElementById('print-document').onclick=()=>window.print();</script></body>`);
}

export function renderCollectionMaster(collection) {
  const entries = [];
  for (const { data: group } of [...collection.bins, ...collection.cards, ...collection.comics]) {
    for (const comic of group.comics || group.cards || []) entries.push({ comic, group });
  }
  const rows = entries.map(({ comic: c, group: b }, i) => {
    const container = b.bin ? b.title || `Bin ${b.bin}` : b.virtual ? `${b.title} · ${b.location || 'External storage'}` : c.location || b.location || 'Location not recorded';
    const value = effectiveValue(c);
    const basis = c.fmv?.value != null ? [c.fmv.source === 'psa-vault-export' ? 'PSA export estimate' : 'Market estimate', c.fmv.asOf || c.fmv.fetchedAt || 'date not supplied'].join(' · ') : c.manual?.value != null ? `Owner estimate · ${c.manual.setAt || 'date not supplied'}` : '';
    return `<tr><td>${i + 1}</td><td><strong>${esc(displayTitle(c))}</strong><small>${esc(c.provider === 'Authority' ? 'Authority ID' : c.grader || 'CGC')} ${esc(c.cert)}${c.holder === 'soft-sleeve' ? ' · Soft sleeve' : ''}</small></td><td>${esc(gradeLabel(c))}</td><td>${esc(container)}${b.bin && b.location ? `<small>${esc(b.location)}</small>` : ''}</td><td>${value === null ? 'Not yet valued' : esc(formatMoney(value))}${basis ? `<small>${esc(basis)}</small>` : ''}</td></tr>`;
  }).join('');
  return page({ title: 'Collection master list', css: `@page{size:letter landscape;margin:.45in}*{box-sizing:border-box}body{font:9pt Arial,sans-serif;color:#17212a;margin:0;background:white}header{margin:20px 0}h1{font-size:22pt;margin:0 0 8px}p{font-size:9pt;color:#53606a}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}th{text-align:left;font-size:8pt;letter-spacing:.6px;border-bottom:2px solid #18252e;padding:8px 6px}td{padding:9px 6px;border-bottom:1px solid #dae0e5;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}small{display:block;font-size:7pt;color:#5b6873;margin-top:4px;line-height:1.4}th:first-child{width:4%}th:nth-child(2){width:43%}th:nth-child(3){width:12%}th:nth-child(4){width:20%}@media screen{main{max-width:11in;margin:25px auto;padding:20px}}`,
    body: `<main><header><h1>Collection master list</h1><p>${entries.length} objects · Generated ${new Date().toISOString().slice(0, 10)} · Recorded values retain their own source dates.</p></header><table><thead><tr><th>#</th><th>EXACT COPY</th><th>GRADE / STATUS</th><th>LOCATION</th><th>RECORDED VALUE</th></tr></thead><tbody>${rows}</tbody></table></main>` });
}
