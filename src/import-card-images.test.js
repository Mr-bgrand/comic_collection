import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {acceptedCardImage,acceptedTagSlabPhoto} from './card-images.js';
import {importCardImages} from './import-card-images.js';

const cert='H5738313',host='https://d39lwrz0lm7c9r.cloudfront.net';
const entry={grader:'TAG',cert,renderedCert:cert,kind:'slab-photo',pageUrl:`https://my.taggrading.com/card/${cert}`,
  front:`${host}/slab-images/${cert}_Slabbed_FRONT.jpg`,back:`${host}/slab-images/${cert}_Slabbed_BACK.jpg`};
test('TAG slab sources require the exact cert, side and official host; MAIN remains a separate image type',()=>{
  assert.equal(acceptedCardImage('TAG',entry.front,'front',cert,false,'slab-photo'),true);
  for(const source of [entry.back,entry.front.replace(cert,'D4344079'),entry.front+'?other=1',entry.front+'#x',entry.front.replace('https:','http:'),entry.front.replace('.net/','.net.evil.test/'),`${host}/card-images/id_FRONT_MAIN.jpg`])
    assert.equal(acceptedCardImage('TAG',source,'front',cert,false,'slab-photo'),false,source);
  assert.equal(acceptedCardImage('TAG',entry.front,'front',cert),false);
  assert.equal(acceptedCardImage('TAG',`${host}/card-images/id_FRONT_MAIN.jpg`,'front',cert),true);
  assert.equal(acceptedCardImage('TAG',`${host}/card-images/id_FRONT_SFX.jpg`,'front',cert),false);
  assert.equal(acceptedTagSlabPhoto(entry.front,'front'),true);
  assert.equal(acceptedTagSlabPhoto(entry.front,'front','D4344079'),false);
  for(const name of ['id_FRONT_MAIN.jpg','id_FRONT_SFX.jpg','id_FRONT_SURFACE_DEFECT_1.jpg','id_FRONT_SLAB.jpg','unlabeled.jpg'])assert.equal(acceptedTagSlabPhoto(`${host}/card-images/${name}`,'front'),false);
});

