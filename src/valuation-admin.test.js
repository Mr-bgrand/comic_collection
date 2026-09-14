import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {serveLab} from './lab-server.js';
import {createValuationAdmin} from './valuation-admin.js';
import {loadValuations,applyValuationBatch} from './valuation/persistence.js';
import {identityOf} from './valuation/observations.js';
import {createPriceChartingClient} from './valuation/providers/pricecharting.js';

async function fixture(t) {
 const root=await mkdtemp(path.join(os.tmpdir(),'values-admin-test-'));
 t.after(async()=>{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('values-admin-test-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'data/cards'),{recursive:true});await writeFile(path.join(root,'data/config.json'),'{}');
 const records=[{cert:'A1',kind:'card',grader:'TAG',grade:10,year:2024,brand:'Pokemon',subject:'Mew',cardNumber:'1',images:{front:'owner.jpg'},location:'Desk'},{cert:'A2',kind:'card',grader:'TAG',grade:8.5,year:2024,brand:'Pokemon',subject:'Mew',cardNumber:'2'}];
 const file=path.join(root,'data/cards/case.json');await writeFile(file,JSON.stringify({id:'case',title:'Fixture case',cards:records}));
 const server=await serveLab({root,port:0,photoPort:0,refreshPhotos:false});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(route,body,headers={})=>{const r=await fetch(base+'/api/admin/values'+route,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json',...headers}});return {status:r.status,body:await r.json()};};
 return {root,file,records,base,request};
}

test('Values API captures pending evidence, explicitly accepts it, protects revisions and preserves scans',async t=>{
 const {request,file,records}=await fixture(t);
 const state=await request('');assert.equal(state.status,200);assert.equal(state.body.items.length,2);assert.equal(state.body.summary.valued,0);
 const row=state.body.items.find(r=>r.copyId==='TAG:A1');assert.deepEqual(row.flags,['missing']);assert.equal(row.record.images.front,'owner.jpg');
 const input={copyId:row.copyId,revision:row.revision,basis:'guide',value:88.57,sourceName:'PriceCharting',sourceUrl:'https://www.pricecharting.com/game/pokemon-example/mew-1',asOf:null,retrievedAt:'2026-09-01T12:00:00Z',matchStatus:'exact',notes:'Confirmed set, card number, TAG 10 and edition on visible guide.',reviewedBy:'Owner'};
 const captured=await request('/record',input);assert.equal(captured.status,200);assert.equal(captured.body.status,'imported');
 const updated=(await request('')).body;assert.equal(updated.summary.valued,0);const fresh=updated.items.find(r=>r.copyId===row.copyId),o=fresh.observations[0];assert.equal(o.reviewStatus,'pending');assert.equal(o.eligible,true);
 const accepted=await request('/accept',{copyId:row.copyId,revision:fresh.revision,observationId:o.id});assert.equal(accepted.status,200);
 const final=(await request('')).body;assert.equal(final.summary.total,88.57);assert.equal(final.items.find(r=>r.copyId===row.copyId).current.asOf,null);
 const stale=await request('/accept',{copyId:row.copyId,revision:fresh.revision,observationId:o.id});assert.equal(stale.status,409);
 const stored=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(stored.cards[0].images,records[0].images);assert.equal(stored.cards[0].location,'Desk');
 const denied=await request('/record',input,{Origin:'https://evil.test'});assert.equal(denied.status,403);
});

test('Values queue export, refresh prerequisites and capture templates never report a fabricated fetch',async t=>{
 const {request,file}=await fixture(t),before=await readFile(file,'utf8');
 const report=await request('/export?filter=missing');assert.equal(report.status,200);assert.equal(report.body.status,'queued');assert.equal(report.body.retrievedValues,0);
 const refresh=await request('/refresh',{filter:'missing'});assert.equal(refresh.status,200);assert.equal(refresh.body.retrievedValues,0);assert.equal(refresh.body.items.length,2);assert.ok(refresh.body.items.every(i=>i.status==='manual-capture-required'));
 const template=await request('/template?copyId=TAG%3AA1');assert.equal(template.status,200);assert.equal(template.body.copyId,'TAG:A1');assert.equal(template.body.value,null);assert.equal(template.body.asOf,null);assert.equal(template.body.matchStatus,'ambiguous');
 assert.equal(await readFile(file,'utf8'),before);
 const malformed=await request('/record',{...template.body,value:12,sourceName:'Guide',sourceUrl:'https://example.com',notes:'',reviewedBy:'Owner'});assert.equal(malformed.status,400);assert.equal(await readFile(file,'utf8'),before);
});

test('Values mutations refuse to run during a local build',async t=>{
 const {root,request,base}=await fixture(t);
 await writeFile(path.join(root,'package.json'),JSON.stringify({scripts:{build:'node pause.cjs'}}));await writeFile(path.join(root,'pause.cjs'),'setTimeout(()=>{},600);');
 const job=await fetch(base+'/api/admin/job',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'build'})});assert.equal(job.status,202);
 assert.equal((await request('/refresh',{filter:'missing'})).status,409);
 for(let i=0;i<30;i++){const state=await (await fetch(base+'/api/admin/job')).json();if(state.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,100));}
});

test('supported batch refresh reuses one exact product fetch and keeps both owner-locked selections',async t=>{
 const {root,file,records}=await fixture(t),now='2026-09-01T12:00:00Z';
 records[1]={...records[0],cert:'A2'};await writeFile(file,JSON.stringify({id:'case',cards:records}));
 const rows=await loadValuations(root),edits=rows.map(row=>{
  const r=row.record,mapping={productId:'1234',productName:'Mew 1',consoleName:'Pokemon',category:'card',identity:identityOf(r),verifiedBy:'Owner',verifiedAt:now,url:'https://www.pricecharting.com/game/pokemon/mew-1'};
  const o={id:'original-'+r.cert,copyId:row.copyId,basis:'guide',value:50,currency:'USD',source:{name:'PriceCharting',url:mapping.url,asOf:'2026-01-01',retrievedAt:now},match:{identity:identityOf(r),grade:10,grader:'TAG',condition:null,status:'exact'},reviewStatus:'pending',providerMapping:mapping};
  return {copyId:row.copyId,revision:row.revision,observations:[o],accept:{observationId:o.id,locked:true}};
 });await applyValuationBatch(root,edits);
 let requests=0;
 const service=createValuationAdmin(root,{env:{PRICECHARTING_API_TOKEN:'fixture-token'},clientFactory:options=>createPriceChartingClient({...options,sleep:async()=>{},fetch:async()=>{requests++;if(requests>1)throw Error('Duplicate product fetch');return {ok:true,status:200,json:async()=>({status:'success',id:'1234','product-name':'Mew 1','console-name':'Pokemon','condition-21-price':10000})};}})});
 const result=await service.write('refresh',{filter:'stale'});assert.equal(result.retrievedValues,2);assert.ok(result.items.every(r=>r.status==='captured'));
 const state=await service.state();assert.equal(state.summary.total,100);for(const row of state.items){assert.equal(row.current.value,50);assert.equal(row.current.locked,true);assert.equal(row.observations[1].value,100);assert.equal(row.observations[1].copyId,row.copyId);assert.equal(row.observations[1].reviewStatus,'pending');}
});
