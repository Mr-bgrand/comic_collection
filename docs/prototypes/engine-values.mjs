/** Local evidence review. Every interpolation is text-escaped; public previews are read-only. */
const valueEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valueMoney=n=>n==null?'Not yet valued':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
const basisNames={'guide':'Guide estimate','sold-comps':'Sold-comparable estimate','psa-comparison':'PSA comparison for TAG','owner':'Owner estimate','raw-reference':'Provisional raw reference'};
const flagNames={missing:'No value',stale:'Stale source',undated:'Source undated',review:'Needs review',condition:'Condition not assessed',identity:'Identity needed'};
const valueDate=date=>date?'Source as of '+date.slice(0,10):'Source undated';
const identityFields=record=>record.kind==='card'?['year','brand','series','subject','cardNumber','variety','language','edition']:['title','issue','issueYear','publisher','variant','upc','coverCode','volume','printing','edition','language'];
const fieldNames={issueYear:'Issue year',cardNumber:'Card number',coverCode:'Cover code',upc:'Full UPC',year:'Year'};
const humanField=key=>fieldNames[key]||key[0].toUpperCase()+key.slice(1);
const inputField=(name,label,value='',extra='')=>`<label>${valueEscape(label)}<input name="${name}" value="${valueEscape(value)}" ${extra}></label>`;
const notesFields=()=>`${inputField('sourceUrl','Evidence URL','','type="url" required placeholder="https://…"')}${inputField('reviewedBy','Reviewed by','Owner','required maxlength="100"')}<label class="values-wide">Review notes<textarea name="notes" required maxlength="4000" placeholder="What establishes the exact edition, grade or condition?"></textarea></label>`;
export function renderValueDetail(item) {
 const e=valueEscape,r=item.record,current=item.current,raw=r.grading?.status==='raw';
 const scans=['front','back'].map(side=>r.images?.[side]?`<figure><img src="/medium/${encodeURIComponent(r.images[side])}" alt="Owned copy ${side} scan"><figcaption>Owned ${side} scan</figcaption></figure>`:`<p class="values-no-scan">${side==='front'?'Front':'Back'} scan not recorded</p>`).join('');
 const facts=identityFields(r).filter(key=>r[key]!=null&&r[key]!=='').map(key=>`<dt>${e(humanField(key))}</dt><dd>${e(r[key])}</dd>`).join('');
 const observations=item.observations.map(o=>`<article class="values-observation ${o.selected?'is-selected':''}"><div class="values-observation-head"><strong>${valueMoney(o.value)}${o.caution?'*':''}</strong><span>${e(o.selected?(o.eligible?'Selected · locked':'Previous selection · review required'):o.reviewStatus)}</span></div><p>${e(basisNames[o.basis]||o.basis)}</p><a href="${e(o.source.url)}" target="_blank" rel="noopener">${e(o.source.name)} ↗</a><p>${e(valueDate(o.source.asOf))}<br>Captured ${e(o.source.retrievedAt)}</p><p>${e(o.match.grader||'Raw')} ${e(o.match.grade??'')} · Match: ${e(o.match.status)} · Condition: ${e(o.match.condition==null?'unassessed':typeof o.match.condition==='object'?JSON.stringify(o.match.condition):o.match.condition)}</p>${o.reviewEvidence?.notes?`<p>${e(o.reviewEvidence.notes)}</p>`:''}${o.caution?`<p class="values-warning">* Estimate: ${e(o.caution)}</p>`:''}${o.saleCount?`<p>${o.saleCount} matching sales</p>`:''}${o.catalog?`<p>Catalog ${e(o.catalog.id)} · ${e(o.catalog.field)}</p>`:''}${o.reason?`<p class="values-warning">${e(o.reason)}</p>`:''}${o.reviewStatus==='pending'||o.reviewStatus==='accepted'&&!o.selected?`<button data-accept="${e(o.id)}" ${!o.eligible?'disabled':''}>Accept this value</button>`:''}${o.reviewStatus==='pending'?`<form data-reject-form="${e(o.id)}" class="values-reject"><input name="reason" required maxlength="1000" aria-label="Reason to dismiss ${e(o.source.name)}" placeholder="Reason to dismiss"><button>Dismiss</button></form>`:''}</article>`).join('');
 return `<header class="values-copy-heading"><p>${e(item.copyId)} · ${e(item.container?.title||'Location not recorded')}</p><h4>${e(item.title)}</h4><p>${e(raw?'Raw · '+(item.flags.includes('condition')?'Condition not assessed':typeof r.condition==='object'?JSON.stringify(r.condition):r.condition):[r.grader||'CGC',r.grade,r.labelType].filter(Boolean).join(' '))}</p></header><div class="values-scans">${scans}</div><details class="values-identity"><summary>Stored edition details</summary><dl>${facts}</dl></details><div class="values-current"><span>RECORDED VALUE</span><strong>${valueMoney(current?.value)}${current?.caution?'*':''}</strong><p>${current?e(basisNames[current.basis]||current.basis)+' · '+e(current.source)+'<br>'+e(valueDate(current.asOf)):'New evidence is kept outside totals until accepted.'}</p></div>${current?.caution?'<p class="values-warning">* Estimate: '+e(current.caution)+'</p>':''}<h5>Source observations · ${item.observations.length}</h5>${observations||'<p>No source observations yet. Open a lookup below to begin.</p>'}<div class="values-lookup"><a href="https://www.pricecharting.com/search-products?type=prices&amp;q=${encodeURIComponent(item.title)}&amp;go=Go" target="_blank" rel="noopener">PriceCharting lookup ↗</a>${r.kind!=='card'?'<a href="https://gocollect.com/" target="_blank" rel="noopener">GoCollect lookup ↗</a>':''}<a href="https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.title)}&amp;LH_Sold=1&amp;LH_Complete=1" target="_blank" rel="noopener">Sold listings lookup ↗</a></div><p class="values-help">Lookup results are candidates. Verify the full edition and exact grade before recording a price.</p><details><summary>Record source evidence</summary><form id="values-capture-form" class="values-form"><label>Value basis<select name="basis"><option value="${raw?'raw-reference':'guide'}">${raw?'Provisional raw reference':'Guide estimate'}</option>${raw?'<option value="guide">Condition-specific guide estimate</option>':''}${r.grader==='TAG'?'<option value="psa-comparison">PSA comparison for TAG · same exact grade</option>':''}<option value="owner">Owner estimate</option></select></label>${inputField('value','USD amount','','type="number" min="0" step="0.01" required')}${inputField('sourceName','Source name','','required maxlength="150"')}${inputField('asOf','Source date · leave blank if undated','','type="date"')}${inputField('retrievedAt','Captured date',new Date().toISOString().slice(0,10),'type="date" required')}${notesFields()}<label class="values-wide">Identity review<select name="matchStatus"><option value="ambiguous">Candidate · still needs matching review</option><option value="exact">I verified the full edition, grader, grade and condition</option></select></label><p class="values-help values-wide">A generic graded bucket is not a PSA-specific comparison. Raw references remain provisional. Saving creates pending evidence; acceptance is a separate action.</p><button class="admin-primary">Save pending evidence</button></form></details><details><summary>Review identity or raw condition</summary><form id="values-metadata-form" class="values-form">${identityFields(r).map(key=>inputField(key,humanField(key),r[key]??'','maxlength="300"')).join('')}${raw?'<label class="values-wide">Condition band · leave blank to keep current assessment<select name="condition"><option value="">Keep current condition</option><option>NM</option><option>VF</option><option>FN</option><option>VG</option><option>GD</option><option>FR</option><option>PR</option></select></label>':''}${notesFields()}<label class="values-check values-wide"><input type="checkbox" name="confirmed" required> I verified these edits against the source. Condition changes include front, back, spine, corners and visible defects.</label><p class="values-help values-wide">Cover art alone does not establish a numerical grade. Changing identity or condition can invalidate older matches; their observations remain in the audit history.</p><button class="admin-primary">Save reviewed details</button></form></details><a class="values-template" href="/api/admin/values/template?copyId=${encodeURIComponent(item.copyId)}" download="valuation-capture.json">Download capture template ↓</a>`;
}

