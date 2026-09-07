import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseArenaClub,importArenaClub} from './import-arena-club.js';
const fixture=JSON.parse(await fs.readFile(new URL('../data/incoming/arena-club-8AC002362928.json',import.meta.url)));

test('Arena Club keeps grade, subgrades, exact certificate and unknown valuation distinct',()=>{
 const card=parseArenaClub(fixture);
 assert.equal(card.id,'ArenaClub:8AC002362928');assert.equal(card.grader,'Arena Club');
 assert.equal(card.grade,'9.5');assert.equal(card.arenaClub.subgrades.surface,10);
 assert.equal(card.gradeDate,null);assert.equal(card.valuation,null);assert.equal(card.population,null);
});
test('Arena Club rejects wrong certs, unrelated photos and mixed scan pairs',()=>{
 assert.throws(()=>parseArenaClub({...fixture,cert:'8AC002362929'}),/mismatch/);
 for(const url of ['https://i.ebayimg.com/card.png',fixture.scans[0].url.replace('assets.arenaclub.com','assets.arenaclub.com.evil.test')]){
  const bad=structuredClone(fixture);bad.scans[0].url=url;assert.throws(()=>parseArenaClub(bad),/scan pair/);
 }
 const mixed=structuredClone(fixture);mixed.scans[1].url=mixed.scans[1].url.replace('2943b7d8','1943b7d8');assert.throws(()=>parseArenaClub(mixed),/different cards/);
});
test('Arena Club refresh preserves other graders and owner fields and rejects duplicate locations',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'arena-import-'));
 try{
  const file=path.join(directory,'capture.txt');await fs.writeFile(file,JSON.stringify(fixture));
  const existing={...parseArenaClub(fixture),notes:'Gift',valuation:{value:40},images:{front:'owner.jpg'}};
  const other={id:'CGC:123',grader:'CGC',cert:'123'};
  await fs.writeFile(path.join(directory,'case-01.json'),JSON.stringify({...fixture.container,cards:[other,existing]}));
  const result=await importArenaClub(file,{directory});assert.equal(result.added,0);
  const box=JSON.parse(await fs.readFile(result.destination));assert.deepEqual(box.cards[0],other);
  assert.equal(box.cards[1].notes,'Gift');assert.equal(box.cards[1].images.front,'owner.jpg');assert.equal(box.cards[1].valuation.value,40);
  await fs.writeFile(path.join(directory,'other.json'),JSON.stringify({id:'other',cards:[existing]}));
  await assert.rejects(importArenaClub(file,{directory}),/another container/);
 }finally{const relative=path.relative(os.tmpdir(),directory);assert.ok(relative.startsWith('arena-import-')&&!relative.includes(path.sep));await fs.rm(directory,{recursive:true,force:true});}
});
