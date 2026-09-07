import test from 'node:test';
import assert from 'node:assert/strict';
import {caseMembers,stepWithin,caseFormation,arrivalFrame,advanceArrival,arrivalSequence} from './engine-immersive.mjs';
const records=[{bin:'case1',kind:'card'},...Array.from({length:111},()=>({bin:'case12',kind:'comic'})),{bin:'case1',kind:'card'}];
test('case browsing retains source order and wraps without entering another container',()=>{
  const ids=caseMembers(records,1);assert.equal(ids.length,111);assert.equal(stepWithin(ids,111,1),1);assert.equal(stepWithin(ids,1,-1),111);
  assert.deepEqual(caseMembers(records,0),[0,112]);assert.deepEqual(caseMembers(records,0,'comic'),[]);assert.equal(stepWithin([],0,1),0);
});
for(const aspect of [.46,1.77])test(`immersed case isolates all 111 copies with finite, unique poses at ${aspect}`,()=>{
  const a=caseFormation(records,35,aspect);assert.deepEqual(a,caseFormation(records,35,aspect));assert.equal(a[0].scale,0);assert.equal(a[112].scale,0);
  for(const pose of a)for(const value of Object.values(pose))assert.ok(Number.isFinite(value));
  assert.equal(a.filter(p=>p.scale>0).length,111);assert.equal(new Set(a.slice(1,112).map(p=>[p.x,p.y,p.z].join(','))).size,111);
});
test('single-copy case remains valid and navigable',()=>{const one=[{bin:'one',kind:'comic'}];assert.equal(stepWithin(caseMembers(one,0),0,1),0);assert.ok(caseFormation(one,0,.46).every(p=>Object.values(p).every(Number.isFinite)));});
test('arrival pauses for motion preference, manual pause, other modes and open dialogs',()=>{
  const flags={active:true,playing:true,quiet:false,blocked:false};
  for(const override of [{active:false},{playing:false},{quiet:true},{blocked:true}])assert.deepEqual(advanceArrival(4.98,.05,{...flags,...override}),{elapsed:4.98,advance:false});
  assert.deepEqual(advanceArrival(4.98,.05,flags),{elapsed:0,advance:true});
  assert.deepEqual(advanceArrival(2,50,flags),{elapsed:2.1,advance:false});
});
test('arrival settles before the next capture and clamps its visual phases',()=>{
  assert.deepEqual(arrivalFrame(0),{phase:0,assemble:0,capture:0});assert.equal(arrivalFrame(2).assemble,1);assert.equal(arrivalFrame(2).capture,0);
  assert.equal(arrivalFrame(4).capture>0,true);assert.equal(arrivalFrame(50).phase,1);assert.equal(arrivalFrame(50).capture,1);
});
test('arrival queue visits each scanned copy once, mixes inventory order and respects scope',()=>{
  const items=Array.from({length:50},(_,i)=>({id:'cert'+i,hasScan:i!==3,kind:i%2?'comic':'card'}));
  const all=arrivalSequence(items);assert.equal(all.length,49);assert.equal(new Set(all).size,49);assert.ok(!all.includes(3));assert.deepEqual(all,arrivalSequence(items));
  assert.notDeepEqual(all,[...all].sort((a,b)=>a-b));assert.ok(arrivalSequence(items,'card').every(i=>items[i].kind==='card'));
});
