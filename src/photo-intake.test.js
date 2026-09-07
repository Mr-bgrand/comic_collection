import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { getPhotoRecord, searchPhotoRecords, readPhotoImage, savePhoto } from './photo-store.js';
import { createPhotoBridge } from './photo-bridge.js';
import { serveLab } from './lab-server.js';

async function fixture() {
  const root=await mkdtemp(path.join(os.tmpdir(),'photo-intake-test-'));
  for(const dir of ['data/bins','data/cards','data/images','docs/prototypes'])await mkdir(path.join(root,dir),{recursive:true});
  const prior=await sharp({create:{width:240,height:360,channels:3,background:'#235'}}).jpeg().toBuffer();
  await writeFile(path.join(root,'data/images/prior.jpg'),prior);
  await writeFile(path.join(root,'data/config.json'),JSON.stringify({baseUrl:'https://example.test',collectionName:'Test'}));
  await writeFile(path.join(root,'data/bins/bin-01.json'),JSON.stringify({bin:'01',title:'Test bin',comics:[{cert:'1234567890',title:'Test comic',issue:'1',grade:'9.8',images:{front:'prior.jpg'},imageSources:{front:{url:'https://grader.test/exact-copy'}},fmv:{value:42},notes:'Keep this note'}]}));
  await writeFile(path.join(root,'data/cards/case-01.json'),JSON.stringify({id:'case-01',title:'Case #1',location:'Case #1',physical:true,cards:[{kind:'card',cert:'1234567890',grader:'PSA',grade:'9',subject:'Test card',year:'2025',brand:'Set',images:{}}]}));
  for(const file of ['phone-capture.html','phone-capture.mjs','photo-intake.html','photo-intake.mjs','photo-intake.css'])await cp(path.join('docs/prototypes',file),path.join(root,'docs/prototypes',file));
  return root;
}
async function cleanup(root){if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('photo-intake-test-'))throw Error('Unsafe cleanup target');await rm(root,{recursive:true,force:true});}
const photo=()=>sharp({create:{width:220,height:340,channels:3,background:'#ba864d'}}).jpeg().withMetadata({orientation:6}).toBuffer();

test('cert search separates graders and returns only photo-intake metadata',async()=>{
  const root=await fixture();try {
    const matches=await searchPhotoRecords(root,'1234567890');assert.equal(matches.length,2);
    assert.deepEqual(new Set(matches.map(c=>c.id)),new Set(['CGC:1234567890','PSA:1234567890']));
    assert.ok(matches.every(c=>!('notes' in c)&&!('fmv' in c)));assert.equal((await searchPhotoRecords(root,'Case #1')).length,1);
    assert.deepEqual(await searchPhotoRecords(root,'1'),[]);await assert.rejects(getPhotoRecord(root,'../../config'),/existing/);
  }finally{await cleanup(root);}
});

test('photo replacement rotates, strips metadata, keeps exact old source and owner data, and rejects stale writes',async()=>{
  const root=await fixture();try {
    const id='CGC:1234567890',before=await getPhotoRecord(root,id),input=await photo();
    assert.ok((await sharp(input).metadata()).exif);
    const result=await savePhoto(root,{id,side:'front',revision:before.revision,input,source:'phone-upload'});
    const saved=JSON.parse(await readFile(path.join(root,'data/bins/bin-01.json'))).comics[0];
    assert.equal(saved.notes,'Keep this note');assert.equal(saved.fmv.value,42);assert.equal(saved.imageHistory[0].file,'prior.jpg');
    assert.equal(saved.imageHistory[0].source.url,'https://grader.test/exact-copy');
    assert.equal(saved.imageSources.front.kind,'owner-photo');assert.equal(saved.imageSources.front.source,'phone-upload');
    const meta=await sharp(await readFile(path.join(root,saved.imageSources.front.originalFile))).metadata();
    assert.equal(meta.width,340);assert.equal(meta.height,220);assert.equal(meta.exif,undefined);assert.equal(meta.orientation,undefined);
    assert.ok((await readPhotoImage(root,id,'front')).length);assert.ok((await readFile(path.join(root,'data/images/prior.jpg'))).length);
    assert.equal((await readdir(path.join(root,'data/backups/photos'))).length,1);
    await assert.rejects(savePhoto(root,{id,side:'back',revision:before.revision,input}),/record changed/);
    assert.equal((await savePhoto(root,{id,side:'front',revision:result.record.revision,input})).unchanged,true);
    const back=await savePhoto(root,{id,side:'back',revision:result.record.revision,input});assert.ok(back.record.images.front&&back.record.images.back);
    assert.equal(JSON.parse(await readFile(path.join(root,'data/bins/bin-01.json'))).comics[0].scanStatus,'complete');
  }finally{await cleanup(root);}
});

