import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the production pointer listener without constructing a WebGL scene.
// Ray hits are supplied at the gesture boundary; rotation/pan state is real.
const source=await readFile(new URL('./engine.js',import.meta.url),'utf8');
const listener=source.slice(source.indexOf("canvas.addEventListener('pointermove'"),source.indexOf("canvas.addEventListener('pointerup'"));
function drag({onHero=false,mode='orbit',inspecting=true,exploded=false,mobile=false}={}) {
  let move;
  const state=vm.createContext({canvas:{addEventListener(type,handler){assert.equal(type,'pointermove');move=handler;}},
    pointers:new Map([[1,{x:100,y:100}]]),down:{x:100,y:100,lastX:100,lastY:100,onHero},moved:false,
    mode,inspecting,exploded,mobile,insideCase:false,height:800,
    heroRY:0,heroRX:0,fieldRY:0,fieldRX:0,panX:0,panY:0});
  vm.runInContext(listener,state);
  move({pointerId:1,clientX:220,clientY:140});
  return state;
}

for(const mobile of [false,true])test(`background drag rotates Orbit while inspecting (${mobile?'phone':'desktop'})`,()=>{
  const s=drag({mobile});
  assert.equal(s.fieldRY,.6);assert.equal(s.fieldRX,.2);
  assert.equal(s.heroRY,0);assert.equal(s.heroRX,0);
  assert.equal(s.moved,true);
});
test('drag beginning on the enlarged copy turns that copy, not its Orbit',()=>{
  const s=drag({onHero:true});
  assert.ok(Math.abs(s.heroRY-1.08)<1e-10);assert.equal(s.heroRX,.24);
  assert.equal(s.fieldRY,0);assert.equal(s.fieldRX,0);
});
test('overview dragging still rotates the collection',()=>{
  const s=drag({inspecting:false});
  assert.equal(s.fieldRY,.6);assert.equal(s.fieldRX,.2);assert.equal(s.heroRY,0);
});
test('study dragging pans scans instead of rotating the Orbit',()=>{
  const s=drag({exploded:true});
  assert.equal(s.panX,1.5);assert.equal(s.panY,-.5);assert.equal(s.fieldRY,0);assert.equal(s.heroRY,0);
});
test('Singularity retains its selected-copy drag behavior',()=>{
  const s=drag({mode:'singularity'});
  assert.ok(s.heroRY>1);assert.equal(s.fieldRY,0);
});
