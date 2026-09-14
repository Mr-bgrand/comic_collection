import test from 'node:test';
import assert from 'node:assert/strict';
import * as estimator from './sold-comps.js';
const target={identity:{title:'Venom',issue:'1',variant:'Virgin'},grade:'9.8',grader:'CGC',condition:null};
const sales=values=>values.map((value,i)=>({transactionId:`sale-${i}`,sold:true,askingOnly:false,bestOffer:false,value,currency:'USD',...target}));
test('sold estimator uses even median and observed quartile ranks',()=>{
 assert.equal(typeof estimator.estimateSoldComps,'function');
 assert.deepEqual(estimator.estimateSoldComps(target,sales([])),{value:null,range:null,saleCount:0,status:'missing',transactions:[]});
 for(const n of [1,2]){const e=estimator.estimateSoldComps(target,sales([10,20].slice(0,n)));assert.equal(e.value,null);assert.equal(e.status,'review');assert.equal(e.saleCount,n);}
 const four=estimator.estimateSoldComps(target,sales([10,20,40,100]));assert.equal(four.value,30);assert.deepEqual(four.range,{low:10,high:100,method:'min-max'});
 const six=estimator.estimateSoldComps(target,sales([10,20,30,40,50,100]));assert.equal(six.value,35);assert.deepEqual(six.range,{low:20,high:50,method:'observed-iqr'});
 const five=estimator.estimateSoldComps(target,sales([10,20,30,40,100]));assert.equal(five.value,30);assert.deepEqual(five.range,{low:20,high:40,method:'observed-iqr'});
});
test('excludes wrong edition, duplicate transaction, unsold, offer unknown, currency and grader mismatch',()=>{
 const valid=sales([10,20,30]);
 const excluded=[{...valid[0]},...[{identity:{...target.identity,variant:'Trade'}},{sold:false},{askingOnly:true},{bestOffer:true},{currency:'CAD'},{grader:'CBCS'},{grade:'9.6'},{condition:'restored'},{value:'100'}].map((patch,i)=>({...valid[0],transactionId:`bad-${i}`,value:10000,...patch}))];
 const result=estimator.estimateSoldComps(target,[...valid,...excluded]);assert.equal(result.value,20);assert.equal(result.saleCount,3);
});
test('nested qualifiers match structurally and empty identities cannot establish compatibility',()=>{
 const qualified={...target,identity:{...target.identity,qualifiers:{restored:false,signed:true}}};
 const entries=sales([10,20,30]).map(e=>({...e,identity:structuredClone(qualified.identity)}));assert.equal(estimator.estimateSoldComps(qualified,entries).value,20);
 assert.equal(estimator.estimateSoldComps({...target,identity:{}},sales([10,20,30]).map(e=>({...e,identity:{}}))).value,null);
});
