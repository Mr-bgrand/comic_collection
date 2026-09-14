import test from 'node:test';
import assert from 'node:assert/strict';
import {addObservation,acceptObservation,identityOf} from './observations.js';
import {resolveValuation} from './resolution.js';
import {effectiveValue,collectionStats} from '../model.js';
import {marketValueLabel} from '../card-valuation.js';
const now='2026-09-13T12:00:00Z';
const comic={id:'CGC:1',title:'Venom',issue:'1',grader:'CGC',grade:'9.8'};
const obs=(r,patch={})=>({id:'o1',copyId:r.id,basis:'owner',value:100,currency:'USD',source:{name:'Owner appraisal',url:'https://example.com/appraisal',asOf:null,retrievedAt:now},match:{identity:identityOf(r),grade:r.grade,grader:r.grader,condition:null,status:'exact'},reviewStatus:'pending',...patch});
test('selected owner estimate preserves legacy FMV provenance and is counted as manual',()=>{
 const r={...comic,fmv:{value:20,source:'A guide'},manual:{value:30}};const a=acceptObservation(addObservation(r,obs(r),{now}),'o1',{now});assert.equal(effectiveValue(a),100);assert.deepEqual(a.fmv,r.fmv);assert.equal(resolveValuation(a).basis,'owner');assert.equal(resolveValuation(a).asOf,null);const stats=collectionStats([{comics:[a]}]);assert.equal(stats.manualTotal,100);assert.equal(stats.totalValue,0);
});
test('selected market label names source and PSA grade comparison faithfully',()=>{
 const guide=acceptObservation(addObservation(comic,obs(comic,{basis:'guide',source:{...obs(comic).source,name:'PriceCharting'}}),{now}),'o1',{now});assert.equal(marketValueLabel(guide),'PriceCharting');
 const tag={id:'TAG:A',kind:'card',year:2025,brand:'Pokemon',subject:'Eevee',cardNumber:'1',grader:'TAG',grade:'9.5'};
 const psa=acceptObservation(addObservation(tag,obs(tag,{basis:'psa-comparison',match:{...obs(tag).match,grader:'PSA'}}),{now}),'o1',{now});assert.match(marketValueLabel(psa),/PSA 9.5 comparison/);assert.equal(resolveValuation(psa).value,100);
});
