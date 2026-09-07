import { formation, cameraDistance } from './engine-layouts.mjs';
import { wallMetrics, constrainWall, moveWall, zoomWall } from './engine-navigation.mjs';
import { matchesSearch, searchShortcuts } from './engine-search.mjs';
import { mountAdmin } from './engine-admin.mjs';
import { mountValueHistory } from './engine-value.mjs';
import { caseMembers, stepWithin, caseFormation, arrivalFrame, advanceArrival, arrivalSequence } from './engine-immersive.mjs';
import { createSingularity } from './engine-singularity.mjs';

const payload=JSON.parse(document.getElementById('engine-data').textContent);
const records=payload.records, $=id=>document.getElementById(id), app=$('engine');
const money=v=>v===null?'Not yet valued':'$'+v.toLocaleString('en-US');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let quiet=reduced.matches, selected=0, mode='orbit', inspecting=true, exploded=false, separation=1, flipped=false, graphics=null,scope='all',tourOn=false;
let rendererFailed=false,unvaluedOnly=false,caseFilter=null;
let insideCase=false,arrivalPlaying=false,arrivalElapsed=0,arrivalTime=0,ambient=false;
const arrivalQueues=Object.fromEntries(['all','comic','card'].map(s=>[s,arrivalSequence(records,s)]));
const browseIndices=()=>insideCase&&mode==='longbox'?caseMembers(records,selected,scope):mode==='singularity'?arrivalQueues[scope]:visibleIndices();
const text=(id,value)=>{$(id).textContent=value;};
const link=(id,url)=>{$(id).hidden=!url;if(url)$(id).href=url;};
function asset(c,side) {
  const url=c.images[side];
  if(url&&c.localScans&&['localhost','127.0.0.1'].includes(location.hostname)&&c[side+'File'])return '../medium/'+encodeURIComponent(c[side+'File']);
  if(!url)return side==='front'?c.previewFront:null;
  if(url.startsWith('data:'))return url;
  if(['localhost','127.0.0.1'].includes(location.hostname)&&c[side+'File'])return '../medium/'+encodeURIComponent(c[side+'File']);
  return url;
}
const visibleIndices=()=>records.map((c,i)=>({c,i})).filter(({c})=>scope==='all'||c.kind===scope).map(({i})=>i);
const sourceText=c=>c.source?c.source+' · '+(c.date||'valuation date not provided'):'No value recorded';
function updateScope(){document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));}
function stopTour(){tourOn=false;$('tour').setAttribute('aria-pressed','false');text('tour','Play tour ▷');if(arrivalPlaying){arrivalPlaying=false;arrivalElapsed=1.4;syncArrival();}}
function syncArrival(){text('arrival-play',arrivalPlaying?'Pause arrivals Ⅱ':'Resume arrivals ▷');$('arrival-play').setAttribute('aria-pressed',String(arrivalPlaying));text('arrival-state',quiet?'STILL / MOTION OFF':arrivalPlaying?'NEXT ARRIVAL / 5 SECONDS':'PAUSED / YOUR MOMENT');}
function setAmbient(value){ambient=value;app.classList.toggle('ambient',ambient);for(const el of document.querySelectorAll('.topline,.scope-switch,.scene-footer,.focus-panel,.object-tools,#singularity-tools'))el.inert=ambient;updateFocus();if(ambient)$('ambient-exit').focus({preventScroll:true});}
function leaveInspection(){stopTour();if(mode==='singularity'){setAmbient(!ambient);return;}insideCase=false;inspecting=false;exploded=false;updateFocus();graphics?.arrange();}
function nextObject(delta){choose(stepWithin(browseIndices(),selected,delta));}
function updateFocus() {
  const c=records[selected];
  text('item-index',String(selected+1).padStart(3,'0'));
  text('focus-label',mode==='singularity'?'LATEST ARRIVAL':'IN FOCUS');
  text('item-title',c.short);text('item-variant',c.variant);text('item-grade',c.grade);text('item-bin',c.container+(c.virtual?' · '+(c.storage||'External storage'):''));text('item-value',money(c.value));
  text('item-source',sourceText(c));$('scan-notice').hidden=c.hasScan;text('scan-notice',c.scanStatus==='no-scans-on-cert-page'?'No scans on PSA cert page':'Scan pending · record imported');
  const indices=browseIndices();text('object-count',indices.includes(selected)?String(indices.indexOf(selected)+1).padStart(3,'0')+' / '+indices.length:'UNSCANNED');
  $('explode').disabled=!c.hasScan;$('explode').title=c.hasScan?'Study front and reverse scans together':'Study will be available when the scans are retrieved';
  $('flip').disabled=!c.images.back;$('flip').title=c.images.back?'Turn the copy over':'No reverse scan recorded';
  app.dataset.holder=c.holder||'slab';
  app.classList.toggle('overview',!inspecting);app.classList.toggle('exploded',exploded&&inspecting);
  app.dataset.formation=mode;
  $('focus-panel').inert=!inspecting||ambient;$('object-tools').inert=!inspecting||ambient;
  $('scene-caption').setAttribute('aria-hidden',String(inspecting||mode!=='orbit'));
  $('explode').setAttribute('aria-pressed',String(exploded));$('flip').setAttribute('aria-pressed',String(flipped));
  $('separation-wrap').hidden=!exploded||!inspecting;$('layer-callouts').hidden=!exploded||!inspecting;
  $('spotlight-tools').hidden=mode!=='spotlight';$('vault-notice').hidden=mode!=='longbox'||scope==='comic'||insideCase;
  app.classList.toggle('inside-case',insideCase&&mode==='longbox');
  $('case-session').hidden=!insideCase||mode!=='longbox';$('case-entry').hidden=mode!=='longbox'||insideCase;
  text('case-title',c.container);text('case-position',String(indices.indexOf(selected)+1).padStart(3,'0')+' / '+indices.length+' IN THIS CASE');
  text('case-enter','Enter '+c.container+' ↗');
  $('singularity-tools').hidden=mode!=='singularity';$('singularity-caption').hidden=mode!=='singularity';$('ambient-exit').hidden=!ambient;
  $('explode').hidden=mode==='singularity';
  text('inspect-toggle',mode==='singularity'?'Hide controls ↗':insideCase?'Leave this case ↗':inspecting?'Return to collection ↗':'Inspect selected object ↗');
  text('hint',mode==='spotlight'&&!exploded?(inspecting?'DRAG COPY TO TURN · SCROLL TO ROAM':'DRAG / SCROLL TO ROAM · PINCH TO ZOOM'):inspecting?(exploded?'DRAG TO PAN · ZOOM INTO THE SCANS':'DRAG TO TURN · X TO STUDY'):'DRAG TO ORBIT · PINCH / SCROLL TO ZOOM');
  if(insideCase)text('hint','SWIPE THE RIBBON · DRAG COPY TO TURN · ESC TO LEAVE');
  if(mode==='singularity')text('hint','TOUCH TO PAUSE · DRAG COPY TO TURN · H TO HIDE CONTROLS');
}
function choose(i) {
  if(mode==='longbox'&&!insideCase){graphics?.saveOverview();insideCase=true;}
  selected=(i+records.length)%records.length;if(scope!=='all'&&records[selected].kind!==scope){scope=records[selected].kind;updateScope();}
  if(mode==='singularity')arrivalElapsed=arrivalPlaying&&!quiet?0:1.4;
  inspecting=true;flipped=false;exploded=false;separation=1;$('separation').value='100';text('separation-value','100%');updateFocus();graphics?.select();
}
function arrange(next) {
  stopTour();insideCase=false;setAmbient(false);mode=next;inspecting=next==='singularity';exploded=false;flipped=false;
  document.querySelectorAll('[data-formation]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.formation===mode)));
  text('scene-name',({orbit:'01 — ORBITAL ARRAY',wall:'02 — CHROMATIC WALL',longbox:'03 — INSIDE THE CASE',spotlight:'04 — SPOTLIGHT / AFTER HOURS',singularity:'05 — SINGULARITY'})[mode]);
  if(mode==='singularity'){arrivalPlaying=!quiet;arrivalElapsed=quiet?1.4:0;syncArrival();}
  updateFocus();graphics?.arrange(true);
  if(mode==='singularity')graphics?.select();
}
function toggleExplosion() {
  if(mode==='singularity')return;
  if(!records[selected].hasScan)return;
  stopTour();inspecting=true;exploded=!exploded;flipped=false;separation=1;$('separation').value='100';text('separation-value','100%');updateFocus();graphics?.resetHero();
}
function motion() {
  app.classList.toggle('quiet',quiet);$('motion').setAttribute('aria-pressed',String(quiet));text('motion-state',quiet?'off':'on');
  if(quiet&&mode==='singularity')arrivalElapsed=1.4;syncArrival();
}
$('motion').onclick=()=>{quiet=!quiet;if(quiet)stopTour();motion();};reduced.addEventListener('change',e=>{quiet=e.matches;if(quiet)stopTour();motion();});motion();
document.querySelectorAll('[data-formation]').forEach(b=>b.onclick=()=>arrange(b.dataset.formation));
document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{stopTour();insideCase=false;scope=b.dataset.scope;updateScope();const indices=visibleIndices();if(!indices.includes(selected))selected=indices[0];exploded=false;flipped=false;if(mode==='longbox')inspecting=false;updateFocus();graphics?.arrange();if(inspecting)graphics?.select();});
$('tour').onclick=()=>{tourOn=!tourOn;if(tourOn){quiet=false;motion();}text('tour',tourOn?'Pause tour Ⅱ':'Play tour ▷');$('tour').setAttribute('aria-pressed',String(tourOn));graphics?.restartTour();};
$('wall-zoom-in').onclick=()=>{stopTour();graphics?.zoomWall(.8);};
$('wall-zoom-out').onclick=()=>{stopTour();graphics?.zoomWall(1.25);};
$('wall-center').onclick=()=>{stopTour();inspecting=false;exploded=false;updateFocus();graphics?.arrange(true);};
$('home').onclick=()=>arrange('orbit');$('previous').onclick=()=>{stopTour();nextObject(-1);};$('next').onclick=()=>{stopTour();nextObject(1);};
$('explode').onclick=toggleExplosion;$('flip').onclick=()=>{stopTour();if(!records[selected].images.back)return;flipped=!flipped;exploded=false;updateFocus();graphics?.resetHero();};
$('inspect-toggle').onclick=()=>{if(inspecting)leaveInspection();else choose(selected);};
$('case-leave').onclick=leaveInspection;$('case-enter').onclick=()=>choose(selected);
$('arrival-play').onclick=()=>{if(arrivalPlaying)stopTour();else{arrivalPlaying=true;quiet=false;motion();arrivalElapsed=1.4;syncArrival();}};
$('ambient-start').onclick=()=>setAmbient(true);$('ambient-exit').onclick=()=>setAmbient(false);
$('separation').oninput=e=>{separation=Number(e.target.value)/100;text('separation-value',e.target.value+'%');};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function openRecord() {
  stopTour();const c=records[selected];text('record-title',c.short);text('record-variant',c.variant);text('record-grade',c.grade);
  text('record-id-label',c.provider==='Authority'?'AUTHORITY ID':'CERTIFICATION');
  text('verify-link',c.provider==='Authority'?'Authority record ↗':'Verify certification ↗');
  $('record-details').replaceChildren();
  for(const [label,value] of c.details||[]){if(!value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('record-details').append(dt,dd);}
  $('record-details').hidden=!c.details?.length;
  text('record-cert',c.cert);text('record-bin',c.container+(c.virtual?' · '+(c.storage||'External storage'):''));text('record-value',money(c.value));text('record-source',sourceText(c)+(c.importedAt?' · imported '+c.importedAt:''));
  $('record-scan-notice').hidden=c.hasScan;text('record-scan-notice',c.scanStatus==='no-scans-on-cert-page'?'PSA currently supplies no scans for this cert. Your imported record is retained; no similar-card photo has been substituted.':'Scans are pending retrieval from the certification page. The collection record is already imported.');
  for(const side of ['front','back']) {const img=$('record-'+side),url=c.images[side]?asset(c,side):null;img.hidden=!url;if(url){img.src=url;img.alt=c.short+' '+side+' scan';img.onerror=()=>{img.hidden=true;};}}
  link('verify-link',c.verify);link('value-link',c.evidence);link('bin-link',c.href);$('record-dialog').showModal();
}
$('record').onclick=openRecord;
const shortcuts=searchShortcuts(records);
for(const [group,id] of [['names','search-names'],['keywords','search-keywords']]) {
  for(const item of shortcuts[group]) {
    const button=document.createElement('button');button.className='search-chip';
    button.setAttribute('aria-label',`Find ${item.label}, ${item.count} ${item.count===1?'object':'objects'}`);
    const label=document.createElement('span');label.textContent=item.label;
    const count=document.createElement('small');count.textContent=item.count;count.setAttribute('aria-hidden','true');
    button.append(label,count);button.onclick=()=>{$('query').value=item.label;search();$('results').focus({preventScroll:true});};$(id).append(button);
  }
  $(id).parentElement.hidden=!shortcuts[group].length;
}
function search() {
  const q=$('query').value.trim();
  const matches=records.map((c,i)=>({c,i})).filter(({c})=>(!caseFilter||c.bin===caseFilter)&&matchesSearch(c,q,{unvaluedOnly}));
  $('search-discovery').hidden=!!q||unvaluedOnly;$('search-reset').hidden=!q&&!unvaluedOnly;
  $('search-unvalued').setAttribute('aria-pressed',String(unvaluedOnly));$('search-all-values').setAttribute('aria-pressed',String(!unvaluedOnly));
  text('search-unvalued-count',records.filter(c=>(!caseFilter||c.bin===caseFilter)&&matchesSearch(c,q,{unvaluedOnly:true})).length);
  text('search-count',matches.length+(matches.length===1?' object':' objects'));$('results').replaceChildren();
  for(const {c,i} of matches) {
    const button=document.createElement('button');button.className='result';const identity=document.createElement('span');identity.textContent=c.title;
    const meta=document.createElement('small');meta.textContent=c.grade+' · '+c.container+' · '+c.cert;identity.append(meta);
    const price=document.createElement('span');price.textContent=money(c.value)+' ↗';button.append(identity,price);
    button.onclick=()=>{$('search-dialog').close();choose(i);if(rendererFailed)openRecord();};$('results').append(button);
  }
  if(!matches.length){const p=document.createElement('p');p.textContent='No matching objects. Try a title or certification number.';$('results').append(p);}
}
function focusSearch(){(innerWidth<=650?$('search-title'):$('query')).focus({preventScroll:true});}
function clearSearch(){ $('query').value='';unvaluedOnly=false;caseFilter=null;search();focusSearch(); }
function openSearch({unvalued=false}={}){stopTour();$('query').value='';unvaluedOnly=unvalued;caseFilter=null;search();$('search-dialog').showModal();focusSearch();}
$('search-reset').onclick=clearSearch;
$('search-unvalued').onclick=()=>{unvaluedOnly=true;search();};$('search-all-values').onclick=()=>{unvaluedOnly=false;search();};
$('search').onclick=$('fallback-search').onclick=openSearch;$('query').oninput=()=>{caseFilter=null;search();};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&ambient){e.preventDefault();setAmbient(false);return;}
  if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(e.key==='Escape'){e.preventDefault();if(mode==='singularity')stopTour();else leaveInspection();return;}
  if(['BUTTON','A'].includes(e.target.tagName)&&e.code==='Space')return;
  if(mode==='spotlight'&&!inspecting&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','+','=','-'].includes(e.key)){
    e.preventDefault();stopTour();
    if(e.key==='Home')graphics?.arrange(true);
    else if(['+','=','-'].includes(e.key))graphics?.zoomWall(e.key==='-'?1.25:.8);
    else graphics?.panWall(e.key==='ArrowLeft'?-120:e.key==='ArrowRight'?120:0,e.key==='ArrowUp'?-120:e.key==='ArrowDown'?120:e.key==='PageUp'?-innerHeight*.7:e.key==='PageDown'?innerHeight*.7:0);
    return;
  }
  if(e.key==='/'){e.preventDefault();openSearch();}
  if(e.key==='ArrowRight'){e.preventDefault();stopTour();nextObject(1);}
  if(e.key==='ArrowLeft'){e.preventDefault();stopTour();nextObject(-1);}
  if(e.key.toLowerCase()==='x'){e.preventDefault();toggleExplosion();}
  if(e.key.toLowerCase()==='h'&&mode==='singularity'){e.preventDefault();setAmbient(!ambient);}
  if(e.code==='Space'){e.preventDefault();if(mode==='singularity')$('arrival-play').click();else if(inspecting)leaveInspection();else choose(selected);}
});
updateFocus();
mountAdmin({payload,onOpen:stopTour,onBinChange:bin=>{for(const c of records)if(c.bin===bin.id){c.container=bin.title;c.storage=bin.location;}updateFocus();}});
mountValueHistory({history:payload.valueHistory,onOpen:stopTour,onUnvalued:()=>openSearch({unvalued:true})});
const linkedCase=new URLSearchParams(location.search).get('case');
if(linkedCase&&records.some(c=>c.bin===linkedCase)){openSearch();caseFilter=linkedCase;$('query').value=records.find(c=>c.bin===linkedCase).container;search();}

