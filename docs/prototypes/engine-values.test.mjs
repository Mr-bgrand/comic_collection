import test from 'node:test';
import assert from 'node:assert/strict';
import {renderValueDetail} from './engine-values.mjs';
test('Values details show the owned scans, real evidence dates, blocked acceptance and escaped identity',()=>{
 const html=renderValueDetail({copyId:'raw:1',title:'Venom <script>',container:{title:'Office'},flags:['missing','condition'],current:null,record:{id:'raw:1',title:'Venom <script>',issue:'1',grading:{status:'raw'},images:{front:'owned front.jpg',back:'owned back.jpg'}},observations:[{id:'r1',basis:'raw-reference',value:20,currency:'USD',reviewStatus:'pending',eligible:false,reason:'Raw reference is provisional; condition required',source:{name:'Guide',url:'https://example.com/price',asOf:null,retrievedAt:'2026-09-01'},match:{grade:null,grader:null,condition:null,status:'exact'}}]});
 assert.match(html,/owned%20front\.jpg/);assert.match(html,/owned%20back\.jpg/);assert.match(html,/Venom &lt;script&gt;/);assert.match(html,/Source undated/);assert.match(html,/Captured 2026-09-01/);assert.match(html,/Condition not assessed/);assert.match(html,/data-accept="r1"[^>]*disabled/);assert.match(html,/20/);
});
