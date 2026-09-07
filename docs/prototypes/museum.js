// This prototype reads its embedded snapshot. It does not edit the collection.
(() => {
  const data = JSON.parse(document.getElementById('collection-data').textContent);
  const $ = id => document.getElementById(id);
  const items = data.selected.map(cert => data.records.find(c => c.cert === cert)).filter(Boolean);
  const fmt = value => value === null ? 'Not yet valued' : '$' + value.toLocaleString('en-US');
  let index = 0, current = items[0], isBack = false, unpricedOnly = false;
  const text = (id, value) => { $(id).textContent = value; };
  const setLink = (id, href) => { $(id).hidden = !href; if (href) $(id).href = href; };
  function setMode(mode) {
    $('gallery').hidden = mode !== 'gallery'; $('family').hidden = mode !== 'family';
    $('app').classList.toggle('family-mode', mode === 'family');
    for(const id of ['gallery','family']) $(id+'-tab').setAttribute('aria-pressed', String(id === mode));
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  function select(next) {
    index = (next + items.length) % items.length;
    const c = items[index];
    $('hero-image').src = c.front; $('hero-image').alt = c.short + ' front scan';
    $('hero-cover').setAttribute('aria-label','Inspect ' + c.short);
    for(const [side, offset] of [['left',-1],['right',1]]) {
      const adjacent = items[(index + offset + items.length) % items.length];
      const image = $(side+'-cover').querySelector('img'); image.src = adjacent.front; image.alt = adjacent.short;
    }
    text('hero-title',c.short); text('hero-variant',c.variant);
    text('hero-edition',c.grader + ' ' + c.grade + ' · ' + c.container);
    text('shelf-count',String(index+1).padStart(2,'0') + ' / ' + String(items.length).padStart(2,'0'));
  }
  $('previous').onclick = $('left-cover').onclick = () => select(index-1);
  $('next').onclick = $('right-cover').onclick = () => select(index+1);
  function openItem(c) {
    current = c; isBack = false;
    text('item-title',c.short); text('item-variant',c.variant); text('item-grade',c.grader+' '+c.grade);
    text('item-cert',c.cert); text('item-location',c.container + ' · ' + c.location);
    text('item-value',fmt(c.value));
    text('item-source',c.valueSource ? c.valueSource + ' · ' + (c.fetchedAt || 'Date not recorded') : 'No valuation has been recorded for this copy.');
    text('item-population',c.population && typeof c.population.higher==='number' ? `${c.population.atGrade ?? 'Unknown count'} at this grade · ${c.population.higher} graded higher in the stored census. Census data is a snapshot.` : 'Population data has not been recorded.');
    setLink('item-verify',c.verify); setLink('item-evidence',c.evidence); setLink('item-bin',c.href);
    $('item-image').hidden = !c.front; $('image-empty').hidden = !!c.front;
    if(c.front) { $('item-image').src = c.front; $('item-image').alt = c.short + ' front scan'; }
    $('flip').hidden = !c.back; text('flip','View back');
    $('item-dialog').showModal();
  }
  $('hero-cover').onclick = () => openItem(items[index]);
  $('tour').onclick = () => openItem(items[index]);
  $('flip').onclick = () => { isBack = !isBack; $('item-image').src = isBack ? current.back : current.front; $('item-image').alt = current.short + (isBack?' back scan':' front scan'); text('flip',isBack?'View front':'View back'); };
  function search() {
    const query = $('query').value.trim().toLowerCase();
    const matches = data.records.filter(c => (!unpricedOnly || c.valueSource !== 'GoCollect FMV') && (!query || [c.title,c.cert,c.grader,c.publisher,c.year].join(' ').toLowerCase().includes(query)));
    text('result-count',matches.length + (matches.length===1?' comic':' comics') + (unpricedOnly ? ' without a recorded market value' : ''));
    $('results').replaceChildren();
    for(const c of matches) {
      const button = document.createElement('button'); button.className = 'result';
      const identity = document.createElement('span'); identity.textContent = c.title;
      const meta = document.createElement('small'); meta.textContent = c.grader+' '+c.grade+' · '+c.container+' · '+c.cert; identity.append(meta);
      const value = document.createElement('span'); value.textContent = fmt(c.value) + ' ↗';
      button.append(identity,value); button.addEventListener('click',()=>openItem(c)); $('results').append(button);
    }
    if(!matches.length) { const empty=document.createElement('p'); empty.textContent='No comics match. Try a shorter title or the certification number.'; $('results').append(empty); }
  }
  function openSearch(query='',onlyUnpriced=false) { unpricedOnly=onlyUnpriced; $('query').value=query; search(); $('search-dialog').showModal(); $('query').focus(); }
  $('query').addEventListener('input',search);
  $('open-search').onclick = $('family-find').onclick = () => openSearch();
  $('show-unpriced').onclick = () => openSearch('',true);
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click',()=>openSearch(button.dataset.query)));
  $('show-locations').onclick = () => $('locations-dialog').showModal();
  $('family-evidence').onclick = () => openItem(items.find(c=>c.short.startsWith('Star Wars')) || items[0]);
  document.addEventListener('keydown',event=>{
    if(event.key==='/' && !document.querySelector('dialog[open]') && event.target.tagName!=='INPUT') { event.preventDefault(); openSearch(); }
  });
})();
