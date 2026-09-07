import test from 'node:test';
import assert from 'node:assert/strict';
import {formation} from './engine-layouts.mjs';
import {wallMetrics,moveWall,zoomWall,constrainWall} from './engine-navigation.mjs';
const records=Array.from({length:319},(_,i)=>({bin:String(i%12)}));
for(const aspect of [.46,1.77])test(`Spotlight can reach both ends of all 319 copies at aspect ${aspect}`,()=>{
  const poses=formation('spotlight',records,aspect),m=wallMetrics(poses,aspect,1,844);
  const first=moveWall({x:0,y:0,zoom:1},0,-100000,m),last=moveWall(first,0,100000,m);
  assert.ok(Math.abs(poses[0].y-first.y)<m.halfH-1.1);
  assert.ok(Math.abs(poses.at(-1).y-last.y)<m.halfH-1.1);
  const left=moveWall(first,-100000,0,m),right=moveWall(first,100000,0,m);
  assert.ok(Math.abs(Math.min(...poses.map(p=>p.x))-left.x)<m.halfW);
  assert.ok(Math.abs(Math.max(...poses.map(p=>p.x))-right.x)<m.halfW);
  assert.deepEqual(constrainWall(last,m),last);
});
test('zoom preserves the point under the fingers and stays within useful distances',()=>{
  const poses=formation('spotlight',records,.46),view={x:0,y:0,zoom:1},anchor={x:.3,y:-.2};
  const before=wallMetrics(poses,.46,1,844),afterView=zoomWall(view,.7,poses,.46,844,anchor),after=wallMetrics(poses,.46,afterView.zoom,844);
  assert.ok(Math.abs(view.x+anchor.x*before.halfW-afterView.x-anchor.x*after.halfW)<1e-8);
  assert.ok(Math.abs(view.y+anchor.y*before.halfH-afterView.y-anchor.y*after.halfH)<1e-8);
  assert.equal(zoomWall(view,1000,poses,.46,844).zoom,2.6);
  assert.equal(zoomWall(view,.001,poses,.46,844).zoom,.35);
});
test('empty and single-copy walls remain finite and return to a reachable viewport',()=>{
  for(const poses of [[],formation('spotlight',[{bin:'1'}],.46)]){
    const metrics=wallMetrics(poses,.46,1,844),view=moveWall({x:0,y:0,zoom:1},99999,99999,metrics);
    assert.ok(Object.values(view).every(Number.isFinite));
    assert.ok(Math.abs(view.x)<1&&Math.abs(view.y)<1);
  }
});
