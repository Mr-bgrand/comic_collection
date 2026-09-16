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
 assert.match(valuationSourceText(record),/^Independent guide · Source undated/);assert.ok(!JSON.stringify(p).includes('privateCapture'));assert.ok(!JSON.stringify(p).includes('Do not publish'));
});

test('thin and undocumented history receive the same star and explanation in public and printed values',()=>{
 const c=selected(),bin={bin:'01',title:'Fixture',comics:[c]};
 const p=publicValuation(c,{now});assert.equal(p.valueText,'$123.45*');assert.match(p.valueCaution,/history/i);
 const htmls=[renderCollectionMaster({bins:[{data:bin}],cards:[],comics:[]}),renderSheet({bin,url:'https://example.com/bin/01/'}),renderBinPage({bin}),renderDashboard({bins:[bin],config:{baseUrl:'https://example.com',collectionName:'Fixture'}})];
 for(const html of htmls){assert.match(html,/\$123\.45\*/);assert.match(html,/\* Estimate/);}
 c.valuation.observations[0].stats={sold365:8};
 assert.equal(publicValuation(c,{now}).valueText,'$123.45');assert.equal(publicValuation(c,{now}).valueCaution,null);
 c.valuation.observations[0].stats.sold365=1;
 assert.match(publicValuation(c,{now}).valueCaution,/1 .*sale/);
});
test('masters, bin sheets and record pages show the same selected amount and undated source',()=>{
 const c=selected(),bin={bin:'01',title:'Fixture',comics:[c]};
 const htmls=[renderCollectionMaster({bins:[{data:bin}],cards:[],comics:[]}),renderSheet({bin,url:'https://example.com/bin/01/'}),renderBinPage({bin}),renderDashboard({bins:[bin],config:{baseUrl:'https://example.com',collectionName:'Fixture'}})];
 for(const html of htmls){assert.match(html,/123\.45/);assert.match(html,/Independent guide/);assert.match(html,/Source undated/);assert.doesNotMatch(html,/as of 2026-09-01/);}
});
test('dashboard header reports selected source-date coverage and keeps capture-only prices undated',()=>{
 const captured={cert:'124',title:'Venom',issue:'2',grade:'9.8',fmv:{value:20,fetchedAt:'2026-08-15'}};
 const accepted=selected();accepted.fmv={value:9,asOf:'2025-01-01',fetchedAt:'2025-01-04'};accepted.valuation.observations[0].source.asOf='2026-08-26';
 const header=records=>renderDashboard({bins:[{bin:'01',comics:records}],config:{baseUrl:'https://example.com',collectionName:'Fixture'}}).match(/<p class="asof">([\s\S]*?)<\/p>/)[1];
 const mixed=header([accepted,captured]);
 assert.match(mixed,/Source dates: 1 of 2 recorded values/);assert.match(mixed,/oldest source date 2026-08-26/);assert.match(mixed,/1 undated/);
 assert.doesNotMatch(mixed,/2025-01-01|2025-01-04|2026-08-15|values as of/);
 const onlyCapture=header([captured]);assert.match(onlyCapture,/Source dates: 0 of 1 recorded values/);assert.match(onlyCapture,/1 undated/);assert.doesNotMatch(onlyCapture,/2026-08-15|oldest source date|values as of/);
});
