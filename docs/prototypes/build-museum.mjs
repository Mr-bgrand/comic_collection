/** Review artifact only. Run from the repo root: node docs/prototypes/build-museum.mjs */
import fs from 'node:fs';
import { displayTitle, graderOf, collectionStats, certUrl, fmvValue, manualValue } from '../../src/model.js';
import { renderIndexPage } from '../../src/templates/indexPage.js';
import { escapeHtml as e } from '../../src/templates/shared.js';

const bins = fs.readdirSync('data/bins').filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync('data/bins/' + f)));
const config = JSON.parse(fs.readFileSync('data/config.json'));
const stats = collectionStats(bins);
const base = config.baseUrl.replace(/\/$/, '');
const selected = ['4395549004', '3929808007', '4090689001', '4177706003'];
const image = name => {
  if (!name) return null;
  const p = ['data/medium/', 'data/images/'].map(prefix => prefix + name).find(p => fs.existsSync(p));
  return p ? 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const records = bins.flatMap(b => b.comics.map(c => ({
  cert: c.cert, title: displayTitle(c), short: `${c.title} #${c.issue}`, variant: c.variant || 'Standard edition',
  grader: graderOf(c), grade: c.grade, bin: b.bin, container: b.title || 'Bin ' + b.bin,
  location: b.location || 'Room or shelf location has not been recorded.',
  publisher: c.publisher || '', year: c.issueYear === '1900' ? '' : c.issueYear,
  value: fmvValue(c) ?? manualValue(c), valueSource: fmvValue(c) !== null ? 'GoCollect FMV' : manualValue(c) !== null ? 'Owner estimate' : null,
  fetchedAt: (fmvValue(c) !== null ? c.fmv?.fetchedAt : c.manual?.updatedAt)?.slice(0,10) || null,
  evidence: c.fmv?.url || null, verify: certUrl(c), population: c.population || null,
  front: selected.includes(c.cert) ? image(c.images?.front) : null,
  back: selected.includes(c.cert) ? image(c.images?.back) : null,
  href: `${base}/bin/${encodeURIComponent(b.bin)}/`,
})));
const items = selected.map(cert => records.find(c => c.cert === cert)).filter(Boolean);
const hero = items[0];
const money = n => n === null ? 'Not yet valued' : '$' + n.toLocaleString('en-US');
const snapshot = new Date().toISOString().slice(0,10);
const css = fs.readFileSync('docs/prototypes/museum.css','utf8');
const script = fs.readFileSync('docs/prototypes/museum.js','utf8');
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Collection — Personal Museum concept</title><style>${css}</style></head><body>
<div id="app" class="relative min-h-screen">
  <a id="skip-content" class="skip" href="#main">Skip to content</a>
  <header class="topbar">
    <button class="wordmark" data-mode="gallery" aria-label="The Collection, gallery home">THE COLLECTION<span>A PERSONAL ARCHIVE</span></button>
    <nav aria-label="Main navigation"><button id="gallery-tab" data-mode="gallery" aria-pressed="true">Gallery</button><button id="family-tab" data-mode="family" aria-pressed="false">Family guide</button></nav>
    <button class="search-button" id="open-search">Find a comic <span aria-hidden="true">↗</span></button>
  </header>
  <main id="main" tabindex="-1">
    <section id="gallery" aria-labelledby="gallery-heading">
      <div class="hero-grid">
        <div class="intro">
          <p class="eyebrow"><span class="status-dot"></span> ${stats.comics} COMICS. ONE PERSONAL UNIVERSE.</p>
          <h1 id="gallery-heading">Every cover.<br>A story worth<br><em>keeping.</em></h1>
          <p class="intro-copy">Step inside a collection of heroes, beautiful art, and the things that stay with us.</p>
          <div class="hero-actions"><button class="primary" id="tour">Explore the collection <span aria-hidden="true">↗</span></button><a id="existing-vault" class="text-link" href="${base}/wall/3d/" target="_blank" rel="noopener">Enter the 3D vault <span aria-hidden="true">↗</span></a></div>
          <div class="collection-note"><span class="note-line"></span><p>A collection to enjoy today.<br>A record to pass on tomorrow.</p></div>
        </div>
        <div class="exhibit">
          <div class="exhibit-heading"><span class="eyebrow">ON THE GALLERY SHELF</span><span class="mono" id="shelf-count">01 / ${String(items.length).padStart(2,'0')}</span></div>
          <div class="stage" id="stage">
            <div class="stage-light" aria-hidden="true"></div><div class="shelf-line" aria-hidden="true"></div>
            <button class="cover side-cover cover-left" id="left-cover" aria-label="Select previous gallery comic"><img src="${items.at(-1).front}" alt="${e(items.at(-1).short)}"></button>
            <button class="cover hero-cover" id="hero-cover" aria-label="Inspect ${e(hero.short)}"><img id="hero-image" src="${hero.front}" alt="${e(hero.short)} front scan"><span class="inspect-label">INSPECT THIS COPY ↗</span></button>
            <button class="cover side-cover cover-right" id="right-cover" aria-label="Select next gallery comic"><img src="${items[1].front}" alt="${e(items[1].short)}"></button>
          </div>
          <div class="exhibit-caption"><div><div class="eyebrow" id="hero-edition">${e(hero.grader)} ${e(hero.grade)} · ${e(hero.container)}</div><h2 id="hero-title">${e(hero.short)}</h2><p id="hero-variant">${e(hero.variant)}</p></div><div class="arrows"><button id="previous" aria-label="Previous gallery comic">←</button><button id="next" aria-label="Next gallery comic">→</button></div></div>
        </div>
      </div>
      <div class="bottom-grid">
        <div class="browse-section"><div class="section-heading"><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><span class="mono">04 WAYS IN</span></div><div class="collections">
          <button data-query="Spider"><span class="collection-index">01</span><span>The Spider-Verse<small>Find a familiar hero</small></span><span>↗</span></button>
          <button data-query="foil"><span class="collection-index">02</span><span>Art that catches light<small>Foils in the collection</small></span><span>↗</span></button>
          <button data-query="Star Wars"><span class="collection-index">03</span><span>A galaxy on the shelf<small>Explore Star Wars</small></span><span>↗</span></button>
          <button data-query="Back to the Future"><span class="collection-index">04</span><span>Back to the future<small>Different covers. Same universe.</small></span><span>↗</span></button>
        </div></div>
        <button class="family-invitation" data-mode="family"><span class="eyebrow">FOR THE PEOPLE WHO MATTER</span><span class="family-invitation-title">You don’t have to<br>be a collector.</span><span class="family-invitation-copy">Find what’s here, where it lives,<br>and what we know about its value.</span><span class="family-invitation-link">Open the family guide ↗</span></button>
      </div>
    </section>
    <section id="family" hidden aria-labelledby="family-heading">
      <div class="family-intro"><div><p class="eyebrow">THE FAMILY GUIDE</p><h1 id="family-heading">You can start here.</h1><p>Everything you need to understand the collection,<br>one clear step at a time.</p></div><div class="snapshot">COLLECTION SNAPSHOT<br>${snapshot}<br><span>Recorded data, not live prices</span></div></div>
      <div class="family-summary"><div><p class="eyebrow">RECORDED MARKET SUBTOTAL</p><strong>${money(stats.totalValue)}</strong><p>${stats.priced} of ${stats.comics} comics have a recorded market value.</p><div class="coverage-track"><span style="width:${100*stats.priced/stats.comics}%"></span></div><p class="coverage-note">${stats.unpriced} comics are not included in this subtotal.</p></div><div class="summary-note"><h2>A missing value is not $0.</h2><p>Some editions do not have recorded sales. Each item shows the source and date of its available value, so you can see what still needs checking.</p><button id="show-unpriced" class="text-link">See ${stats.unpriced} comics without a market value ↗</button></div></div>
      <div class="family-steps"><button id="family-find"><span class="step-index">01 / IDENTIFY</span><h2>Find the exact comic.</h2><p>Search the title or the certification number printed on its slab.</p><span class="step-action">Search the collection ↗</span></button><button id="show-locations"><span class="step-index">02 / LOCATE</span><h2>Know where to look.</h2><p>${bins.length-1} storage bins and a display wall. Open a container to see what belongs there.</p><span class="step-action">Browse storage locations ↗</span></button><button id="family-evidence"><span class="step-index">03 / UNDERSTAND</span><h2>See what supports a value.</h2><p>Inspect the grade, exact edition, source and date together.</p><span class="step-action">Open an example record ↗</span></button></div>
      <p class="family-footnote">Collection notes and a downloadable family packet are proposed next steps. This concept previews the information already recorded.</p>
    </section>
  </main>
  <footer><span>THE COLLECTION <span class="footer-divider">/</span> MADE TO BE KEPT</span><span>INTERACTIVE DESIGN STUDY · ${snapshot}</span></footer>
  <dialog id="item-dialog" aria-labelledby="item-title"><div class="dialog-shell"><button class="close" data-close="item-dialog" aria-label="Close item record">×</button><div class="item-grid"><div class="item-scan"><img id="item-image" alt=""><p id="image-empty" hidden>Scans for this comic are available on its bin page.</p><button id="flip" class="secondary">View back</button></div><div class="item-info"><p class="eyebrow">THE EXACT COPY</p><h2 id="item-title"></h2><p id="item-variant"></p><div class="record-grade" id="item-grade"></div><dl><dt>Certification number</dt><dd id="item-cert"></dd><dt>Where it lives</dt><dd id="item-location"></dd><dt>Recorded value</dt><dd id="item-value"></dd><dt>Value source and date</dt><dd id="item-source"></dd></dl><p class="population" id="item-population"></p><div class="record-links"><a id="item-verify" target="_blank" rel="noopener">Verify certification ↗</a><a id="item-evidence" target="_blank" rel="noopener">View value source ↗</a><a id="item-bin" target="_blank" rel="noopener">Open complete bin record ↗</a></div><div class="story-placeholder"><span class="eyebrow">THE PERSONAL PART</span><p>A place for your story: how you found it, why you kept it, who it reminds you of.</p><small>Proposed feature · no personal story has been added.</small></div></div></div></div></dialog>
  <dialog id="search-dialog" aria-labelledby="search-title"><div class="dialog-shell"><button class="close" data-close="search-dialog" aria-label="Close collection search">×</button><p class="eyebrow">THE WHOLE COLLECTION</p><h2 id="search-title">Find your way in.</h2><label for="query">Title, edition, certification number, or grading company</label><input type="search" id="query" autocomplete="off" placeholder="Try Spider-Man, foil, or a cert number"><p id="result-count" role="status"></p><div id="results"></div></div></dialog>
  <dialog id="locations-dialog" aria-labelledby="locations-title"><div class="dialog-shell"><button class="close" data-close="locations-dialog" aria-label="Close storage locations">×</button><p class="eyebrow">WHERE THINGS LIVE</p><h2 id="locations-title">Storage & display.</h2><p class="location-note">Room and shelf details still need to be added for the storage bins.</p><div class="location-list">${bins.map(b=>`<a id="location-${e(b.bin)}" href="${base}/bin/${encodeURIComponent(b.bin)}/" target="_blank" rel="noopener"><span><strong>${e(b.title)}</strong><small>${e(b.location||'Room / shelf not recorded')}</small></span><span>${b.comics.length} comics ↗</span></a>`).join('')}</div></div></dialog>
  <noscript><p class="noscript">This design study uses JavaScript for its interactive views. <a id="noscript-collection" href="${base}">Open the existing collection.</a></p></noscript>
  <script id="collection-data" type="application/json">${JSON.stringify({records,selected}).replace(/</g,'\\u003c')}</script><script>${script}</script>
</div></body></html>`;

for(const dir of ['docs/prototypes','.superdesign/tmp','dist/review']) fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync('docs/prototypes/museum.html',html);
fs.writeFileSync('dist/review/index.html',html);
// Canvas variant keeps the same hand-authored CSS; utility support is explicit.
fs.writeFileSync('.superdesign/tmp/museum.html',html.replace('<style>', '<script src="https://cdn.tailwindcss.com"></script><style>'));
let baseline=renderIndexPage({bins,config,totalComics:stats.comics,totalTopPops:stats.topPop});
let linkId=0;
baseline=baseline.replace(/<a /g,()=>`<a id="baseline-link-${++linkId}" `).replace(/href="(?!https:)([^"]+)"/g,(_,u)=>`href="${base}/${u}"`);
baseline=baseline.replace("fetch('search.json')",`fetch('${base}/search.json')`).replace('disabled placeholder="Loading&hellip;"',`placeholder="Search ${stats.comics} comics by cert number, title, or publisher"`);
baseline=baseline.replace('<body>','<body><div class="relative">').replace('</body>','</div></body>').replace('<style>','<script src="https://cdn.tailwindcss.com"></script><style>');
fs.writeFileSync('.superdesign/tmp/current-home.html',baseline);
console.log(`Museum concept built from ${records.length} records; ${items.length} selected scan pairs. ${Math.round(Buffer.byteLength(html)/1024)} KB. Preview: http://localhost:4175/review/`);
