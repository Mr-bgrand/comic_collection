import test from 'node:test';
import assert from 'node:assert/strict';
import {publicValuation,valuationSourceText} from './presentation.js';
import {identityOf,addObservation,acceptObservation} from './observations.js';
import {renderCollectionMaster} from '../templates/labPrint.js';
import {renderSheet} from '../templates/sheet.js';
import {renderBinPage} from '../templates/binPage.js';
import {renderDashboard} from '../templates/dashboard.js';
const now='2026-09-01T12:00:00Z';
function selected(){const r={cert:'123',title:'Venom',issue:'1',grade:'9.8',images:{front:'owner.jpg'}};return acceptObservation(addObservation(r,{id:'source-1',copyId:'CGC:123',basis:'guide',value:123.45,currency:'USD',source:{name:'Independent guide',url:'https://example.com/verified-edition',asOf:null,retrievedAt:now},match:{identity:identityOf(r),grade:'9.8',grader:'CGC',condition:null,status:'exact'},reviewStatus:'pending',privateCapture:'Do not publish saved page text'}, {now}),'source-1',{now});}
test('public valuation fields preserve selected provenance and never expose captures or retrieval date as source date',()=>{
 const record=selected(),p=publicValuation(record,{now});assert.equal(p.value,123.45);assert.equal(p.source,'Independent guide');assert.equal(p.date,null);assert.equal(p.basis,'guide');assert.deepEqual(p.valuationFlags,['undated']);assert.equal(p.evidence,'https://example.com/verified-edition');
 assert.equal(valuationSourceText(record),'Independent guide · Source undated');assert.ok(!JSON.stringify(p).includes('privateCapture'));assert.ok(!JSON.stringify(p).includes('Do not publish'));
});
test('masters, bin sheets and record pages show the same selected amount and undated source',()=>{
 const c=selected(),bin={bin:'01',title:'Fixture',comics:[c]};
 const htmls=[renderCollectionMaster({bins:[{data:bin}],cards:[],comics:[]}),renderSheet({bin,url:'https://example.com/bin/01/'}),renderBinPage({bin}),renderDashboard({bins:[bin],config:{baseUrl:'https://example.com',collectionName:'Fixture'}})];
 for(const html of htmls){assert.match(html,/123\.45/);assert.match(html,/Independent guide/);assert.match(html,/Source undated/);assert.doesNotMatch(html,/as of 2026-09-01/);}
});