test('invalid images and invalid sides never mutate collection records',async()=>{
  const root=await fixture();try {
    const id='PSA:1234567890',record=await getPhotoRecord(root,id),file=path.join(root,'data/cards/case-01.json'),before=await readFile(file,'utf8');
    await assert.rejects(savePhoto(root,{id,side:'front',revision:record.revision,input:Buffer.from('<svg onload="anything"></svg>')}),/could not be read/);
    await assert.rejects(savePhoto(root,{id,side:'../../front',revision:record.revision,input:await photo()}),/front or back/);
    await assert.rejects(savePhoto(root,{id,side:'front',revision:record.revision,input:Buffer.alloc(20*1024*1024+1)}),/20 MB/);
    assert.equal(await readFile(file,'utf8'),before);
  }finally{await cleanup(root);}
});

test('paired phone can upload a reviewed photo; missing tokens, foreign origins, revoked and expired links cannot',async()=>{
  const root=await fixture();let clock=Date.now();
  const bridge=createPhotoBridge({root,port:0,addresses:()=>['127.0.0.1'],now:()=>clock,ttl:10000,save:body=>savePhoto(root,body)});
  try {
    const pair=await bridge.pair('CGC:1234567890'),link=new URL(pair.links[0].url),base=link.origin,token=link.hash.slice(1),auth={Authorization:'Bearer '+token};
    assert.equal((await fetch(base+'/api/capture/session')).status,401);
    assert.equal((await fetch(base+'/api/admin/state',{headers:auth})).status,404);
    assert.equal((await fetch(base+'/api/capture/session',{headers:{...auth,Origin:'https://evil.test'}})).status,403);
    const page=await fetch(base+'/capture/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const record=(await (await fetch(base+'/api/capture/session',{headers:auth})).json()).record;
    assert.equal(bridge.status(pair.pairingId).connected,true);
    const saved=await fetch(base+'/api/capture/save?id='+encodeURIComponent(record.id)+'&side=back',{method:'POST',headers:{...auth,'Content-Type':'image/jpeg','X-Record-Revision':record.revision},body:await photo()});
    assert.equal(saved.status,200);assert.equal((await saved.json()).record.images.back,true);assert.equal(bridge.status(pair.pairingId).saved,1);
    bridge.revoke(pair.pairingId);assert.equal((await fetch(base+'/api/capture/session',{headers:auth})).status,401);
    const second=await bridge.pair(record.id),secondToken=new URL(second.links[0].url).hash.slice(1);clock+=10001;
    assert.equal((await fetch(base+'/api/capture/session',{headers:{Authorization:'Bearer '+secondToken}})).status,401);
  }finally{await bridge.close();await cleanup(root);}
});

test('local Admin photo endpoints persist a card, finish the preview rebuild and preserve another grader',async()=>{
  const root=await fixture();
  await writeFile(path.join(root,'package.json'),JSON.stringify({scripts:{'review:build':'node mark-refresh.js'}}));
  await writeFile(path.join(root,'mark-refresh.js'),"require('fs').writeFileSync('review-refreshed','yes')");
  const server=await serveLab({root,port:0,photoPort:0}),base=`http://127.0.0.1:${server.address().port}`;
  try {
    const record=(await (await fetch(base+'/api/admin/photos/record?id=PSA%3A1234567890')).json()).record;
    const route=base+'/api/admin/photos/save?id=PSA%3A1234567890&side=front';
    assert.equal((await fetch(route,{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'image/jpeg'},body:await photo()})).status,403);
    const result=await fetch(route,{method:'POST',headers:{'Content-Type':'image/jpeg','X-Record-Revision':record.revision},body:await photo()});assert.equal(result.status,200);
    assert.equal((await result.json()).previewReady,true);assert.equal(await readFile(path.join(root,'review-refreshed'),'utf8'),'yes');
    assert.equal((await getPhotoRecord(root,'CGC:1234567890')).revision,(await searchPhotoRecords(root,'Test comic'))[0].revision);
    assert.equal(JSON.parse(await readFile(path.join(root,'data/bins/bin-01.json'))).comics[0].images.front,'prior.jpg');
  }finally{await new Promise(r=>server.close(r));await cleanup(root);}
});
