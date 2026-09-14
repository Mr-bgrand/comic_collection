import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {importValuationDocument,acceptValuation,valuationReport,runValues,captureValuation} from './valuation-cli.js';
import {loadValuations} from './valuation/persistence.js';
import {identityOf,addObservation,acceptObservation} from './valuation/observations.js';
import {refreshTagValues} from './refresh-tag-values.js';
import {comparisonForTag} from './card-valuation.js';
const now='2026-09-13T12:00:00Z';
const card={id:'TAG:123',cert:'123',kind:'card',grader:'TAG',grade:'10',year:2023,brand:'Pokemon',subject:'Pikachu',cardNumber:'1'};
const obs={id:'external',copyId:card.id,basis:'psa-comparison',evidenceKind:'guide',value:123,currency:'USD',source:{name:'PriceCharting',url:'https://www.pricecharting.com/game/pokemon/pikachu',asOf:null,retrievedAt:now},match:{identity:identityOf(card),grade:'10',grader:'PSA',condition:null,status:'exact'},reviewStatus:'pending'};
async function fixture(fn,record=card){const root=await mkdtemp(path.join(os.tmpdir(),'values-cli-'));try{await mkdir(path.join(root,'data/cards'),{recursive:true});await writeFile(path.join(root,'data/config.json'),'{}');const file=path.join(root,'data/cards/case-01.json');await writeFile(file,JSON.stringify({id:'case-01',cards:[record]}));await fn(root,file);}finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('values-cli-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}}
const row=async root=>(await loadValuations(root))[0];
test('queue CLI writes report without editing inventory; import dry review, idempotence, explicit locked acceptance',()=>fixture(async(root,file)=>{
 const before=await readFile(file,'utf8');const report=await runValues(['queue'],{root});assert.equal(report.items?.length,1);assert.equal(await readFile(file,'utf8'),before);assert.equal(JSON.parse(await readFile(path.join(root,'data/valuation/queue.json'))).status,'queued');
 const revision=(await row(root)).revision;let doc={schemaVersion:1,edits:[{copyId:card.id,revision,observations:[obs]}]};
 const dry=await importValuationDocument(root,doc,{dryRun:true});assert.equal(dry.status,'reviewed');assert.equal(await readFile(file,'utf8'),before);
 await importValuationDocument(root,doc);assert.equal((await row(root)).record.valuation.selection,null);
 assert.equal((await importValuationDocument(root,doc)).changed,0);
 await acceptValuation(root,card.id,'external',{revision:(await row(root)).revision});assert.equal((await row(root)).record.valuation.selection.locked,true);
 await assert.rejects(importValuationDocument(root,{schemaVersion:1,edits:[{...doc.edits[0],accept:{observationId:'external'}}]}),/accept/i);
 await assert.rejects(acceptValuation(root,card.id,'external',{revision}),/revision|changed/i);
}));
test('saved provider capture defaults to review without mutating inventory and can explicitly import',()=>fixture(async(root,file)=>{
 const before=await readFile(file,'utf8'),revision=(await row(root)).revision;
 const input={copyId:card.id,revision,provider:'pricecharting',capture:{id:'api',product:{id:'1','product-name':'Pikachu','console-name':'Pokemon','condition-21-price':12300},mapping:{productId:'1',productName:'Pikachu',consoleName:'Pokemon',category:'card',identity:identityOf(card),verifiedBy:'Owner',verifiedAt:now,url:'https://www.pricecharting.com/game/pokemon/pikachu'},asOf:null,retrievedAt:now}};
 assert.equal((await captureValuation(root,input)).status,'captured');assert.equal(await readFile(file,'utf8'),before);
 await captureValuation(root,input,{persist:true});assert.equal((await row(root)).record.valuation.observations[0].value,123);
}));
test('refresh preserves prior valid PSA evidence when owned comparison is absent',async()=>{
 const psa={...card,grader:'PSA',cert:'999',fmv:{value:55,currency:'USD',source:'psa-cert-page',url:'https://www.psacard.com/cert/999',asOf:'2026-09-01'}};
 const record={...card,psaComparison:comparisonForTag(card,[psa])};
 await fixture(async(root,file)=>{await refreshTagValues(root);assert.equal(JSON.parse(await readFile(file)).cards[0].psaComparison?.value,55);},record);
});
test('refresh reports selected external comparison without requiring an owned PSA cert',()=>fixture(async(root)=>{
 const report=await refreshTagValues(root);assert.equal(report.matched.length,1);assert.equal(report.matched[0].value,123);assert.equal(report.matched[0].psaCert,null);
},acceptObservation(addObservation(card,obs),'external')));


test('stale changed batch cannot partially import, while accepted identical rerun preserves owner lock',()=>fixture(async(root,file)=>{
 const revision=(await row(root)).revision;const doc={schemaVersion:1,edits:[{copyId:card.id,revision,observations:[obs]}]};
 await importValuationDocument(root,doc);await acceptValuation(root,card.id,obs.id,{revision:(await row(root)).revision});
 const before=await readFile(file,'utf8');assert.equal((await importValuationDocument(root,doc)).changed,0);assert.equal(await readFile(file,'utf8'),before);
 await assert.rejects(importValuationDocument(root,{schemaVersion:1,edits:[{copyId:card.id,revision,observations:[{...obs,id:'new'}]}]}),/revision/i);assert.equal(await readFile(file,'utf8'),before);
}));

test('legacy prices command delegates JSON evidence imports to safe pending workflow',()=>fixture(async(root)=>{
 const {importPrices}=await import('./import-prices.js');const revision=(await row(root)).revision;
 const file=path.join(root,'capture.json');await writeFile(file,JSON.stringify({schemaVersion:1,edits:[{copyId:card.id,revision,observations:[obs]}]}));
 await importPrices(file,{root});assert.equal((await row(root)).record.valuation?.observations[0].value,123);assert.equal((await row(root)).record.valuation.selection,null);
}));