async function start() {
  const [THREE,{RoomEnvironment},{RoundedBoxGeometry}]=await Promise.all([import('three'),import('three/addons/environments/RoomEnvironment.js'),import('three/addons/geometries/RoundedBoxGeometry.js')]);
  const canvas=$('universe'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  let width=innerWidth,height=innerHeight,mobile=width<651,aspect=width/height;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.75));renderer.setSize(width,height);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x060d13);scene.fog=new THREE.FogExp2(0x060d13,.018);
  const camera=new THREE.PerspectiveCamera(42,aspect,.1,200);camera.position.set(0,.3,15);
  // Inspection is rendered after the collection with its own depth buffer/camera.
  // A longbox can contain positive-z slabs; those must never occlude the selected copy.
  const foreground=new THREE.Scene(),heroCamera=new THREE.PerspectiveCamera(42,aspect,.1,100);heroCamera.position.set(0,0,15);
  renderer.autoClear=false;
  const pmrem=new THREE.PMREMGenerator(renderer),envScene=new RoomEnvironment();
  const env=pmrem.fromScene(envScene,.035);scene.environment=env.texture;envScene.dispose();pmrem.dispose();
  foreground.environment=env.texture;foreground.add(new THREE.HemisphereLight(0xd3eaff,0x324454,2));
  const heroLight=new THREE.DirectionalLight(0xffffff,3);heroLight.position.set(4,7,8);foreground.add(heroLight);
  scene.add(new THREE.HemisphereLight(0xa4d5ed,0x0b1b22,2));
  const key=new THREE.DirectionalLight(0xe2f7ff,3);key.position.set(5,7,6);scene.add(key);
  const rim=new THREE.PointLight(0xbaffaa,65,30,2);rim.position.set(-5,3,4);scene.add(rim);
  const blue=new THREE.PointLight(0x3eacff,60,40,2);blue.position.set(6,-1,2);scene.add(blue);
  const loader=new THREE.TextureLoader();
  const [atlas,backAtlas]=await Promise.all([loader.loadAsync(payload.atlas),loader.loadAsync(payload.backAtlas)]);
  for(const texture of [atlas,backAtlas]){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
  const field=new THREE.Group();scene.add(field);
  const planeGeo=new THREE.PlaneGeometry(1,1.578),cellAttr=new Float32Array(records.length*2);
  records.forEach((c,i)=>{cellAttr[i*2]=i%payload.columns;cellAttr[i*2+1]=payload.rows-1-Math.floor(i/payload.columns);});
  planeGeo.setAttribute('atlasCell',new THREE.InstancedBufferAttribute(cellAttr,2));
  const planeMat=new THREE.MeshBasicMaterial({map:atlas,color:0xffffff,toneMapped:false,fog:false});
  planeMat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 atlasCell; varying vec2 vCell;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvCell=atlasCell;');
    shader.fragmentShader='varying vec2 vCell;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec2 tileUV=(clamp(vMapUv,vec2(0.008),vec2(0.992))+vCell)/vec2(${payload.columns}.0,${payload.rows}.0); diffuseColor*=texture2D(map,tileUV);`);
  };
  planeMat.customProgramCacheKey=()=>`collection-atlas-${payload.columns}-${payload.rows}`;
  const covers=new THREE.InstancedMesh(planeGeo,planeMat,records.length);covers.frustumCulled=false;field.add(covers);
  // Rotate the reverse geometry, including its normals, so its own image reads
  // correctly from behind. Never mirror the front or paint over the case edge.
  const backPlaneMat=planeMat.clone();backPlaneMat.map=backAtlas;
  backPlaneMat.onBeforeCompile=planeMat.onBeforeCompile;backPlaneMat.customProgramCacheKey=planeMat.customProgramCacheKey;
  const backs=new THREE.InstancedMesh(planeGeo.clone().rotateY(Math.PI),backPlaneMat,records.length);backs.frustumCulled=false;field.add(backs);
  const shellMat=new THREE.MeshStandardMaterial({color:0x25404d,roughness:.32,metalness:.6});
  const shells=new THREE.InstancedMesh(new THREE.BoxGeometry(1.055,1.635,.078),shellMat,records.length);shells.frustumCulled=false;field.add(shells);
  const dummy=new THREE.Object3D(),offset=new THREE.Vector3(0,0,.047),transformedOffset=new THREE.Vector3(),quat=new THREE.Quaternion(),euler=new THREE.Euler();
  const coverTint=new THREE.Color(),shellTint=new THREE.Color();
  function viewTargets(){if(mode==='longbox'&&insideCase)return caseFormation(records,selected,aspect,scope);const indices=visibleIndices(),anchor=Math.max(0,indices.indexOf(selected)),poses=formation(mode,indices.map(i=>records[i]),aspect,anchor),byIndex=new Map(indices.map((i,j)=>[i,poses[j]]));return records.map((c,i)=>byIndex.get(i)||{x:0,y:0,z:-70,rx:0,ry:0,rz:0,scale:0});}
  let targets=viewTargets(),positions=targets.map((p,i)=>quiet?{...p}:{x:Math.sin(i*7.1)*2,y:Math.cos(i*3.2)*2,z:-25-i*.07,rx:0,ry:0,rz:i*.11,scale:.3});
  let hover=-1,zoom=1,fieldRX=0,fieldRY=0,heroRX=0,heroRY=0,panX=0,panY=0,spread=0,currentScale=.01,last=0,tourAt=0;
  let wallView={x:0,y:0,zoom:1};
  let overviewPose=null,caseDrag=0,wheelTravel=0,lastWheel=0;
  const metrics=()=>wallMetrics(targets,aspect,wallView.zoom,height);
  function releaseToWall(){if(mode==='spotlight'&&inspecting){inspecting=false;exploded=false;updateFocus();}}
  function panWall(dx,dy){releaseToWall();wallView=moveWall(wallView,dx,dy,metrics());}
  function changeWallZoom(factor,anchor){releaseToWall();wallView=zoomWall(wallView,factor,targets,aspect,height,anchor);text('wall-zoom',Math.round(100/wallView.zoom)+'%');}
  function centerWall(){wallView={x:0,y:(targets[selected]?.y||0)-wallMetrics(targets,aspect,1,height).halfH*.72,zoom:1};wallView=constrainWall(wallView,metrics());text('wall-zoom','100%');}

  // The focused object is separate from the atlas. Its original front/reverse scans stay intact.
  const hero=new THREE.Group();foreground.add(hero);
  const caseGeo=new RoundedBoxGeometry(1.085,1.70,.035,2,.025);
  const caseMaterial=new THREE.MeshPhysicalMaterial({color:0xadd8e5,metalness:.1,roughness:.16,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.045,depthWrite:false});
  const caseLineMat=new THREE.LineBasicMaterial({color:0xa4d8e5,transparent:true,opacity:.22});
  function casing(){const g=new THREE.Group();g.add(new THREE.Mesh(caseGeo,caseMaterial));g.add(new THREE.LineSegments(new THREE.EdgesGeometry(caseGeo,30),caseLineMat));return g;}
  const rear=casing(),front=casing();
  const artGeo=new THREE.PlaneGeometry(1,1.578);
  const frontMat=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
  const backMat=new THREE.MeshBasicMaterial({color:0x243441,side:THREE.DoubleSide,toneMapped:false});
  const obverse=new THREE.Mesh(artGeo,frontMat),reverse=new THREE.Mesh(artGeo,backMat);
  const parts=[rear,reverse,obverse,front];parts.forEach(p=>hero.add(p));
  const core=new THREE.Mesh(new THREE.BoxGeometry(1.022,1.60,.026),new THREE.MeshStandardMaterial({color:0x0c1d26,roughness:.45,metalness:.3}));hero.add(core);
  const connectors=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xb8e2d0,transparent:true,opacity:.2}));hero.add(connectors);
  const connectionPoints=new Float32Array(8*3);connectors.geometry.setAttribute('position',new THREE.BufferAttribute(connectionPoints,3));
  const textureCache=new Map();let request=0;
  function placeholder(c,side){
    const surface=document.createElement('canvas');surface.width=320;surface.height=500;const ctx=surface.getContext('2d');
    ctx.fillStyle='#142834';ctx.fillRect(0,0,320,500);ctx.strokeStyle='#426471';ctx.strokeRect(13,13,294,474);ctx.fillStyle='#c7e3dc';ctx.font='14px monospace';ctx.fillText(c.grade,28,48);ctx.font='12px monospace';ctx.fillText(side.toUpperCase()+' SCAN',28,230);ctx.fillStyle='#88a8b8';ctx.fillText('Not available',28,255);ctx.fillText(c.cert,28,445);
    const t=new THREE.CanvasTexture(surface);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  function atlasPreview(i,side="front"){const t=(side==="back"?backAtlas:atlas).clone();t.repeat.set(.984/payload.columns,.984/payload.rows);t.offset.set((i%payload.columns+.008)/payload.columns,(payload.rows-1-Math.floor(i/payload.columns)+.008)/payload.rows);t.needsUpdate=true;return t;}
  let previewTex=null,fallbackBack=null;
  function fitScan(mesh,texture){const w=texture.image?.width,h=texture.image?.height;if(w&&h){const ratio=w/h;mesh.scale.set(Math.min(1,ratio*1.578),Math.min(1,1/(ratio*1.578)),1);}}
  async function loadFocus() {
    const c=records[selected],ticket=++request;obverse.scale.set(1,1,1);reverse.scale.set(1,1,1);
    rear.visible=front.visible=c.holder!=='soft-sleeve';core.scale.z=c.holder==='soft-sleeve'?.2:1;
    previewTex?.dispose();previewTex=atlasPreview(selected);frontMat.map=previewTex;frontMat.color.set(0xffffff);frontMat.needsUpdate=true;
    fallbackBack?.dispose();fallbackBack=atlasPreview(selected,'back');backMat.map=fallbackBack;backMat.color.set(0xffffff);backMat.needsUpdate=true;
    for(const [side,mat] of [['front',frontMat],['back',backMat]]) {
      const url=asset(c,side);if(!url)continue;
      try {
        let tex=textureCache.get(url);
        if(!tex){tex=await loader.loadAsync(url);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textureCache.set(url,tex);}
        if(ticket===request){mat.map=tex;mat.needsUpdate=true;fitScan(side==='front'?obverse:reverse,tex);}
        // Bound the high-resolution cache; the current scan pair is retained.
        while(textureCache.size>16){const oldest=textureCache.keys().next().value;if(oldest===asset(records[selected],'front')||oldest===asset(records[selected],'back')){const keep=textureCache.get(oldest);textureCache.delete(oldest);textureCache.set(oldest,keep);continue;}textureCache.get(oldest).dispose();textureCache.delete(oldest);}
      }catch{if(ticket===request)text('status','Detail scan unavailable · collection preview retained');}
    }
  }

  // Sparse depth cues are drawn as a few batches, not hundreds of moving DOM elements.
  const dustGeometry=new THREE.BufferGeometry(),dustCount=mobile?420:850,dustPositions=new Float32Array(dustCount*3);
  for(let i=0;i<dustCount;i++){dustPositions[i*3]=Math.sin(i*127.1)*45;dustPositions[i*3+1]=Math.cos(i*311.7)*24;dustPositions[i*3+2]=-5-(i%83)*.62;}
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
  const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0x91cfec,size:.025,transparent:true,opacity:.38,sizeAttenuation:true,depthWrite:false}));scene.add(dust);
  const halo=new THREE.Group();scene.add(halo);
  for(let j=0;j<3;j++) {
    const pts=[];for(let i=0;i<=160;i++){const a=i/160*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*(4.1+j*1.8),Math.sin(a)*(4.1+j*1.8),0));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:j===1?0xb8e3b4:0x5e9ac0,transparent:true,opacity:j===1?.13:.1}));line.rotation.set(.2+j*.45,.32+j*.22,-.2+j*.33);line.position.z=-2-j*2;halo.add(line);
  }
  const floor=new THREE.GridHelper(100,50,0x37627a,0x1b3b4d);floor.position.y=-8;floor.material.transparent=true;floor.material.opacity=.16;scene.add(floor);
  const boxTrace=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7,.8,10)),new THREE.LineBasicMaterial({color:0x96dfd6,transparent:true,opacity:.14}));boxTrace.position.set(-1.2,-5,-4);scene.add(boxTrace);
  const singularity=createSingularity(THREE,{scene,foreground,atlas,columns:payload.columns,rows:payload.rows,records,mobile});
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),pointers=new Map();let down=null,pinch=null,moved=false;
  function ray(x,y,targetCamera=camera){covers.computeBoundingSphere();backs.computeBoundingSphere();ndc.set(x/width*2-1,-y/height*2+1);raycaster.setFromCamera(ndc,targetCamera);}
  const hitCopy=()=>mode==='singularity'?null:raycaster.intersectObjects([covers,backs],false).find(hit=>targets[hit.instanceId]?.scale>0&&(!inspecting||hit.instanceId!==selected));
  function hitHero(x,y){if(!inspecting)return false;ray(x,y,heroCamera);return raycaster.intersectObjects([obverse,reverse,...(core.visible?[core]:[])],false).length>0;}
  let pinchCenter=null;
  canvas.addEventListener('pointerdown',e=>{
    stopTour();caseDrag=0;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1){down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,onHero:hitHero(e.clientX,e.clientY)};moved=false;}
    else{down=null;moved=true;const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);pinchCenter={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)){
      ray(e.clientX,e.clientY);hover=hitCopy()?.instanceId??-1;canvas.style.cursor=hover>=0?'pointer':'grab';
      if(mode==='spotlight'){app.style.setProperty('--spot-x',e.clientX/width*100+'%');app.style.setProperty('--spot-y',e.clientY/height*100+'%');}return;
    }
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>1){const p=[...pointers.values()],distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),center={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
      if(pinch>0&&distance>0){if(mode==='spotlight'&&!exploded){changeWallZoom(pinch/distance,{x:center.x/width*2-1,y:1-center.y/height*2});if(pinchCenter)panWall(pinchCenter.x-center.x,pinchCenter.y-center.y);}else zoom=Math.max(.5,Math.min(2.2,zoom*pinch/distance));}
      pinch=distance;pinchCenter=center;return;}
    if(!down)return;
    const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;down.lastX=e.clientX;down.lastY=e.clientY;
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)moved=true;
    if(mode==='spotlight'&&!exploded&&!down.onHero){if(moved)panWall(-dx,-dy);}
    else if(insideCase&&!exploded&&!down.onHero){caseDrag+=mobile?dy:dx;if(Math.abs(caseDrag)>60){nextObject(caseDrag<0?1:-1);caseDrag=0;}}
    else if(inspecting&&exploded){panX=Math.max(-4,Math.min(4,panX+dx/height*10));panY=Math.max(-4,Math.min(4,panY-dy/height*10));}
    else if(inspecting){heroRY+=dx*.009;heroRX=Math.max(-.85,Math.min(.85,heroRX+dy*.006));}
    else{fieldRY+=dx*.005;fieldRX=Math.max(-.8,Math.min(.8,fieldRX+dy*.005));}
  });
  canvas.addEventListener('pointerup',e=>{
    // Frame lines have a wide raycast threshold and can steal adjacent-cover clicks.
    // Only the actual scan surfaces and visible solid holder participate in picking.
    if(!moved&&down&&pointers.size===1){if(hitHero(e.clientX,e.clientY)){if(!exploded&&mode!=='singularity'&&!insideCase)toggleExplosion();}else {ray(e.clientX,e.clientY);const hit=hitCopy();if(hit){choose(hit.instanceId);if(hit.object===backs){flipped=true;updateFocus();}}else if(mode==='spotlight')releaseToWall();}}
    pointers.delete(e.pointerId);down=null;pinch=null;
  });
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;pinch=null;moved=true;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();stopTour();const unit=e.deltaMode===1?16:e.deltaMode===2?height:1,dx=e.deltaX*unit,dy=e.deltaY*unit;
    if(mode==='spotlight'&&!exploded){if(e.ctrlKey||e.metaKey)changeWallZoom(Math.exp(dy*.002),{x:e.clientX/width*2-1,y:1-e.clientY/height*2});else panWall(e.shiftKey?dy:dx,e.shiftKey?0:dy);}
    else if(insideCase&&!exploded&&!e.ctrlKey&&!e.metaKey){if(performance.now()-lastWheel>220)wheelTravel=0;wheelTravel+=Math.abs(dx)>Math.abs(dy)?dx:dy;lastWheel=performance.now();if(Math.abs(wheelTravel)>65){nextObject(wheelTravel>0?1:-1);wheelTravel=0;}}
    else zoom=Math.max(.5,Math.min(2.2,zoom*Math.exp(dy*.001)));
  },{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);fail('The graphics context was interrupted. The collection records are still available below.');});
  graphics={
    saveOverview(){overviewPose={fieldRX,fieldRY,zoom};},
    select(){heroRX=heroRY=panX=panY=0;zoom=1;targets=viewTargets();if(tourOn&&mode==='spotlight')centerWall();
      const p=positions[selected];if(p&&mode!=='singularity'){const start=field.localToWorld(new THREE.Vector3(p.x,p.y,p.z-field.position.z)).project(camera),halfH=Math.tan(21*Math.PI/180)*15;hero.position.set(Math.max(-halfH*aspect,Math.min(halfH*aspect,start.x*halfH*aspect)),Math.max(-halfH,Math.min(halfH,start.y*halfH)),0);currentScale=.65;}
      if(mode==='singularity'){hero.position.set(mobile?0:-2.6,mobile?1.3:.45,0);currentScale=mobile?2.35:3.45;}loadFocus();
    },resetHero(){heroRX=heroRY=panX=panY=0;zoom=1;},
    arrange(reset=false){targets=viewTargets();if(mode==='longbox'&&!insideCase&&overviewPose&&!reset){({fieldRX,fieldRY,zoom}=overviewPose);overviewPose=null;}else{fieldRX=fieldRY=0;zoom=1;if(reset)overviewPose=null;}if(mode==='spotlight'){if(reset)centerWall();else wallView=constrainWall(wallView,metrics());}},
    panWall,zoomWall:changeWallZoom,restartTour(){tourAt=performance.now();if(tourOn)choose(selected);}
  };
  addEventListener('resize',()=>{width=innerWidth;height=innerHeight;aspect=width/height;mobile=width<651;camera.aspect=heroCamera.aspect=aspect;camera.updateProjectionMatrix();heroCamera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.75));renderer.setSize(width,height);targets=viewTargets();singularity.resize(mobile);if(mode==='spotlight')wallView=constrainWall(wallView,metrics());});
  const projected=new THREE.Vector3(),corners=[[-.51,.79],[-.51,-.79],[.51,.79],[.51,-.79]],caseOffsets=[-1.5,-.5,.5,1.5];
  function animate(now) {
    if(tourOn&&mode==='spotlight'&&now-tourAt>6500){tourAt=now;nextObject(1);}
    const dt=Math.min((now-last)/1000||.016,.05);last=now;const alpha=quiet?1:1-Math.exp(-dt*5.0);
    const isSingularity=mode==='singularity',blocked=!!document.querySelector('dialog[open]');
    const clock=advanceArrival(arrivalElapsed,dt,{active:isSingularity,playing:arrivalPlaying,quiet,blocked});arrivalElapsed=clock.elapsed;
    if(clock.advance)nextObject(1);
    if(isSingularity&&!quiet&&!blocked)arrivalTime+=dt;
    const arrival=arrivalFrame(arrivalElapsed);if(isSingularity)$('arrival-progress').style.transform='scaleX('+arrival.phase+')';
    const distance=(insideCase?(mobile?14.5:15):isSingularity?(mobile?21:17):cameraDistance(mode,aspect,visibleIndices().length))*(mode==='spotlight'?wallView.zoom:inspecting?1:zoom);
    heroCamera.position.z+=(15*zoom-heroCamera.position.z)*alpha;
    camera.position.z+=(distance-camera.position.z)*alpha;
    const camY=mode==='spotlight'?wallView.y:mode==='longbox'&&!insideCase?(mobile?11:7):0;
    camera.position.x+=((mode==='spotlight'?wallView.x:0)-camera.position.x)*alpha;
    camera.position.y+=(camY-camera.position.y)*alpha;camera.lookAt(mode==='spotlight'?camera.position.x:0,mode==='spotlight'?camera.position.y:mode==='longbox'&&!insideCase?(mobile?-4.5:-1.8):0,-3);
    field.rotation.x+=((insideCase?0:fieldRX)-field.rotation.x)*alpha;field.rotation.y+=((insideCase?0:fieldRY)-field.rotation.y)*alpha;
    field.rotation.z=quiet||mode==='spotlight'||mode==='longbox'?0:Math.sin(now*.00004)*.016;
    field.visible=!isSingularity;
    // Rotate around the collection's depth, so turning it around cannot swing
    // the rear rows through the camera and crop away most of the collection.
    field.position.z+=((mode==='orbit'?-9:mode==='longbox'?-3:-4)-field.position.z)*alpha;
    for(let i=0;i<positions.length;i++) {
      const p=positions[i],t=targets[i];for(const k of ['x','y','z','rx','ry','rz','scale'])p[k]+=(t[k]-p[k])*alpha;
      const factor=(inspecting&&i===selected ? .001 : 1+(i===hover&&!inspecting ? mode==='spotlight'?.045:.1 : 0))*(records[i].kind==='card'?.78:1);
      dummy.position.set(p.x,p.y,p.z-field.position.z);euler.set(p.rx,p.ry,p.rz);quat.setFromEuler(euler);dummy.quaternion.copy(quat);dummy.scale.setScalar(p.scale*factor);dummy.updateMatrix();shells.setMatrixAt(i,dummy.matrix);
      transformedOffset.copy(offset).applyQuaternion(quat).multiplyScalar(p.scale*factor);
      dummy.position.add(transformedOffset);dummy.updateMatrix();covers.setMatrixAt(i,dummy.matrix);
      dummy.position.addScaledVector(transformedOffset,-2);dummy.updateMatrix();backs.setMatrixAt(i,dummy.matrix);
    }
    covers.instanceMatrix.needsUpdate=true;backs.instanceMatrix.needsUpdate=true;shells.instanceMatrix.needsUpdate=true;
    const dim=inspecting?(exploded?.014:insideCase?.7:mode==='spotlight'?.18:.08):1;planeMat.color.lerp(coverTint.setRGB(dim,dim,dim),alpha);backPlaneMat.color.copy(planeMat.color);shellMat.color.lerp(shellTint.set(inspecting?0x0a1720:0x345366),alpha);
    const desiredSpread=exploded?1:0;spread+=(desiredSpread-spread)*alpha;
    const scale=inspecting?(mobile?(exploded?1.95*separation:isSingularity?(ambient?2.6:2.05):insideCase?2.4:2.55):(exploded?2.65*separation:ambient?4.5:3.5))*(records[selected].kind==='card'?.86:1):0;
    currentScale+=(scale-currentScale)*alpha;hero.scale.setScalar(Math.max(.001,currentScale));hero.visible=currentScale>.01;
    hero.position.x+=((mobile?0:ambient?-.7:isSingularity?-2.6:insideCase?-1.2:-1.7)+(exploded?panX:0)-hero.position.x)*alpha;
    hero.position.y+=((ambient?.12:mobile?(mode==='spotlight'&&!exploded?.95:insideCase||isSingularity?1.05:1.30):.55)+(exploded?panY:0)-hero.position.y)*alpha;
    const sway=quiet?0:Math.sin(now*.0006)*.035;
    hero.rotation.x+=((exploded?0:heroRX+.02)-hero.rotation.x)*alpha;
    hero.rotation.y+=((exploded?0:heroRY+(flipped?Math.PI:-.13)+sway)-hero.rotation.y)*alpha;
    hero.rotation.z+=((exploded?0:quiet?-.025:-.025+Math.sin(now*.0004)*.01)-hero.rotation.z)*alpha;
    parts.forEach((part,i)=>{const o=caseOffsets[i],side=i<2?1:-1;part.position.set(side*.59*spread,0,o*.035);});
    reverse.rotation.y=Math.PI*(1-Math.min(1,spread*2));core.visible=spread<.08;
    connectors.visible=false;
    corners.forEach(([x,y],i)=>{connectionPoints.set([x+parts[0].position.x,y+parts[0].position.y,parts[0].position.z,x+parts[3].position.x,y+parts[3].position.y,parts[3].position.z],i*6);});
    connectors.geometry.attributes.position.needsUpdate=true;
    if(exploded&&inspecting){hero.updateMatrixWorld(true);[obverse,reverse].forEach((part,i)=>{projected.set(-.48,-.87,0);part.localToWorld(projected);projected.project(heroCamera);const node=$('callout-'+i);const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;node.style.left=Math.min(width-(mobile?135:165),Math.max(12,x))+'px';node.style.top=Math.min(height-290,Math.max(mobile?150:100,y))+'px';});}
    if(!quiet){dust.rotation.y=now*.000008;halo.rotation.z=now*.000012;}
    halo.visible=mode==='orbit';floor.visible=mode==='longbox';floor.position.y=insideCase?-6:mobile?-13:-8;boxTrace.visible=insideCase;
    singularity.update({active:isSingularity,time:arrivalTime,progress:arrival.phase,capture:arrivalPlaying?arrival.capture:0,index:selected,nextIndex:stepWithin(browseIndices(),selected,1),quiet,hero,assemble:arrival.assemble});
    if(isSingularity&&!quiet&&arrival.assemble<.82)hero.visible=false;
    renderer.clear();renderer.render(scene,camera);renderer.clearDepth();renderer.render(foreground,heroCamera);
  }
  await loadFocus();renderer.setAnimationLoop(animate);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTour();renderer.setAnimationLoop(null);}else{last=0;renderer.setAnimationLoop(animate);}});
  document.documentElement.dataset.engineReady='true';$('boot').classList.add('gone');setTimeout(()=>{$('boot').hidden=true;},700);$('fallback').hidden=true;
  const entry=new URLSearchParams(location.search),entryView=entry.get('view');
  if(['orbit','wall','longbox','spotlight','singularity'].includes(entryView)){arrange(entryView);if(entryView==='singularity'&&entry.get('ambient')==='1'&&!document.querySelector('dialog[open]'))setAmbient(true);}
  text('status',payload.stats.comics+' COMICS · '+payload.stats.cards+' CARDS · '+records.filter(c=>c.hasScan).length+' SCANS');
}
function fail(message){rendererFailed=true;$('boot').hidden=true;$('fallback').hidden=false;text('fallback-message',message);}
start().catch(error=>{console.error('Collection engine:',error);fail('The 3D view could not start. You can still inspect every collection record.');});
