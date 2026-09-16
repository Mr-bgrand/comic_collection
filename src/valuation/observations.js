/** Evidence is copy-scoped. Import never selects; selection is a separate owner action. */
const bases=new Set(['guide','sold-comps','psa-comparison','owner','raw-reference']);
const soldEvidence = o => o.basis==='sold-comps'||o.evidenceKind==='sold-comps';
export const isRaw = r => r?.grading?.status === 'raw';
export function assessedCondition(r) { const c=r?.condition;return typeof c==='string'?!!c.trim()&&!/^(unknown|unassessed|ungraded)$/i.test(c.trim()):!!c&&typeof c==='object'&&['grade','label','description'].some(k=>typeof c[k]==='string'&&c[k].trim()&&!/^(unknown|unassessed|ungraded)$/i.test(c[k].trim())); }
const canonical = value => Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export function copyId(r) { if(typeof r?.id==='string'&&r.id.trim()) return r.id; if(r?.cert) return `${r.provider||r.grader||'CGC'}:${r.cert}`; throw new Error('Missing stable copy ID'); }
export function identityOf(r) {
 const fields=r.kind==='card'?['year','brand','series','subject','cardNumber','variety','language','qualifiers']:['title','issue','issueYear','publisher','variant'];
 const extra=['upc','barcode','supplement','coverCode','volume','printing','edition','language','labelCategory','labelType','signatures','restoration','qualifiers'];
 return Object.fromEntries([['kind',r.kind==='card'?'card':'comic'],...[...new Set([...fields,...extra])].map(k=>[k,r[k] == null?'':typeof r[k]==='object'?canonical(r[k]):String(r[k]).trim()])]);
}
export function identified(r) { return r.kind==='card'?!!(r.year&&r.brand&&r.subject&&r.cardNumber):!!(r.title&&r.issue!=null); }
export function validDate(value) { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value))return false; const n=Date.parse(value);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value.slice(0,10); }
export function safeSourceUrl(value) {
 try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)&&!/^\d+(?:\.\d+){3}$/.test(u.hostname)&&!u.hostname.endsWith('.local')&&!u.hostname.endsWith('.localhost');}catch{return false;}
}
const equalIdentity=(a,b)=>a&&JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function exactMatch(r,o) {
 const m=o.match, grader=isRaw(r)?null:r.grader||'CGC';
 if(!isRaw(r)&&(r.grade==null||String(r.grade).trim()===''||!Number.isFinite(Number(r.grade))))return false;
 const comparison=o.basis==='psa-comparison'&&r.kind==='card'&&grader==='TAG'&&m.grader==='PSA';
 if(o.basis==='psa-comparison'&&!comparison)return false;
 const gradeMatches=isRaw(r)?m.grade==null&&r.grade==null:m.grade!=null&&String(m.grade).trim()!==''&&Number(m.grade)===Number(r.grade);
 return m.status==='exact'&&identified(r)&&equalIdentity(m.identity,identityOf(r))&&gradeMatches&&(m.grader===grader||comparison)&&JSON.stringify(canonical(m.condition??null))===JSON.stringify(canonical(r.condition??null));
}
/** Throws for malformed evidence; a declared exact match is rechecked on acceptance. */
export function validateObservation(r,o,{now=new Date().toISOString()}={}) {
 if(!o||typeof o.id!=='string'||!o.id.trim())throw new Error('Observation ID required');
 if(o.copyId!==copyId(r))throw new Error('Observation copy ID mismatch');
 if(!bases.has(o.basis))throw new Error('Unsupported basis');
 if(o.basis==='guide'&&o.evidenceKind==='sold-comps'||o.basis==='sold-comps'&&o.evidenceKind==='guide')throw new Error('Evidence kind contradicts basis');
 if(typeof o.value!=='number'||!Number.isFinite(o.value)||o.value<0||o.currency!=='USD')throw new Error('Finite nonnegative USD value required');
 if(!o.source||typeof o.source.name!=='string'||!o.source.name.trim()||!safeSourceUrl(o.source.url))throw new Error('Safe HTTPS source URL and name required');
 if(!validDate(now)||(o.source.asOf!==null&&!validDate(o.source.asOf))||!validDate(o.source.retrievedAt)||Date.parse(o.source.asOf)>Date.parse(now)||Date.parse(o.source.retrievedAt)>Date.parse(now)||Date.parse(o.source.asOf)>Date.parse(o.source.retrievedAt))throw new Error('Invalid or future source date');
 if(!o.match||!o.match.identity||!Object.hasOwn(o.match,'grade')||!Object.hasOwn(o.match,'grader')||!Object.hasOwn(o.match,'condition')||!['exact','ambiguous','mismatch','unknown'].includes(o.match.status)||!['pending','accepted','rejected'].includes(o.reviewStatus))throw new Error('Explicit match and review status required');
 if(o.evidenceKind!==undefined&&!['sold-comps','guide'].includes(o.evidenceKind))throw new Error('Unsupported evidence kind');
 if(soldEvidence(o)&&(!Number.isInteger(o.saleCount)||o.saleCount<1))throw new Error('Sold evidence requires sale count');
 if(!soldEvidence(o)&&Object.hasOwn(o,'saleCount'))throw new Error('Guide has no observed sale count');
 if(o.provisional!==undefined&&typeof o.provisional!=='boolean')throw new Error('Provisional must be a boolean');
 if(o.provisional===true&&(typeof o.provisionalReason!=='string'||!o.provisionalReason.trim()||o.provisionalReason.length>1000))throw new Error('Provisional estimate reason required');
 return structuredClone(o);
}
export function addObservation(r,o,options={}) {
 const validated=validateObservation(r,o,options), existing=r.valuation?.observations||[];
 const previous=existing.find(x=>x.id===o.id);
 if(previous){ const strip=x=>({...x,reviewStatus:'pending'});if(JSON.stringify(strip(previous))!==JSON.stringify(strip(validated)))throw new Error('Conflicting duplicate observation ID');return structuredClone(r); }
 return {...structuredClone(r),valuation:{...(r.valuation||{}),observations:[...structuredClone(existing),{...validated,reviewStatus:'pending'}],selection:structuredClone(r.valuation?.selection??null)}};
}
export function acceptObservation(r,id,{now=new Date().toISOString(),locked=true,automatic=false}={}) {
 if(automatic&&r.valuation?.selection?.locked)throw new Error('Selection is owner locked');
 const o=r.valuation?.observations?.find(x=>x.id===id);validateObservation(r,o,{now});
 if(o.basis==='raw-reference'||isRaw(r)&&!assessedCondition(r))throw new Error('Raw reference is provisional; condition required');
 if(!exactMatch(r,o))throw new Error('Identity, grade, grader or condition mismatch');
 if(soldEvidence(o)&&o.saleCount<3&&o.provisional!==true)throw new Error('Insufficient sold evidence; explicitly mark provisional after review');
 if(automatic&&o.provisional===true)throw new Error('Provisional evidence requires explicit acceptance');
 return {...structuredClone(r),valuation:{...structuredClone(r.valuation),observations:r.valuation.observations.map(x=>({...structuredClone(x),reviewStatus:x.id===id?'accepted':x.reviewStatus})),selection:{observationId:id,locked:Boolean(locked),selectedAt:now}}};
}
/** Invalid/stale identities never become effective merely because JSON says accepted. */
export function selectedObservation(r) {
 const o=r?.valuation?.observations?.find(x=>x.id===r.valuation?.selection?.observationId);
 if(!o||o.reviewStatus!=='accepted'||o.basis==='raw-reference'||isRaw(r)&&!assessedCondition(r))return null;
 try{validateObservation(r,o);if(!exactMatch(r,o)||soldEvidence(o)&&o.saleCount<3&&o.provisional!==true)return null;return o;}catch{return null;}
}
