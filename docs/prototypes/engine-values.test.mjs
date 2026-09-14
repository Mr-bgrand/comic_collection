import test from 'node:test';
import assert from 'node:assert/strict';
import {renderValueDetail,mountValuations} from './engine-values.mjs';
test('Values details show the owned scans, real evidence dates, blocked acceptance and escaped identity',()=>{
 const html=renderValueDetail({copyId:'raw:1',title:'Venom <script>',container:{title:'Office'},flags:['missing','condition'],current:null,record:{id:'raw:1',title:'Venom <script>',issue:'1',grading:{status:'raw'},images:{front:'owned front.jpg',back:'owned back.jpg'}},observations:[{id:'r1',basis:'raw-reference',value:20,currency:'USD',reviewStatus:'pending',eligible:false,reason:'Raw reference is provisional; condition required',source:{name:'Guide',url:'https://example.com/price',asOf:null,retrievedAt:'2026-09-01'},match:{grade:null,grader:null,condition:null,status:'exact'}}]});
 assert.match(html,/owned%20front\.jpg/);assert.match(html,/owned%20back\.jpg/);assert.match(html,/Venom &lt;script&gt;/);assert.match(html,/Source undated/);assert.match(html,/Captured 2026-09-01/);assert.match(html,/Condition not assessed/);assert.match(html,/data-accept="r1"[^>]*disabled/);assert.match(html,/20/);
});

// A minimal DOM boundary exercises the real upload handler and status/summary output.
function uiNode() {
 const classes=new Set();
 return {value:'',files:[],textContent:'',innerHTML:'',hidden:false,disabled:false,
  classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
  setAttribute(){},append(){},replaceChildren(){},querySelectorAll:()=>[]};
}
async function uploadCapture(t,result) {
 const nodes=new Map(),root={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,uiNode());return nodes.get(selector);},querySelectorAll:()=>[],setAttribute(){}};
 const originalDocument=globalThis.document;globalThis.document={createElement:uiNode};t.after(()=>{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;});
 const state={providers:{},summary:{total:50,valued:1,count:1,marketTotal:50,comparisonTotal:0,ownerTotal:0,provisionalTotal:0,provisionalCount:0},items:[{copyId:'CGC:1',title:'Venom #1',container:{title:'Fixture'},record:{cert:'1'},flags:[],observations:[]}]};
 const mounted=mountValuations(root,{api:async route=>{if(route==='values')return state;if(route==='values/capture')return result;throw Error('Unexpected route '+route);}});
 await mounted.setConnected(true);
 const priorSummary=root.querySelector('#values-summary').textContent;
 root.querySelector('#values-import-file').files=[{text:async()=>JSON.stringify({copyId:'CGC:1',revision:'fixture-revision',provider:'gocollect',capture:{text:'Saved visible page'}})}];
 await root.querySelector('#values-import-form').onsubmit({preventDefault(){}});
 assert.equal(root.querySelector('#values-summary').textContent,priorSummary,'capture import must not imply acceptance or replace the prior value');
 return root.querySelector('#values-status');
}

for(const [status,reason,label] of [
 ['login-required','Sign in to view prices.','Sign-in required'],
 ['review-required','Exact label matching still needs review.','Matching review required'],
 ['missing','No price for this exact grade.','No matching price found'],
 ['no-sales','No compatible sales available.','No sales available'],
])test(`capture upload reports ${status} without claiming an import`,async t=>{
 const output=await uploadCapture(t,{status,reason});
 assert.ok(output.textContent.includes(label));assert.ok(output.textContent.includes(reason));assert.match(output.textContent,/No evidence was imported/);assert.doesNotMatch(output.textContent,/Evidence imported for review/);assert.equal(output.classList.contains('error'),true);
});

test('capture upload claims imported evidence only after confirmed persistence',async t=>{
 const output=await uploadCapture(t,{status:'captured',observation:{id:'o1'},persistence:{status:'imported',changed:1,records:[{copyId:'CGC:1',revision:'new'}]}});
 assert.match(output.textContent,/Evidence imported for review/);assert.match(output.textContent,/No value was automatically accepted/);assert.equal(output.classList.contains('error'),false);
});

test('repeated capture upload reports already recorded when persistence changes nothing',async t=>{
 const output=await uploadCapture(t,{status:'captured',observation:{id:'o1'},persistence:{status:'imported',changed:0,records:[]}});
 assert.match(output.textContent,/already recorded/);assert.match(output.textContent,/No changes were saved/);assert.doesNotMatch(output.textContent,/Evidence imported for review/);assert.equal(output.classList.contains('error'),false);
});

test('an unpersisted capture is not described as imported evidence',async t=>{
 const output=await uploadCapture(t,{status:'captured',observation:{id:'o1'}});
 assert.match(output.textContent,/No evidence was imported/);assert.doesNotMatch(output.textContent,/Evidence imported for review/);assert.equal(output.classList.contains('error'),true);
});