async function fixture(run){
  const directory=await mkdtemp(path.join(tmpdir(),'collection-slab-test-'));
  // The cleanup target is the exact temporary directory created above.
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));
  const manifestFile=path.join(directory,'manifest.json'),containerFile=path.join(directory,'container.json');
  const old={images:{front:'TAG_H5738313_FRONT.jpg',back:'TAG_H5738313_BACK.jpg'},imageSources:{front:{kind:'plain-scan',url:`${host}/card-images/id_FRONT_MAIN.jpg`},back:{kind:'plain-scan',url:`${host}/card-images/id_BACK_MAIN.jpg`}}};
  const original={grader:'TAG',cert,grade:'9',subject:'Test card',manual:{value:17},...old};
  await writeFile(manifestFile,JSON.stringify({discoveredAt:'2026-09-08T00:00:00Z',records:[entry]}));
  await writeFile(containerFile,JSON.stringify({id:'case-02',cards:[original]}));
  const bytes=await sharp({create:{width:60,height:100,channels:3,background:'#abc'}}).jpeg().toBuffer();
  let requests=0;
  const options={assetDirectory:directory,requestDelayMs:0,fetchImage:async()=>{requests++;return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});}};
  try{await run({directory,manifestFile,containerFile,old,original,options,requests:()=>requests});}
  finally{await rm(directory,{recursive:true,force:true});}
}
test('slab import preserves both plain scans and inventory metadata, is resumable and cannot be downgraded by an old capture',async()=>fixture(async f=>{
  const result=await importCardImages(f.manifestFile,f.containerFile,f.options);assert.equal(result.downloaded,2);assert.deepEqual(result.errors,[]);
  const c=JSON.parse(await readFile(f.containerFile,'utf8')).cards[0];
  assert.deepEqual(c.cardScans,f.old);assert.deepEqual(c.manual,f.original.manual);assert.equal(c.grade,'9');
  for(const side of ['front','back']){assert.equal(c.imageSources[side].kind,'slab-photo');assert.match(c.images[side],/_SLAB_/);assert.ok((await readFile(path.join(f.directory,'images',c.images[side]))).length);}
  assert.equal((await importCardImages(f.manifestFile,f.containerFile,f.options)).downloaded,0);assert.equal(f.requests(),2);
  await writeFile(f.manifestFile,JSON.stringify({records:[{...entry,kind:'plain-scan',front:f.old.imageSources.front.url,back:f.old.imageSources.back.url}]}));
  assert.equal((await importCardImages(f.manifestFile,f.containerFile,f.options)).protectedSides,2);
  assert.deepEqual(JSON.parse(await readFile(f.containerFile,'utf8')).cards[0],c);assert.equal(f.requests(),2);
}));
test('slab import rejects an unreviewed cert pair before downloading or changing inventory',async()=>fixture(async f=>{
  const before=await readFile(f.containerFile,'utf8');
  await writeFile(f.manifestFile,JSON.stringify({records:[{...entry,renderedCert:'D4344079'}]}));
  await assert.rejects(importCardImages(f.manifestFile,f.containerFile,f.options),/reviewed TAG cert/);
  assert.equal(await readFile(f.containerFile,'utf8'),before);assert.equal(f.requests(),0);
}));
test('a failed slab side retains its previous plain scan and can be retried without losing provenance',async()=>fixture(async f=>{
  const result=await importCardImages(f.manifestFile,f.containerFile,{...f.options,fetchImage:async(url,options)=>url===entry.back?new Response('Unavailable',{status:503}):f.options.fetchImage(url,options)});
  assert.equal(result.downloaded,1);assert.equal(result.errors.length,1);
  let c=JSON.parse(await readFile(f.containerFile,'utf8')).cards[0];assert.equal(c.images.back,f.old.images.back);assert.equal(c.scanStatus,'retry-needed');
  await importCardImages(f.manifestFile,f.containerFile,f.options);c=JSON.parse(await readFile(f.containerFile,'utf8')).cards[0];
  assert.deepEqual(c.cardScans,f.old);assert.equal(c.scanStatus,'complete');
}));
test('grader imports preserve a manually attached owner photo',async()=>fixture(async f=>{
  const c={...f.original,imageSources:{...f.old.imageSources,front:{kind:'owner-photo',url:null}},images:{...f.old.images,front:'owner-front.jpg'}};
  await writeFile(f.containerFile,JSON.stringify({cards:[c]}));
  const result=await importCardImages(f.manifestFile,f.containerFile,f.options);assert.equal(result.protectedSides,1);
  const updated=JSON.parse(await readFile(f.containerFile,'utf8')).cards[0];assert.equal(updated.images.front,'owner-front.jpg');assert.equal(updated.images.back,'TAG_H5738313_SLAB_BACK.jpg');
}));
test('a blocked image service stops the batch without requesting later cards',async()=>fixture(async f=>{
  const second={...f.original,cert:'D4344079'};
  await writeFile(f.containerFile,JSON.stringify({cards:[f.original,second]}));
  const next={...entry,cert:second.cert,renderedCert:second.cert,pageUrl:entry.pageUrl.replace(cert,second.cert),front:entry.front.replace(cert,second.cert),back:entry.back.replace(cert,second.cert)};
  await writeFile(f.manifestFile,JSON.stringify({records:[entry,next]}));let requests=0;
  const result=await importCardImages(f.manifestFile,f.containerFile,{...f.options,fetchImage:async()=>{requests++;return new Response('Slow down',{status:429});}});
  assert.equal(requests,1);assert.equal(result.errors.length,1);assert.deepEqual(JSON.parse(await readFile(f.containerFile,'utf8')).cards[1],second);
}));
test('slabFront/slabBack captures and fetchImpl remain supported, with first-class scan slots and no repeat downloads',async()=>fixture(async f=>{
  await writeFile(f.manifestFile,JSON.stringify({records:[{grader:'TAG',cert,pageUrl:entry.pageUrl,
    front:f.old.imageSources.front.url,back:f.old.imageSources.back.url,slabFront:entry.front,slabBack:entry.back}]}));
  const options={assetDirectory:f.directory,requestDelayMs:0,fetchImpl:f.options.fetchImage};
  const result=await importCardImages(f.manifestFile,f.containerFile,options);assert.equal(result.downloaded,4);
  const c=JSON.parse(await readFile(f.containerFile,'utf8')).cards[0];
  assert.equal(c.images.front,'TAG_H5738313_SLAB_FRONT.jpg');assert.equal(c.images.back,'TAG_H5738313_SLAB_BACK.jpg');
  for(const [side,slot]of [['front','scanFront'],['back','scanBack']]){
    assert.equal(c.images[slot],f.old.images[side]);assert.equal(c.imageSources[slot].kind,'plain-scan');
    assert.deepEqual(c.imageSources[slot],c.cardScans.imageSources[side]);
  }
  assert.equal((await importCardImages(f.manifestFile,f.containerFile,options)).downloaded,0);assert.equal(f.requests(),4);
}));
test('legacy slab fields reject other graders and surface-effect images before fetching',async()=>fixture(async f=>{
  await writeFile(f.manifestFile,JSON.stringify({records:[{...entry,slabFront:entry.front,slabBack:`${host}/card-images/id_BACK_SFX.jpg`}]}));
  await assert.rejects(importCardImages(f.manifestFile,f.containerFile,f.options),/Rejected slab photo/);assert.equal(f.requests(),0);
  await writeFile(f.manifestFile,JSON.stringify({records:[{...entry,grader:'PSA',slabFront:entry.front}]}));
  await assert.rejects(importCardImages(f.manifestFile,f.containerFile,f.options),/only defined for TAG/);assert.equal(f.requests(),0);
}));
