import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as persistence from './persistence.js';
import {identityOf} from './observations.js';
import {resolveValuation} from './resolution.js';
import {effectiveValue} from '../model.js';
const now='2026-09-13T12:00:00Z';
function observation(r){return {id:'guide-1',copyId:r.id,basis:'owner',value:50,currency:'USD',source:{name:'Owner reference',url:'https://example.com/source',asOf:'2026-09-01',retrievedAt:now},match:{identity:identityOf(r),grade:null,grader:null,condition:'VF',status:'exact'},reviewStatus:'pending'};}
async function fixture(fn){const root=await mkdtemp(path.join(os.tmpdir(),'valuation-core-test-'));try{await mkdir(path.join(root,'data/comics'),{recursive:true});await writeFile(path.join(root,'data/config.json'),'{}');const records=[1,2].map(n=>({id:`raw:00${n}`,cert:null,title:'Venom',issue:'1',grade:null,grading:{status:'raw'},condition:'VF',images:{front:`owner-${n}.jpg`}}));const filename=path.join(root,'data/comics/raw.json');await writeFile(filename,JSON.stringify({id:'raw',comics:records}));await fn(root,filename,records);}finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('valuation-core-test-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}}
test('atomic persistence isolates null certs, saves locks, backs up originals and imports idempotently',()=>fixture(async(root,file,records)=>{
 const original=await readFile(file,'utf8');const loaded=await persistence.loadValuations(root);assert.equal(loaded.length,2);
 await persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:loaded[0].revision,observations:[observation(records[0])],accept:{observationId:'guide-1',locked:true}}],{now});
 const data=JSON.parse(await readFile(file,'utf8'));assert.equal(data.comics[0].valuation.selection.locked,true);assert.deepEqual(data.comics[1],records[1]);assert.deepEqual(data.comics[0].images,records[0].images);
 const backups=await readdir(path.join(root,'data/backups/valuation'));assert.equal(backups.length,1);assert.equal(await readFile(path.join(root,'data/backups/valuation',backups[0]),'utf8'),original);
 const refreshed=await persistence.loadValuations(root);const before=await readFile(file,'utf8');await persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:refreshed[0].revision,observations:[observation(records[0]),observation(records[0])]}],{now});assert.equal(await readFile(file,'utf8'),before);
 await assert.rejects(persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:loaded[0].revision,observations:[]}],{now}),/revision|changed/i);
}));
test('whole batch validation preserves every byte on invalid import or unknown copy/path',()=>fixture(async(root,file,records)=>{
 const loaded=await persistence.loadValuations(root),before=await readFile(file,'utf8');
 await assert.rejects(persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:loaded[0].revision,observations:[observation(records[0])]},{copyId:'raw:002',revision:loaded[1].revision,observations:[{...observation(records[1]),value:'50'}]}],{now}));assert.equal(await readFile(file,'utf8'),before);
 await assert.rejects(persistence.applyValuationBatch(root,[{copyId:'../config',filename:file,revision:loaded[0].revision,observations:[]}],{now}));assert.equal(await readFile(file,'utf8'),before);
}));

test('reviewed identity and condition updates preserve scans, copy IDs and evidence but invalidate old values',()=>fixture(async(root,file,records)=>{
 const loaded=await persistence.loadValuations(root);
 await persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:loaded[0].revision,observations:[observation(records[0])],accept:{observationId:'guide-1'}}],{now});
 const before=(await persistence.loadValuations(root))[0];
 await persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:before.revision,review:{identity:{title:'Spider-Man: Reign 2',issue:'1',issueYear:2024,publisher:'Marvel',variant:'Skottie Young Variant Cover',upc:'75960620394900121'},condition:'FN',evidence:{url:'https://example.com/catalog',notes:'Matched full UPC to catalog; inspected front, back and spine for condition.',reviewedBy:'Owner',reviewedAt:now}}}],{now});
 const [updated,other]=await persistence.loadValuations(root);
 assert.equal(updated.record.title,'Spider-Man: Reign 2');assert.equal(updated.record.condition,'FN');assert.equal(updated.record.id,'raw:001');assert.equal(updated.record.cert,null);
 assert.equal(updated.record.identification?.status,'confirmed');
 assert.deepEqual(updated.record.images,records[0].images);assert.deepEqual(other.record,records[1]);
 assert.equal(updated.record.valuation.observations[0].reviewStatus,'accepted');assert.equal(updated.record.valuation.metadataReviews[0].before.identity.title,'Venom');
 assert.equal(resolveValuation(updated.record),null);assert.equal(effectiveValue({...updated.record,fmv:{value:999},manual:{value:888}}),null);
 await assert.rejects(persistence.applyValuationBatch(root,[{copyId:'raw:001',revision:before.revision,review:{}}],{now}),/revision|changed/i);
}));

test('metadata review cannot change scans, grade, location, raw status or accept missing evidence',()=>fixture(async(root,file)=>{
 const row=(await persistence.loadValuations(root))[0],original=await readFile(file,'utf8');
 const evidence={url:'https://example.com/catalog',notes:'Full UPC verified.',reviewedBy:'Owner',reviewedAt:now};
 for(const review of [{identity:{images:{front:'wrong.jpg'}},evidence},{identity:{location:'elsewhere'},evidence},{identity:{grade:9.8},evidence},{identity:{grading:{status:'graded'}},evidence},{identity:{title:'Changed'}},{condition:'unknown',evidence},{condition:'VF',evidence:{...evidence,notes:''}},{identity:{title:'Changed'},evidence:{...evidence,url:'file:///private'}}]) {
  await assert.rejects(persistence.applyValuationBatch(root,[{copyId:row.copyId,revision:row.revision,review}],{now}));
  assert.equal(await readFile(file,'utf8'),original);
 }
}));

test('rejecting pending alternatives preserves selected and superseded accepted evidence',()=>fixture(async(root,file,records)=>{
 const row=(await persistence.loadValuations(root))[0],first=observation(records[0]),second={...first,id:'alternative',value:70};
 await persistence.applyValuationBatch(root,[{copyId:row.copyId,revision:row.revision,observations:[first,second],accept:{observationId:first.id}}],{now});
 const fresh=(await persistence.loadValuations(root))[0];
 await persistence.applyValuationBatch(root,[{copyId:row.copyId,revision:fresh.revision,reject:{observationId:second.id,reason:'Wrong source interpretation'}}],{now});
 const saved=(await persistence.loadValuations(root))[0];assert.equal(saved.record.valuation.observations[1].reviewStatus,'rejected');assert.equal(resolveValuation(saved.record).value,50);
 assert.equal(saved.record.valuation.reviews[0].reason,'Wrong source interpretation');
 await assert.rejects(persistence.applyValuationBatch(root,[{copyId:row.copyId,revision:saved.revision,reject:{observationId:first.id,reason:'Dismiss'}}],{now}),/accepted/i);
}));
