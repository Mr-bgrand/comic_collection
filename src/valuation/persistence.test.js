import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as persistence from './persistence.js';
import {identityOf} from './observations.js';
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
