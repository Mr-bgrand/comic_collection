import test from 'node:test';
import assert from 'node:assert/strict';
import {caseMembers,stepWithin,caseFormation,arrivalFrame,advanceArrival,arrivalSequence,ARRIVAL_REST,ARRIVAL_DURATION} from './engine-immersive.mjs';
import {refreshFlightCopies} from './engine-singularity.mjs';
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
  for(const override of [{active:false},{playing:false},{quiet:true},{blocked:true}])assert.deepEqual(advanceArrival(ARRIVAL_DURATION-.02,.05,{...flags,...override}),{elapsed:ARRIVAL_DURATION-.02,advance:false});
  assert.deepEqual(advanceArrival(ARRIVAL_DURATION-.02,.05,flags),{elapsed:0,advance:true});
  assert.deepEqual(advanceArrival(2,50,flags),{elapsed:2.1,advance:false});
});
test('each arrival reveals, gives the intact scan five full seconds, then departs',()=>{
  assert.equal(arrivalFrame(0).stage,'reveal');assert.equal(arrivalFrame(0).assemble,0);
  assert.equal(arrivalFrame(ARRIVAL_REST-.01).stage,'reveal');
  for(const t of [ARRIVAL_REST,ARRIVAL_REST+2.5,ARRIVAL_REST+4.99]){
    const f=arrivalFrame(t);assert.equal(f.stage,'hold');assert.equal(f.assemble,1);assert.equal(f.departure,0);assert.equal(f.fov,42);
  }
  assert.equal(arrivalFrame(ARRIVAL_REST+5.01).stage,'departure');
  assert.equal(arrivalFrame(50).phase,1);assert.equal(arrivalFrame(-20).phase,0);
});
test('flight maintains the same positive speed and field of view throughout and between arrivals',()=>{
  const initial=arrivalFrame(0);assert.ok(initial.speed>0);
  for(let t=0;t<=ARRIVAL_DURATION+.01;t+=.01){const frame=arrivalFrame(t);
    for(const value of Object.values(frame))if(typeof value==='number')assert.ok(Number.isFinite(value));
    assert.equal(frame.speed,initial.speed);assert.equal(frame.fov,initial.fov);
    assert.ok(['reveal','hold','departure'].includes(frame.stage));
  }
});
test('background copies keep their scans until their own slot wraps into the distant fade',()=>{
  const cells=new Float32Array(6),cycles=new Float64Array(3).fill(NaN);
  const seeds=new Float32Array([0,0,0,0, 0,0,.1,0, 0,0,.2,0]);
  const queue=[1,4,7,9,11],columns=4,rows=3;
  let cursor=refreshFlightCopies(cells,cycles,seeds,queue,0,0,columns,rows);
  assert.equal(cursor,3);assert.deepEqual([...cells],[1,2,0,1,3,1]);
  const before=[...cells];
  cursor=refreshFlightCopies(cells,cycles,seeds,queue,10,cursor,columns,rows);
  assert.equal(cursor,3);assert.deepEqual([...cells],before);
  // Slot zero reaches the camera after 120/.84 flow units. The others are still visible.
  cursor=refreshFlightCopies(cells,cycles,seeds,queue,143,cursor,columns,rows);
  assert.equal(cursor,4);assert.deepEqual([...cells],[1,0,...before.slice(2)]);
  cursor=refreshFlightCopies(cells,cycles,seeds,queue,166,cursor,columns,rows);
  assert.equal(cursor,5);assert.deepEqual([...cells],[1,0,3,0,...before.slice(4)]);
  assert.equal(refreshFlightCopies(cells,cycles,seeds,[],1000,cursor,columns,rows),cursor);
});
test('arrival queue visits each scanned copy once, mixes inventory order and respects scope',()=>{
  const items=Array.from({length:50},(_,i)=>({id:'cert'+i,hasScan:i!==3,kind:i%2?'comic':'card'}));
  const all=arrivalSequence(items);assert.equal(all.length,49);assert.equal(new Set(all).size,49);assert.ok(!all.includes(3));assert.deepEqual(all,arrivalSequence(items));
  assert.notDeepEqual(all,[...all].sort((a,b)=>a-b));assert.ok(arrivalSequence(items,'card').every(i=>items[i].kind==='card'));
});
test('owner scans stay distributed throughout the circular flight, including across its seam',()=>{
  const groups=[['raw',96,'comic','bag-and-board'],['Authority',333,'comic','soft-sleeve'],['CGC',239,'comic','slab'],['card',216,'card','slab']];
  const items=groups.flatMap(([prefix,count,kind,holder])=>Array.from({length:count},(_,i)=>({id:prefix+':'+i,kind,holder,hasScan:true})));
  for(const scope of ['all','comic']){
    const queue=arrivalSequence(items,scope),positions=queue.flatMap((id,i)=>items[id].id.startsWith('raw:')?[i]:[]);
    assert.equal(positions.length,96);assert.equal(new Set(queue).size,queue.length);
    const gaps=positions.map((pos,i)=>(positions[(i+1)%positions.length]-pos+queue.length)%queue.length);
    assert.ok(Math.max(...gaps)<=Math.ceil(queue.length/96)+3,JSON.stringify(gaps));
    assert.deepEqual(queue,arrivalSequence(items,scope));
  }
});
