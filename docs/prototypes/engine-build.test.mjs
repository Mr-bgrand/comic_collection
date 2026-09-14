import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,readdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {addObservation,acceptObservation,identityOf} from '../../src/valuation/observations.js';

test('fixture production build bundles Values controls and source-aware public data without captures',async t=>{
 const sourceRoot=fileURLToPath(new URL('../../',import.meta.url)),root=await mkdtemp(path.join(os.tmpdir(),'valuation-build-test-'));
 t.after(async()=>{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('valuation-build-test-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});});
 for(const dir of ['data/bins','data/images','docs/prototypes','assets/audio'])await mkdir(path.join(root,dir),{recursive:true});
 const prototype=path.join(sourceRoot,'docs/prototypes');for(const name of await readdir(prototype))if(/\.(m?js|css|html)$/.test(name)&&name!=='engine.html'&&!name.includes('.test.'))await copyFile(path.join(prototype,name),path.join(root,'docs/prototypes',name));
 await copyFile(path.join(sourceRoot,'assets/audio/cornfield-chase.mp3'),path.join(root,'assets/audio/cornfield-chase.mp3'));
 await sharp({create:{width:50,height:78,channels:3,background:'#334466'}}).jpeg().toFile(path.join(root,'data/images/fixture.jpg'));
 const now='2026-09-01T12:00:00Z',r={cert:'123',title:'Venom',issue:'1',grade:'9.8',images:{front:'fixture.jpg'}};
 const record=acceptObservation(addObservation(r,{id:'guide-1',copyId:'CGC:123',basis:'guide',value:123.45,currency:'USD',source:{name:'Independent guide',url:'https://example.com/price',asOf:null,retrievedAt:now},match:{identity:identityOf(r),grade:'9.8',grader:'CGC',condition:null,status:'exact'},reviewStatus:'pending',privateCapture:'PRIVATE_CAPTURE_SENTINEL'},{now}),'guide-1',{now});
 await writeFile(path.join(root,'data/bins/bin-01.json'),JSON.stringify({bin:'01',title:'Fixture',comics:[record]}));await writeFile(path.join(root,'data/config.json'),JSON.stringify({baseUrl:'https://example.com',collectionName:'Fixture'}));
 const run=file=>execFileSync(process.execPath,[path.join(sourceRoot,file)],{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024});
 run('src/build.js');run('docs/prototypes/build-engine.mjs');
 const html=await readFile(path.join(root,'dist/review/index.html'),'utf8'),payload=JSON.parse(html.match(/<script id="engine-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(payload.records[0].value,123.45);assert.equal(payload.records[0].date,null);assert.equal(payload.records[0].basis,'guide');assert.deepEqual(payload.records[0].valuationFlags,['undated']);assert.equal(payload.valueHistory.current.total,123.45);assert.equal(payload.valueHistory.current.marketTotal,123.45);assert.equal(payload.valueHistory.current.comparisonTotal,0);
 assert.ok(!html.includes('PRIVATE_CAPTURE_SENTINEL'));assert.ok(!JSON.stringify(payload).includes('revision'));assert.match(html,/id="admin-values"/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1],check=path.join(root,'bundled-check.mjs');await writeFile(check,script);execFileSync(process.execPath,['--check',check],{windowsHide:true});
 const sheet=await readFile(path.join(root,'dist/bin/01/sheet.html'),'utf8');assert.match(sheet,/123\.45/);assert.match(sheet,/Independent guide · Source undated/);
});
