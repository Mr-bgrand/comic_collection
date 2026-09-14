/** Local-only orchestration. Provider acquisition remains pending until owner acceptance. */
import {randomUUID} from 'node:crypto';
import {loadValuations,applyValuationBatch} from './valuation/persistence.js';
import {identityOf,isRaw,acceptObservation} from './valuation/observations.js';
import {buildQueue} from './valuation/queue.js';
import {valueSnapshot} from './value-history.js';
import {providerStatus,importValuationDocument,acceptValuation,captureValuation} from './valuation-cli.js';
import {createPriceChartingClient} from './valuation/providers/pricecharting.js';

export function createValuationAdmin(root,{env=process.env,clientFactory=createPriceChartingClient}={}) {
 const clients=new Map();
 const client=provider=>{if(!clients.has(provider))clients.set(provider,clientFactory({provider,env}));return clients.get(provider);};
 const rowFor=async(copyId,revision)=>{
  const row=(await loadValuations(root)).find(r=>r.copyId===copyId);
  if(!row)throw Error('Unknown copy ID');
  if(revision!==undefined&&revision!==row.revision)throw Error('Revision conflict: collection changed; reload before saving');
  return row;
 };
 const template=row=>({copyId:row.copyId,revision:row.revision,basis:isRaw(row.record)?'raw-reference':'guide',value:null,sourceName:'',sourceUrl:'',asOf:null,retrievedAt:new Date().toISOString(),matchStatus:'ambiguous',notes:'',reviewedBy:''});
 async function state() {
  const rows=await loadValuations(root),byId=new Map(rows.map(r=>[r.copyId,r]));
  return {providers:providerStatus(env),summary:valueSnapshot(rows.map(r=>r.record)),items:buildQueue(rows).map(item=>{
   const {record}=byId.get(item.copyId);
   const observations=(record.valuation?.observations||[]).map(o=>{
    let eligible=true,reason='';try{acceptObservation(record,o.id);}catch(error){eligible=false;reason=error.message;}
    if(o.reviewStatus==='rejected'){eligible=false;reason='Dismissed evidence is retained for audit';}
    return {...o,eligible,reason,selected:record.valuation?.selection?.observationId===o.id};
   });
   return {...item,record,observations};
  })};
 }
 async function refresh(body) {
  if(!['missing','stale','undated'].includes(body.filter))throw Error('Choose missing, stale or undated values');
  const rows=await loadValuations(root),queue=buildQueue(rows,{filters:[body.filter]}),byId=new Map(rows.map(r=>[r.copyId,r]));
  const candidates=body.copyId?queue.filter(r=>r.copyId===body.copyId):queue,items=[],edits=[],acquired=new Map();
  for(const item of candidates) {
   const row=byId.get(item.copyId),observation=(row.record.valuation?.observations||[]).filter(o=>o.providerMapping&&o.reviewStatus!=='rejected').sort((a,b)=>b.source.retrievedAt.localeCompare(a.source.retrievedAt))[0];
   const provider=observation?.providerMapping?.url?.includes('www.sportscardspro.com/')?'sportscardspro':'pricecharting';
   if(!observation){items.push({copyId:row.copyId,status:'manual-capture-required',reason:'No owner-verified API catalog mapping. Open source lookup and capture reviewed evidence.'});continue;}
   if(!providerStatus(env)[provider].configured){items.push({copyId:row.copyId,status:'access-required',reason:`${provider} API token and data entitlement required. Browser sign-in does not configure the API.`});continue;}
   try {
    const mapping=observation.providerMapping;
    const key=JSON.stringify([provider,mapping.productId,mapping.productName,mapping.consoleName,mapping.category,mapping.identity,identityOf(row.record),row.record.grade,observation.match.grader,row.record.condition??null]);
    let result=acquired.get(key);
    if(!result){result=await captureValuation(root,{copyId:row.copyId,revision:row.revision,provider:provider+'-api',capture:{id:'api-'+randomUUID(),mapping,grader:observation.match.grader,asOf:null,retrievedAt:new Date().toISOString()}},{client:client(provider)});acquired.set(key,result);}
    if(result.observation)edits.push({copyId:row.copyId,revision:row.revision,observations:[{...structuredClone(result.observation),id:'api-'+randomUUID(),copyId:row.copyId}]});
    items.push({copyId:row.copyId,status:result.status,reason:result.reason||'New guide observation awaits review'});
   }catch(error){items.push({copyId:row.copyId,status:'unavailable',reason:error.message});}
  }
  if(edits.length)await importValuationDocument(root,{schemaVersion:1,edits});
  return {status:edits.length?'captured-for-review':'no-values-retrieved',retrievedValues:edits.length,items};
 }
 async function write(action,body) {
  if(action==='import')return importValuationDocument(root,body);
  if(action==='capture')return captureValuation(root,body,{persist:true});
  if(action==='refresh')return refresh(body);
  const row=await rowFor(body.copyId,body.revision);
  if(!body.revision)throw Error('Current revision required');
  if(action==='accept')return acceptValuation(root,body.copyId,body.observationId,{revision:body.revision});
  if(action==='review'||action==='reject')return applyValuationBatch(root,[{copyId:body.copyId,revision:body.revision,[action]:body[action]}]);
  if(action==='record') {
   const fields=['copyId','revision','basis','value','sourceName','sourceUrl','asOf','retrievedAt','matchStatus','notes','reviewedBy'];
   if(Object.keys(body).some(k=>!fields.includes(k))||!['guide','psa-comparison','owner','raw-reference'].includes(body.basis)||!['exact','ambiguous'].includes(body.matchStatus))throw Error('Unsupported capture field or basis; use a reviewed evidence import for sold transactions');
   if(typeof body.notes!=='string'||!body.notes.trim()||body.notes.length>4000||typeof body.reviewedBy!=='string'||!body.reviewedBy.trim()||body.reviewedBy.length>100)throw Error('Record who reviewed the source and how it matches this copy');
   const o={id:'review-'+randomUUID(),copyId:row.copyId,basis:body.basis,value:body.value,currency:'USD',source:{name:body.sourceName,url:body.sourceUrl,asOf:body.asOf,retrievedAt:body.retrievedAt},match:{identity:identityOf(row.record),grade:row.record.grade??null,grader:isRaw(row.record)?null:body.basis==='psa-comparison'?'PSA':row.record.grader||'CGC',condition:row.record.condition??null,status:body.matchStatus},reviewStatus:'pending',reviewEvidence:{notes:body.notes.trim(),reviewedBy:body.reviewedBy.trim(),reviewedAt:new Date().toISOString()}};
   return importValuationDocument(root,{schemaVersion:1,edits:[{copyId:row.copyId,revision:row.revision,observations:[o]}]});
  }
  throw Error('Unknown Values action');
 }
 return {
  state,write,
  async read(action,params) {
   if(!action)return state();
   if(action==='export')return {status:'queued',retrievedValues:0,providers:providerStatus(env),items:buildQueue(await loadValuations(root),{filters:params.get('filter')?[params.get('filter')]:[]})};
   if(action==='template')return template(await rowFor(params.get('copyId')));
   if(action==='search')return client(params.get('provider')).search(params.get('q')||'');
   throw Object.assign(Error('Unknown Values route'),{status:404});
  }
 };
}
