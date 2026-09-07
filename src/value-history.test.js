import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {valueSnapshot,appendSnapshot,captureValueHistory,readValueHistory,seedGitValueHistory} from './value-history.js';
const at='2026-09-07T05:00:00Z';
async function fixture(t){const tempRoot=path.resolve(os.tmpdir()),root=await mkdtemp(path.join(tempRoot,'collection-value-test-'));assert.ok(root.startsWith(tempRoot+path.sep+'collection-value-test-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('value totals share record precedence and distinguish unknown, zero, owner and undated values',()=>{
  const records=[{cert:'1',fmv:{value:85},manual:{value:900}},{cert:'2',manual:{value:12.25,setAt:'2026-08-01'}},{kind:'card',grader:'PSA',cert:'1',fmv:{value:0,asOf:'2026-08-02'}},{cert:'3'}];
  const s=valueSnapshot(records,{observedAt:at});
  assert.equal(s.total,97.25);assert.equal(s.marketTotal,85);assert.equal(s.ownerTotal,12.25);
  assert.equal(s.count,4);assert.equal(s.valued,3);assert.equal(s.unvalued,1);assert.equal(s.undated,1);
  assert.equal(s.cards.valued,1);assert.equal(s.cards.total,0);assert.equal(s.comics.total,97.25);
  assert.equal(s.observedAt,'2026-09-07T05:00:00.000Z');
  assert.equal(valueSnapshot([{cert:'4',fmv:{value:'100'}}]).valued,0);
});
test('duplicate copies and mixed currencies cannot silently inflate a USD total',()=>{
  assert.throws(()=>valueSnapshot([{cert:'1'},{cert:'1'}]),/Duplicate copy/);
  assert.throws(()=>valueSnapshot([{cert:'1',fmv:{value:50,currency:'EUR'}}]),/not in USD/);
});
test('same-day rebuilds deduplicate while new days and valuation changes preserve earlier observations',()=>{
  const initial=valueSnapshot([{cert:'1',fmv:{value:10}}],{observedAt:at}),history={schemaVersion:1,currency:'USD',timeZone:'America/Phoenix',snapshots:[initial]};
  const photoOnly=valueSnapshot([{cert:'1',fmv:{value:10},images:{front:'new.jpg'}}],{observedAt:'2026-09-07T06:00:00Z'});
  assert.equal(appendSnapshot(history,photoOnly),history);
  const nextDay=valueSnapshot([{cert:'1',fmv:{value:10}}],{observedAt:'2026-09-07T08:00:00Z'});
  assert.equal(appendSnapshot(history,nextDay).snapshots.length,2);
  const changed=valueSnapshot([{cert:'1',fmv:{value:12}}],{observedAt:'2026-09-07T06:00:00Z'}),updated=appendSnapshot(history,changed);
  assert.deepEqual(updated.snapshots.map(s=>s.total),[10,12]);assert.equal(history.snapshots.length,1);
  assert.throws(()=>appendSnapshot(updated,valueSnapshot([{cert:'1'}],{observedAt:'2026-09-01'})),/predate/);
});
test('history survives rebuilding and malformed history is preserved for recovery',async t=>{
  const root=await fixture(t),records=[{cert:'1',fmv:{value:100}}];
  await captureValueHistory(root,records,{observedAt:at});await captureValueHistory(root,records,{observedAt:at});
  assert.equal((await readValueHistory(root)).snapshots.length,1);
  const file=path.join(root,'data/value-history.json');await writeFile(file,'{"broken":true}');
  await assert.rejects(()=>captureValueHistory(root,records),/Unsupported/);assert.equal(await readFile(file,'utf8'),'{"broken":true}');
});
test('historical totals come from complete saved revisions and their observation dates',async t=>{
  const root=await fixture(t),git=(args,date)=>execFileSync('git',args,{cwd:root,windowsHide:true,stdio:'pipe',env:{...process.env,...(date?{GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}:{})}});
  git(['init','-q']);await mkdir(path.join(root,'data/bins'),{recursive:true});
  const file=path.join(root,'data/bins/bin-01.json');
  await writeFile(file,JSON.stringify({bin:'01',comics:[{cert:'1',fmv:{value:25,fetchedAt:'2026-01-01'}}]}));
  const commit=(date)=>{git(['add','data']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Saved inventory'],date);};
  commit('2026-08-16T12:00:00-07:00');
  await writeFile(file,JSON.stringify({bin:'01',comics:[{cert:'1',fmv:{value:25,fetchedAt:'2026-01-01'}},{cert:'2',manual:{value:50}}]}));
  commit('2026-08-18T12:00:00-07:00');
  const seeded=await seedGitValueHistory(root);
  assert.equal(seeded.added,2);assert.deepEqual(seeded.history.snapshots.map(s=>[s.total,s.count]),[[25,1],[75,2]]);
  assert.equal(seeded.history.snapshots[0].observedAt,'2026-08-16T19:00:00.000Z');
  assert.equal(seeded.history.snapshots[1].source,'saved-inventory');assert.match(seeded.history.snapshots[1].revision,/^[a-f0-9]{40}$/);
  assert.equal((await seedGitValueHistory(root)).added,0);
});
