import test from 'node:test';
import assert from 'node:assert/strict';
import {formation,cameraDistance} from './engine-layouts.mjs';
const records=[...Array.from({length:244},(_,i)=>({id:'CGC:'+i,kind:'comic',bin:i<239?String(Math.floor(i/25)):'wall'})),...Array.from({length:49},(_,i)=>({id:'PSA:'+i,kind:'card',bin:'psa-vault',virtual:true}))];
for(const aspect of [.46,1.77]) for(const mode of ['orbit','wall','longbox','spotlight']) {
  test(`${mode} at aspect ${aspect} keeps every object finite and separated`,()=>{
    const layout=formation(mode,records,aspect);assert.equal(layout.length,293);
    assert.equal(new Set(layout.map(p=>[p.x,p.y,p.z].join(','))).size,293);
    for(const p of layout) for(const v of Object.values(p)) assert.ok(Number.isFinite(v));
    assert.ok(cameraDistance(mode,aspect,records.length)>0);
    assert.deepEqual(layout,formation(mode,records,aspect));
  });
}
test('longbox positions group each physical container on one x/y row',()=>{
  const positions=formation('longbox',records,1.77),grouped=new Map();
  records.forEach((c,i)=>{const key=positions[i].x+','+positions[i].y;if(grouped.has(c.bin))assert.equal(key,grouped.get(c.bin));else grouped.set(c.bin,key);});
  assert.equal(new Set(grouped.values()).size,grouped.size);
});
test('spotlight keeps its wall order and positions when any copy is selected',()=>{
  const original=formation('spotlight',records,1.77,0);
  for(const selected of [0,23,244,292])assert.deepEqual(formation('spotlight',records,1.77,selected),original);
  assert.ok(original[0].y>original.at(-1).y);
});
