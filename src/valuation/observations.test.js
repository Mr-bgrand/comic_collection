import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from './observations.js';
import { effectiveValue } from '../model.js';
const now='2026-09-13T12:00:00Z';
export const comic={id:'CGC:123',title:'Venom',issue:'1',issueYear:2024,variant:'Virgin',grader:'CGC',grade:'9.8',fmv:{value:20,source:'other'}};
export function evidence(record=comic, overrides={}) { return {id:'obs-1',copyId:record.id,basis:'guide',value:100,currency:'USD',source:{name:'GoCollect',url:'https://gocollect.com/comic/venom-1',asOf:'2026-09-01',retrievedAt:now},match:{identity:core.identityOf(record),grade:record.grade??null,grader:record.grading?.status==='raw'?null:record.grader,condition:record.condition??null,status:'exact'},reviewStatus:'pending',...overrides}; }
test('import keeps legacy value; explicit selection uses evidence and protects owner lock',()=>{
 assert.equal(typeof core.addObservation,'function'); const input=structuredClone(comic), o=evidence();
 const added=core.addObservation(input,o,{now}); assert.equal(input.valuation,undefined); assert.equal(effectiveValue(added),20);
 const accepted=core.acceptObservation(added,o.id,{now,locked:true});assert.equal(effectiveValue(accepted),100);
 const next=core.addObservation(accepted,evidence(comic,{id:'obs-2',value:200}),{now});
 assert.throws(()=>core.acceptObservation(next,'obs-2',{now,automatic:true}),/lock/i);
 assert.equal(effectiveValue(core.acceptObservation(next,'obs-2',{now})),200);
 assert.deepEqual(core.addObservation(added,o,{now}),added);
 assert.throws(()=>core.addObservation(added,{...o,value:2},{now}),/duplicate/i);
});
test('reject unsafe, undated, future, nonnumeric or wrong-copy evidence',()=>{
 for(const patch of [{value:'1'},{value:-1},{value:Infinity},{currency:'CAD'},{copyId:'CGC:other'},{basis:'unknown'}, {source:{...evidence().source,url:'javascript:alert(1)'}},{source:{...evidence().source,url:'https://localhost/x'}},{source:{...evidence().source,asOf:'2026-02-30'}},{source:{...evidence().source,asOf:'2027-01-01'}}]) assert.throws(()=>core.addObservation(comic,evidence(comic,patch),{now}));
});
test('wrong editions and grades can be reviewed but cannot be selected',()=>{
 for(const match of [{...evidence().match,identity:{...core.identityOf(comic),variant:'Other'}},{...evidence().match,grade:'9.6'},{...evidence().match,grader:'CBCS'}]){
 const r=core.addObservation(comic,evidence(comic,{match}),{now});assert.throws(()=>core.acceptObservation(r,'obs-1',{now}),/match/i);
 }
});
test('raw references stay provisional and unconditioned raw never enters totals',()=>{
 const raw={id:'raw:001',cert:null,title:'Venom',issue:'1',grading:{status:'raw'},fmv:{value:500}};
 const r=core.addObservation(raw,evidence(raw,{basis:'raw-reference'}),{now});assert.throws(()=>core.acceptObservation(r,'obs-1',{now}),/provisional|condition/i);assert.equal(effectiveValue(r),null);
});
test('undated source is retained separately from retrieval date',()=>{
 const o=evidence(comic,{source:{...evidence().source,asOf:null}});const r=core.addObservation(comic,o,{now});assert.equal(r.valuation.observations[0].source.asOf,null);assert.equal(core.acceptObservation(r,o.id,{now}).valuation.selection.observationId,o.id);
});
test('full edition identity and stable nested qualifiers prevent acceptance of mismatched special copies',()=>{
 const r={...comic,upc:'12345',supplement:'00111',coverCode:'A',volume:'2',printing:'First',language:'English',labelCategory:'Signature',signatures:[{name:'Artist',witnessed:true}],restoration:{colorTouch:false}};
 const o=evidence(r);for(const patch of [{supplement:'00121'},{printing:'Second'},{signatures:[{name:'Artist',witnessed:false}]},{restoration:{colorTouch:true}}]){
 const edited={...r,...patch};const pending=core.addObservation(edited,o,{now});assert.throws(()=>core.acceptObservation(pending,o.id,{now}),/match/i);
 }
 const card={id:'TAG:A',kind:'card',year:2025,brand:'Pokemon',subject:'Eevee',cardNumber:'1',grader:'TAG',grade:'9.5',qualifiers:{signed:false,altered:false}};
 const signed={...card,qualifiers:{signed:true,altered:false}};assert.notDeepEqual(core.identityOf(card),core.identityOf(signed));
 assert.deepEqual(core.identityOf(card),core.identityOf({...card,qualifiers:{altered:false,signed:false}}));
});
test('PSA comparison policy is only TAG at same numeric grade',()=>{
 const tag={id:'TAG:A',kind:'card',year:2025,brand:'Pokemon',subject:'Eevee',cardNumber:'1',grader:'TAG',grade:'9.5'};
 const o=evidence(tag,{basis:'psa-comparison',match:{...evidence(tag).match,grader:'PSA'}});
 assert.equal(effectiveValue(core.acceptObservation(core.addObservation(tag,o,{now}),o.id,{now})),100);
 const rounded={...o,match:{...o.match,grade:'10'}};assert.throws(()=>core.acceptObservation(core.addObservation(tag,rounded,{now}),o.id,{now}),/match/i);
 const cgc=evidence(comic,{basis:'psa-comparison'});assert.throws(()=>core.acceptObservation(core.addObservation(comic,cgc,{now}),cgc.id,{now}),/match/i);
});
test('empty raw condition object does not establish assessed condition',()=>{
 const raw={id:'raw:empty',title:'Venom',issue:'1',grading:{status:'raw'},condition:{},manual:{value:90}};const o=evidence(raw,{basis:'owner'});
 assert.equal(effectiveValue(raw),null);assert.throws(()=>core.acceptObservation(core.addObservation(raw,o,{now}),o.id,{now}),/condition/i);
});
test('PSA comparison sold evidence retains one sale for review and requires three for acceptance',()=>{
 const tag={id:'TAG:A',kind:'card',year:2025,brand:'Pokemon',subject:'Eevee',cardNumber:'1',grader:'TAG',grade:'9.5'};
 const o=evidence(tag,{basis:'psa-comparison',evidenceKind:'sold-comps',saleCount:1,match:{...evidence(tag).match,grader:'PSA'}});
 const pending=core.addObservation(tag,o,{now});assert.equal(pending.valuation.observations[0].saleCount,1);assert.throws(()=>core.acceptObservation(pending,o.id,{now}),/review|Insufficient/i);
 const guide={...o,evidenceKind:'guide'};assert.throws(()=>core.addObservation(tag,guide,{now}),/sale count/i);
 const three={...o,saleCount:3};assert.equal(effectiveValue(core.acceptObservation(core.addObservation(tag,three,{now}),o.id,{now})),100);
});
test('ungraded non-raw and unresolved empty identity cannot be accepted',()=>{
 const r={...comic,grade:null};const o=evidence(r);assert.throws(()=>core.acceptObservation(core.addObservation(r,o,{now}),o.id,{now}),/match/i);
});
test('same numeric grade is allowed without rounding while contradictory guide sales are rejected',()=>{
 const o=evidence(comic,{match:{...evidence().match,grade:'9.80'}});assert.equal(effectiveValue(core.acceptObservation(core.addObservation(comic,o,{now}),o.id,{now})),100);
 assert.throws(()=>core.addObservation(comic,evidence(comic,{basis:'guide',evidenceKind:'sold-comps',saleCount:3}),{now}),/basis|Guide/i);
});
