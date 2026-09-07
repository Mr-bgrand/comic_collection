/** Lightweight SVG history: actual observations and a keyboard/touch scrubber. */
export function mountValueHistory({history,onOpen=()=>{},onUnvalued=()=>{}}) {
  const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg',snapshots=history.snapshots;
  const current=history.current||snapshots.at(-1),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0}).format(n);
  const date=(at,full=false)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',...(full?{year:'numeric',hour:'numeric',minute:'2-digit'}:{}),timeZone:history.timeZone}).format(new Date(at));
  function svg(tag,attributes={},text){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
  $('value-mini-total').textContent=current.valued?money(current.total):'No values yet';
  $('value-mini-coverage').textContent=`${current.valued} / ${current.count} valued`;
  $('value-find-missing').textContent=`${current.unvalued} with no value yet ↗`;
  $('value-find-missing').onclick=()=>{$('value-dialog').close();onUnvalued();};
  const first=Date.parse(snapshots[0].observedAt),last=Date.parse(snapshots.at(-1).observedAt),ceiling=Math.max(1,...snapshots.map(s=>s.total))*1.04;
  const magnitude=10**Math.floor(Math.log10(ceiling)),max=Math.ceil(ceiling/magnitude*2)/2*magnitude;
  const axisMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
  const points=snapshots.map(s=>({x:last===first?320:48+(Date.parse(s.observedAt)-first)/(last-first)*576,y:218-s.total/max*192}));
  const path=points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '),chart=$('value-chart');
  const defs=svg('defs'),gradient=svg('linearGradient',{id:'value-fill',x1:0,x2:0,y1:0,y2:1});
  gradient.append(svg('stop',{offset:'0%','stop-color':'#d8ffa3','stop-opacity':'.22'}),svg('stop',{offset:'100%','stop-color':'#d8ffa3','stop-opacity':'0'}));defs.append(gradient);chart.append(defs);
  for(const fraction of [0,.5,1]){const y=218-fraction*192;chart.append(svg('line',{x1:48,x2:624,y1:y,y2:y,stroke:'#7399ae26','stroke-dasharray':'3 7'}),svg('text',{x:0,y:y+4,fill:'#92b2c2','font-size':14},axisMoney(max*fraction)));}
  if(points.length>1)chart.append(svg('path',{d:path+` L${points.at(-1).x},218 L${points[0].x},218 Z`,fill:'url(#value-fill)'}));
  chart.append(svg('path',{d:path,fill:'none',stroke:'#d8ffa3','stroke-width':2.5,'stroke-linejoin':'round'}));
  const cursor=svg('line',{x1:0,x2:0,y1:20,y2:218,stroke:'#d8ffa37a','stroke-dasharray':'3 4'});chart.append(cursor);
  const dots=points.map((p,i)=>{const circle=svg('circle',{cx:p.x,cy:p.y,r:3.5,fill:'#d8ffa3',stroke:'#0b1822','stroke-width':2});circle.append(svg('title',{},`${date(snapshots[i].observedAt,true)} · ${money(snapshots[i].total)} · ${snapshots[i].valued} of ${snapshots[i].count} valued`));chart.append(circle);return circle;});
  const mini=$('value-mini-chart'),miniPoints=points.map(p=>({x:4+(p.x-48)/576*90,y:44-(218-p.y)/192*38}));
  mini.append(svg('path',{d:miniPoints.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '),fill:'none',stroke:'#d8ffa3','stroke-width':1.7}));
  mini.append(svg('circle',{cx:miniPoints.at(-1).x,cy:miniPoints.at(-1).y,r:2.8,fill:'#d8ffa3'}));
  $('value-first-date').textContent=date(snapshots[0].observedAt);$('value-last-date').textContent=date(snapshots.at(-1).observedAt);
  $('value-history-note').textContent=snapshots.length===1?'First observation saved. History grows as you rebuild.':'Snapshots are saved automatically when you rebuild.';
  $('value-scrub').max=String(snapshots.length-1);$('value-scrub').disabled=snapshots.length<2;
  function select(index){const s=snapshots[index],p=points[index];$('value-scrub').value=String(index);$('value-scrub').setAttribute('aria-valuetext',`${date(s.observedAt,true)}, ${money(s.total)}, ${s.valued} of ${s.count} copies valued`);
    $('value-date').textContent=date(s.observedAt,true);$('value-total').textContent=s.valued?money(s.total):'No values yet';$('value-coverage-count').textContent=`${s.valued} / ${s.count}`;
    $('value-comics').textContent=s.comics.valued?money(s.comics.total):s.comics.count?'Not yet valued':'No copies recorded';$('value-cards').textContent=s.cards.valued?money(s.cards.total):s.cards.count?'Not yet valued':'No copies recorded';
    $('value-position').textContent=`${index+1} / ${snapshots.length}`;$('value-latest').disabled=index===snapshots.length-1;
    $('value-observation').textContent=s.source==='saved-inventory'?'From a saved inventory version. This is the date the record was saved, not a new appraisal.':'From your local collection records at the time shown. Rebuilding records existing estimates; it does not fetch new prices.';
    $('value-undated').hidden=!s.undated;$('value-undated').textContent=`${s.undated} valued ${s.undated===1?'copy has':'copies have'} no valuation date supplied.`;
    cursor.setAttribute('x1',p.x);cursor.setAttribute('x2',p.x);dots.forEach((dot,i)=>dot.setAttribute('r',i===index?6:3.5));
  }
  $('value-scrub').oninput=e=>select(Number(e.target.value));$('value-latest').onclick=()=>select(snapshots.length-1);
  let dragging=false;
  function pointAt(e){const bounds=chart.getBoundingClientRect(),x=(e.clientX-bounds.left)/bounds.width*640;let nearest=0;for(let i=1;i<points.length;i++)if(Math.abs(points[i].x-x)<Math.abs(points[nearest].x-x))nearest=i;select(nearest);}
  chart.onpointerdown=e=>{dragging=true;chart.setPointerCapture(e.pointerId);pointAt(e);};chart.onpointermove=e=>{if(dragging||e.pointerType==='mouse')pointAt(e);};chart.onpointerup=chart.onpointercancel=()=>{dragging=false;};
  for(const s of snapshots){const row=document.createElement('tr');for(const text of [date(s.observedAt,true),s.valued?money(s.total):'Unknown',String(s.valued),String(s.count)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('value-rows').append(row);}
  $('collection-value').onclick=()=>{onOpen();select(snapshots.length-1);$('value-dialog').showModal();};
  select(snapshots.length-1);
}