export function mountValuations(root,{api}) {
 const $=id=>root.querySelector('#'+id);
 let connected=false,busy=false,state={items:[],providers:{}},selected=null;
 const message=(text,error=false)=>{$('values-status').textContent=text;$('values-status').classList.toggle('error',error);};
 function controls(){for(const el of root.querySelectorAll('[data-values-local]'))el.disabled=!connected||busy;for(const el of root.querySelectorAll('fieldset'))el.disabled=!connected||busy;
  const canRefresh=state.items.some(item=>item.observations?.some(o=>o.providerMapping&&o.reviewStatus!=='rejected'&&state.providers[o.providerMapping.url?.includes('www.sportscardspro.com/')?'sportscardspro':'pricecharting']?.configured));
  for(const b of root.querySelectorAll('[data-values-refresh]')){b.disabled=!connected||busy||!canRefresh;b.title=canRefresh?'Fetch new pending observations from supported verified mappings':'Requires a configured API and owner-verified catalog mapping';}
  $('values-access-status').textContent=canRefresh?'Supported catalog mappings can be refreshed. New observations still require acceptance.':'Automatic refresh unavailable: use source lookup and record reviewed evidence, or import a saved capture.';
  root.setAttribute('aria-busy',String(busy));}
 function providerInfo(){const p=state.providers;$('values-providers').textContent=`GoCollect: saved visible-page capture; sign-in may be required. PriceCharting API: ${p.pricecharting?.configured?'configured; entitlement checked on request':'not configured'}. SportsCardsPro API: ${p.sportscardspro?.configured?'configured; entitlement checked on request':'not configured'}. API refresh needs both access and an owner-verified catalog mapping.`;}
 function list(){
  const q=$('values-query').value.trim().toLowerCase(),filter=$('values-filter').value;
  const items=state.items.filter(item=>(!filter||item.flags.includes(filter))&&[item.copyId,item.title,item.record?.cert].join(' ').toLowerCase().includes(q));
  $('values-count').textContent=items.length+' matching copies';$('values-list').replaceChildren();
  for(const item of items){const b=document.createElement('button');b.type='button';b.className='values-queue-item';b.setAttribute('aria-pressed',String(item.copyId===selected));b.innerHTML=`<strong>${valueEscape(item.title)}</strong><span>${valueEscape(item.copyId)} · ${valueEscape(item.container?.title)}</span><small>${valueEscape(item.flags.map(f=>flagNames[f]).join(' · ')||'Current value')}</small>`;b.onclick=()=>{selected=item.copyId;list();detail();};$('values-list').append(b);}
  if(!items.length)$('values-list').textContent='No copies match these filters.';
  $('values-export').href='/api/admin/values/export'+(filter?'?filter='+encodeURIComponent(filter):'');
 }
 function detail(){
  const item=state.items.find(r=>r.copyId===selected);$('values-detail').innerHTML=item?renderValueDetail(item):'<p class="values-empty">Choose a copy to compare its owned scans and source evidence.</p>';
  if(!item)return;
  const wrap=document.createElement('fieldset');while($('values-detail').firstChild)wrap.append($('values-detail').firstChild);$('values-detail').append(wrap);controls();
  for(const b of $('values-detail').querySelectorAll('[data-accept]'))b.onclick=()=>mutate('accept',{copyId:item.copyId,revision:item.revision,observationId:b.dataset.accept},'Accepted and owner locked. Build the collection to refresh public pages, history and saved PDFs.');
  for(const form of $('values-detail').querySelectorAll('[data-reject-form]'))form.onsubmit=e=>{e.preventDefault();mutate('reject',{copyId:item.copyId,revision:item.revision,reject:{observationId:form.dataset.rejectForm,reason:form.elements.reason.value}},'Alternative dismissed; evidence retained.');};
  $('values-capture-form').onsubmit=e=>{
   e.preventDefault();const form=new FormData(e.target),body=Object.fromEntries(form);body.value=Number(body.value);body.asOf=body.asOf||null;
   mutate('record',{copyId:item.copyId,revision:item.revision,...body},'Source saved for review. Select Accept this value only after checking the match.');
  };
  $('values-metadata-form').onsubmit=e=>{
   e.preventDefault();const form=new FormData(e.target),identity={};
   for(const key of identityFields(item.record))if(form.get(key)!==String(item.record[key]??''))identity[key]=form.get(key);
   const review={evidence:{url:form.get('sourceUrl'),notes:form.get('notes'),reviewedBy:form.get('reviewedBy'),reviewedAt:new Date().toISOString()}};
   if(Object.keys(identity).length)review.identity=identity;if(form.get('condition'))review.condition=form.get('condition');
   if(!review.identity&&!review.condition){message('Change an identity field or choose a condition band before saving.');return;}
   mutate('review',{copyId:item.copyId,revision:item.revision,review},'Reviewed details saved. Earlier source matches remain auditable. Build to update public pages.');
  };
 }
 async function load(){
  if(!connected)return;
  state=await api('values');providerInfo();
  const s=state.summary;$('values-summary').textContent=`${valueMoney(s.total)} recorded · ${s.valued}/${s.count} valued. Market ${valueMoney(s.marketTotal)} · PSA comparisons ${valueMoney(s.comparisonTotal)} · Owner ${valueMoney(s.ownerTotal)}. ${s.limitedHistoryCount||0} starred estimates (${valueMoney(s.limitedHistoryTotal||0)}) are included. Provisional raw ${valueMoney(s.provisionalTotal)} across ${s.provisionalCount} copies is excluded.`;
  list();detail();controls();
 }
 function evidenceOutcome(action,result,success) {
  if(!['capture','import','record'].includes(action))return {text:success,error:false};
  const saved=action==='capture'?result.persistence:result;
  const imported=(action!=='capture'||result.status==='captured')&&saved?.status==='imported'&&Number.isInteger(saved.changed)&&saved.changed>=0;
  if(imported)return {text:saved.changed===0?'This evidence is already recorded. No changes were saved.':success,error:false};
  const statuses={
   'login-required':'Sign-in required',
   'review-required':'Matching review required',
   'missing':'No matching price found',
   'no-sales':'No sales available',
   'not-listed':'This edition is not listed',
   'access-required':'Source access required',
   'captured':'Capture was not saved',
   'reviewed':'Evidence was reviewed but not saved',
   'unknown':'Capture could not be verified'
  };
  const status=statuses[result.status]||'Capture status: '+String(result.status||'unavailable').replaceAll('-',' ');
  const reason=typeof result.reason==='string'&&result.reason.trim()?result.reason.trim()+' ':'';
  return {text:status+'. '+reason+'No evidence was imported. Existing values were kept.',error:true};
 }
 async function mutate(action,body,success){
  if(!connected||busy)return;busy=true;controls();message(action==='refresh'?'Checking supported provider mappings…':'Saving…');
  try{const result=await api('values/'+action,body);await load();
   const outcome=action==='refresh'?{text:`${result.retrievedValues} new values retrieved for review. ${result.items.filter(i=>i.status!=='captured').length} copies still need access or manual research.`,error:false}:evidenceOutcome(action,result,success);
   message(outcome.text,outcome.error);
   $('values-outcomes').replaceChildren();if(action==='refresh'){const groups=new Map();for(const item of result.items)if(item.status!=='captured'){const reason=item.reason||item.status;groups.set(reason,(groups.get(reason)||0)+1);}for(const [reason,count] of groups){const p=document.createElement('p');p.textContent=`${count} copies: ${reason}`;$('values-outcomes').append(p);}}
  }catch(error){message(error.message,true);}finally{busy=false;controls();}
 }
 $('values-query').oninput=list;$('values-filter').onchange=list;
 $('values-reload').onclick=()=>load().then(()=>message('Loaded current stored evidence.')).catch(error=>message(error.message,true));
 for(const b of root.querySelectorAll('[data-values-refresh]'))b.onclick=()=>mutate('refresh',{filter:b.dataset.valuesRefresh},'');
 $('values-review').onclick=()=>{$('values-filter').value='review';list();};
 $('values-import-form').onsubmit=async e=>{e.preventDefault();const file=$('values-import-file').files[0];if(!file)return;try{const data=JSON.parse(await file.text());await mutate(data.schemaVersion===1?'import':data.capture?'capture':'record',data,'Evidence imported for review. No value was automatically accepted.');}catch(error){message(error.message,true);}};
 $('values-api-search').onsubmit=async e=>{e.preventDefault();const provider=$('values-api-provider').value;if(!state.providers[provider]?.configured){message('This optional API is not configured. Use a source lookup and record visible evidence.');return;}try{message('Searching catalog candidates…');const result=await api('values/search?provider='+provider+'&q='+encodeURIComponent($('values-api-query').value));$('values-api-results').replaceChildren();for(const p of result.products){const row=document.createElement('p');row.textContent=`${p.name} · ${p.category} · Product ${p.id}`;$('values-api-results').append(row);}message(result.products.length+' catalog candidates. Verify edition before recording evidence.');}catch(error){message(error.message,true);}};
 return {async setConnected(value){connected=value;controls();$('values-readonly').hidden=value;if(value)try{await load();}catch(error){message(error.message,true);}},load};
}
