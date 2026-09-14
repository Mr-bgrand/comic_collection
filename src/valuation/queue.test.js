import test from 'node:test';
import assert from 'node:assert/strict';
import * as queue from './queue.js';
const entry=(id,patch={})=>({record:{id,title:'Venom',issue:'1',grader:'CGC',grade:'9.8',...patch},container:{id:'01',title:'Bin 1'}});
test('queue separates undated and stale source dates and supports filters and override',()=>{
 const rows=[entry('CGC:old',{fmv:{value:100,asOf:'2026-01-01',fetchedAt:'2026-09-13'}}),entry('CGC:undated',{fmv:{value:10,fetchedAt:'2026-09-13'}}),entry('raw:001',{cert:null,title:null,issue:null,grader:null,grading:{status:'raw'},identification:{status:'proposed',candidates:[{title:'Candidate'}]}})];
 const q=queue.buildQueue(rows,{now:'2026-09-13'});assert.equal(q.length,3);
 assert.ok(q.find(r=>r.copyId==='CGC:old').flags.includes('stale'));assert.ok(q.find(r=>r.copyId==='CGC:undated').flags.includes('undated'));
 const raw=q.find(r=>r.copyId==='raw:001');assert.ok(raw.flags.includes('identity'));assert.ok(raw.flags.includes('condition'));assert.equal(raw.current,null);assert.ok(raw.priority>0);
 assert.equal(queue.buildQueue(rows,{now:'2026-09-13',filters:['stale']}).length,1);assert.equal(queue.buildQueue(rows,{now:'2026-09-13',staleDays:365,filters:['stale']}).length,0);
});
test('pilot fills distinct quotas deterministically and reports shortfall',()=>{
 const records=[...Array.from({length:12},(_,i)=>entry(`CGC:${i}`,{fmv:i%3===0?null:{status:i%3===1?'no-sales':'not-listed'},variant:i===11?'Metal Exclusive':''})),...Array.from({length:12},(_,i)=>entry(`TAG:${i}`,{kind:'card',grader:'TAG',year:2024,brand:'Test',subject:'Card',cardNumber:String(i),grade:i===11?'9.5':'10',variety:i===10?'Exclusive':''})),...Array.from({length:5},(_,i)=>entry(`Authority:${i}`,{provider:'Authority',grading:{status:'raw'}})),...Array.from({length:5},(_,i)=>entry(`raw:15-00${i+1}`,{title:null,issue:null,grading:{status:'raw'}}))];
 const result=queue.selectPilot(queue.buildQueue(records));assert.equal(result.items.length,30);assert.equal(new Set(result.items.map(r=>r.copyId)).size,30);assert.ok(result.items.some(r=>r.copyId==='TAG:11'));assert.ok(result.items.some(r=>r.copyId==='TAG:10'));assert.ok(result.items.some(r=>r.copyId==='CGC:11'));assert.deepEqual(queue.selectPilot(queue.buildQueue([...records].reverse())),result);
 const short=queue.selectPilot(queue.buildQueue(records.slice(0,2)));assert.equal(short.items.length,2);assert.equal(short.shortfalls.TAG,10);assert.equal(short.shortfalls.CGC,8);
});
test('CGC pilot chooses comics rather than card records sharing the grader',()=>{
 const rows=[entry('CGC:card',{kind:'card',year:2025,brand:'Card',subject:'Card',cardNumber:'1'}),entry('CGC:comic')];const p=queue.selectPilot(queue.buildQueue(rows));assert.deepEqual(p.items.filter(r=>r.pilotCategory==='CGC').map(r=>r.copyId),['CGC:comic']);
});
test('TAG pilot reserves dynamic half-grade and exclusive coverage before preferred IDs fill quota', () => {
 const ids=['L3302729','E3314397','M9505930','U5165558','G7325430','C5407435','H1870819','R4092198','H9812622','S2994291'];
 const tag=(id,patch={})=>entry(`TAG:${id}`,{kind:'card',grader:'TAG',year:2024,brand:'Test',subject:'Card',cardNumber:id,grade:'10',...patch});
 const records=[...ids.map(id=>tag(id)),tag('outside-half',{grade:'8.5'}),tag('outside-exclusive',{variety:'Retailer Exclusive'})];
 const rows=queue.buildQueue(records);
 const result=queue.selectPilot(rows);
 assert.equal(result.items.length,10);assert.equal(new Set(result.items.map(row=>row.copyId)).size,10);
 assert.ok(result.items.some(row=>row.copyId==='TAG:outside-half'));
 assert.ok(result.items.some(row=>row.copyId==='TAG:outside-exclusive'));
 assert.deepEqual(queue.selectPilot([...rows].reverse()),result);
});
test('legacy CGC comics use normalized grader for GoCollect query routing', () => {
 const legacy=entry('CGC:legacy');delete legacy.record.grader;
 const row=queue.buildQueue([legacy])[0];
 assert.equal(row.grader,'CGC');assert.equal(row.sourceQueries[0].source,'GoCollect');
 assert.match(row.sourceQueries[0].query,/CGC 9.8/);
});
test('TAG World Scaries editions qualify as exclusive coverage without classifying every holo as exclusive', () => {
 const rows=queue.buildQueue([
  entry('TAG:scaries',{kind:'card',grader:'TAG',brand:'TAG WORLD SCARIES',variety:'BLOOD RED HOLO'}),
  entry('TAG:scaries-series',{kind:'card',grader:'TAG',brand:'TAG',series:'TAG WORLD SCARIES',variety:'LUNAR GOLD HOLO'}),
  entry('TAG:pokemon',{kind:'card',grader:'TAG',brand:'Pokemon',variety:'HOLO'})
 ]);
 assert.equal(rows.find(row=>row.copyId==='TAG:scaries').special,true);
 assert.equal(rows.find(row=>row.copyId==='TAG:scaries-series').special,true);
 assert.equal(rows.find(row=>row.copyId==='TAG:pokemon').special,false);
});
