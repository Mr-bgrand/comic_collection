/** Shared local Admin and paired phone capture flow. No upload before review. */
export function mountPhotoIntake(host,{base='/api/admin/photos',token=null,phone=false,onSaved=()=>{}}={}) {
  const $=name=>host.querySelector(`[data-photo="${name}"]`);
  let record=null,side='front',image=null,rotation=0,prepared=null,busy=false,connected=true,searchSequence=0,searchTimer,pairing,pairPoll,currentUrl,previewUrl;
  const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
  async function request(route,{body,headers={},...options}={}) {
    const response=await fetch(base+route,{cache:'no-store',...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body}: {})});
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Photo intake is available in the local app. Start it with npm run lab.');
    const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to complete the request.');return result;
  }
  const jsonPost=(route,body)=>request(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  function lock(value) {
    busy=value;
    for(const name of ['save','front','back','camera','choose','rotate','discard','reload','pair'])$(name).disabled=value||!connected;
    $('query').disabled=value||!connected;host.querySelector('.photo-search button').disabled=value||!connected;
    $('save').textContent=value?'Saving photo & refreshing…':(record?.images[side]?'Replace ':'Save ')+side+' photo ↗';
  }
  function discard(){image=null;prepared=null;rotation=0;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('preview').hidden=true;$('empty-preview').hidden=false;$('review').hidden=true;for(const n of ['camera-input','file-input'])$(n).value='';}
  async function currentPhoto() {
    const requestId=record.id,requestSide=side;
    $('current-label').textContent='CURRENT '+side.toUpperCase();$('current-image').hidden=true;$('no-image').hidden=false;$('no-image').textContent=record.images[side]?'Loading photo…':'No photo yet.';
    if(!record.images[side])return;
    try {
      const response=await fetch(base+'/image?id='+encodeURIComponent(requestId)+'&side='+side,{cache:'no-store',headers:token?{Authorization:'Bearer '+token}:{}});
      if(!response.ok)throw Error('Photo unavailable');const blob=await response.blob();
      if(record.id!==requestId||side!==requestSide)return;
      if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(blob);$('current-image').src=currentUrl;$('current-image').alt='Current '+side+' photograph';$('current-image').hidden=false;$('no-image').hidden=true;
    }catch{if(record.id===requestId&&side===requestSide)$('no-image').textContent='Saved photo unavailable.';}
  }
  function paint() {
    $('workspace').hidden=false;$('title').textContent=record.title;$('kind').textContent=record.kind==='card'?'GRADED CARD':'COMIC';
    $('identity').textContent=record.grade+' · '+record.cert+' · '+record.location;
    for(const name of ['front','back']){$(name).setAttribute('aria-pressed',String(name===side));$(name).querySelector('span').textContent=record.images[name]?'Photo saved':'Needs photo';}
    lock(false);currentPhoto();
  }
  async function select(id,{keepPhoto=false}={}) {
    if(busy)return;
    lock(true);
    try {const result=await request('/record?id='+encodeURIComponent(id));record=result.record;if(!keepPhoto){side='front';discard();}$('results').replaceChildren();paint();message(keepPhoto?'Record reloaded. Review the photo and save when ready.':'');}
    catch(error){message(error.message,true);}
    finally{lock(false);}
  }
  async function search() {
    if(busy)return;
    const sequence=++searchSequence,q=$('query').value.trim();if(q.length<2){$('results').replaceChildren();return;}
    try {const result=await request('/search?q='+encodeURIComponent(q));if(sequence!==searchSequence||busy)return;$('results').replaceChildren();message(result.records.length?result.records.length+' matching '+(result.records.length===1?'copy':'copies'):'No matching copy. Import the cert first, then add its photo.');
      for(const c of result.records){const button=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span');button.type='button';title.textContent=c.title;meta.textContent=c.grade+' · '+c.cert+' · '+c.location;button.append(title,meta);button.onclick=()=>select(c.id);$('results').append(button);}
    }catch(error){message(error.message,true);}
  }
  async function renderPrepared() {
    const turn=rotation%2,scale=Math.min(1,4000/Math.max(image.naturalWidth,image.naturalHeight)),w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
    const canvas=document.createElement('canvas');canvas.width=turn?h:w;canvas.height=turn?w:h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/2);ctx.drawImage(image,-w/2,-h/2,w,h);
    prepared=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.93));if(!prepared)throw Error('Could not prepare this photo. Try another image.');
    if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(prepared);$('preview').src=previewUrl;$('preview').hidden=false;$('empty-preview').hidden=true;$('review').hidden=false;
    $('review-note').textContent='Saving the '+side+' of '+record.cert+'. Check the whole cover and label are visible. Previous photos are kept.';
  }
  async function pick(file) {
    if(!file||!record||busy)return;
    if(file.size>20*1024*1024){message('Choose a photo smaller than 20 MB.',true);return;}
    lock(true);$('save').textContent='Preparing preview…';message('Preparing your photo for review…');
    const url=URL.createObjectURL(file),candidate=new Image();
    try {candidate.src=url;await candidate.decode();if(candidate.naturalWidth<150||candidate.naturalHeight<150||candidate.naturalWidth*candidate.naturalHeight>64000000)throw Error('Use a photo at least 150 pixels wide and high, up to 64 megapixels.');image=candidate;rotation=0;await renderPrepared();message('Ready to review. Nothing has been uploaded yet.');}
    catch(error){message(error.message.includes('pixels')?error.message:'This image could not be opened. Take a new photo, or choose a JPG, PNG or WebP image.',true);discard();}
    finally {URL.revokeObjectURL(url);lock(false);}
  }
  $('search-form').onsubmit=e=>{e.preventDefault();clearTimeout(searchTimer);search();};$('query').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,200);};
  for(const name of ['front','back'])$(name).onclick=()=>{if(name===side)return;side=name;discard();paint();message('');};
  $('camera').onclick=()=>$('camera-input').click();$('choose').onclick=()=>$('file-input').click();
  for(const name of ['camera-input','file-input'])$(name).onchange=e=>pick(e.target.files[0]);
  $('rotate').onclick=async()=>{if(!image||busy)return;lock(true);try{rotation=(rotation+1)%4;await renderPrepared();}catch(error){message(error.message,true);}finally{lock(false);}};$('discard').onclick=()=>{discard();message('');};
  $('reload').onclick=()=>select(record.id,{keepPhoto:!!prepared});
  $('save').onclick=async()=>{
    if(!prepared||busy)return;lock(true);message('Saving your '+side+' photo and refreshing the collection…');
    try {const result=await request('/save?id='+encodeURIComponent(record.id)+'&side='+side,{method:'POST',headers:{'Content-Type':'image/jpeg','X-Record-Revision':record.revision},body:prepared});record=result.record;discard();paint();message(result.previewError||'Saved '+side+' photo for '+record.cert+'. '+(side==='front'?'Ready for the back.':'Ready for the next copy.'),!!result.previewError);$('refresh').hidden=phone||!result.previewReady;onSaved(record);}
    catch(error){message(error.message,true);}finally{lock(false);}
  };
  async function unpair(){clearTimeout(pairPoll);if(pairing)await jsonPost('/unpair',{pairingId:pairing.pairingId}).catch(()=>{});pairing=null;$('pair-panel').hidden=true;}
  function showLink(){const link=pairing.links[Number($('network').value)||0];$('qr').src=link.qr;$('pair-link').href=link.url;}
  async function pollPair(){if(!pairing)return;try{const s=await request('/pair-status?pairingId='+pairing.pairingId);$('pair-status').textContent=!s.active?'Link expired. Pair again.':s.saved?s.saved+' photo'+(s.saved===1?'':'s')+' saved from phone.':s.connected?'Phone connected · ready to photograph.':'Waiting for your phone…';if(s.saved&&s.saved!==pairing.saved){pairing.saved=s.saved;if(!prepared)await select(record.id);onSaved(record);$('refresh').hidden=false;}if(s.active)pairPoll=setTimeout(pollPair,2000);}catch{}}
  $('pair').onclick=async()=>{try{await unpair();pairing=await jsonPost('/pair',{id:record.id});$('network').replaceChildren();for(const [index,link] of pairing.links.entries()){const option=document.createElement('option');option.value=index;option.textContent=link.host;$('network').append(option);}$('network-label').hidden=pairing.links.length<2;showLink();$('pair-panel').hidden=false;pollPair();}catch(error){message(error.message,true);}};
  $('network').onchange=showLink;$('unpair').onclick=unpair;$('pair-area').hidden=phone;
  $('refresh').onclick=()=>location.reload();
  return {select,setConnected(value){connected=value;lock(busy);if(!value)message('Photo intake works in the local app. Open it with npm run lab.',true);},pause(){clearTimeout(pairPoll);},resume(){if(pairing)pollPair();}};
}
