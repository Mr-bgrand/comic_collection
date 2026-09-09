/** Download only scan URLs discovered in a grader's actual rendered cert viewer. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {acceptedCardImage,acceptedCardCertPage,acceptedTagSlabPhoto} from './card-images.js';

export async function importCardImages(manifestFile,containerFile='data/cards/psa-vault.json',{assetDirectory='data',fetchImpl=fetch,fetchImage=fetchImpl,requestDelayMs=1500}={}) {
  const manifest=JSON.parse(await readFile(manifestFile,'utf8')),container=JSON.parse(await readFile(containerFile,'utf8'));
  // Keep the slabFront/slabBack manifest format alongside explicit slab-photo
  // entries. Its cert-named photographs are verified before any MAIN scan job.
  manifest.records=manifest.records.flatMap(entry=>{
    if(!entry.slabFront&&!entry.slabBack)return [entry];
    if(entry.grader!=='TAG')throw new Error('Slab photos are only defined for TAG cert pages');
    if(!acceptedTagSlabPhoto(entry.slabFront,'front',entry.cert)||!acceptedTagSlabPhoto(entry.slabBack,'back',entry.cert))throw new Error('Rejected slab photo source or incomplete pair for '+entry.cert);
    const {slabFront,slabBack,...plain}=entry;
    return [...(plain.front||plain.back?[{...plain,kind:'plain-scan'}]:[]),
      {...plain,kind:'slab-photo',renderedCert:entry.renderedCert||entry.cert,front:slabFront,back:slabBack}];
  });
  const asset=(directory,file='')=>path.join(assetDirectory,directory,file);
  for(const directory of ['images','medium','wall'])await mkdir(asset(directory),{recursive:true});
  const records=new Map(container.cards.map(c=>[c.grader+':'+c.cert,c])),errors=[];let downloaded=0,missing=0,protectedSides=0,serviceBlocked=false;
  // Validate the entire manifest before changing any stored record.
  for(const entry of manifest.records){
    if(!records.has(entry.grader+':'+entry.cert))throw new Error('Unknown card in image manifest: '+entry.cert);
    if(!/^[a-zA-Z0-9]+$/.test(entry.cert))throw new Error('Invalid certification identifier');
    if(!acceptedCardCertPage(entry.grader,entry.pageUrl,entry.cert))throw new Error('Cert page does not match '+entry.cert);
    const kind=entry.kind||'plain-scan';
    if(!['plain-scan','slab-photo'].includes(kind)||(kind==='slab-photo'&&(entry.grader!=='TAG'||entry.renderedCert!==entry.cert||!entry.front||!entry.back)))throw new Error('Slab photographs require a reviewed TAG cert and both sides');
    const reversed=entry.grader==='CGC'&&entry.orientation==='reversed';
    if(entry.grader==='CGC'&&reversed!==!!records.get('CGC:'+entry.cert).cgc?.scanOrientation?.reversed)throw new Error('CGC orientation does not match reviewed record');
    for(const side of ['front','back'])if(entry[side]&&!acceptedCardImage(entry.grader,entry[side],side,entry.cert,reversed,kind))throw new Error('Rejected scan source for '+entry.cert+' '+side);
    if(entry.grader==='CGC'&&entry.front&&entry.back&&entry.front.replace(/_(OBV|REV)\.jpg$/,'')!==entry.back.replace(/_(OBV|REV)\.jpg$/,''))throw new Error('CGC scans refer to different image IDs');
    if(entry.grader==='Arena Club'&&entry.front&&entry.back&&new URL(entry.front).pathname.replace(/slab_front\.png$/,'')!==new URL(entry.back).pathname.replace(/slab_back\.png$/,''))throw new Error('Arena Club scans refer to different image IDs');
  }
  for(const entry of manifest.records){
    const card=records.get(entry.grader+':'+entry.cert);card.images??={};card.imageSources??={};
    if(!entry.front&&!entry.back){if(!card.images.front&&!card.images.back)card.scanStatus=entry.status==='no-scans-on-cert-page'?'no-scans-on-cert-page':'not-fetched';card.scanCheckedAt=manifest.discoveredAt;missing++;continue;}
    try{
      for(const side of ['front','back']){
        const url=entry[side];if(!url)continue;
        const kind=entry.kind||'plain-scan',previous=card.imageSources[side];
        // Importing an old capture must not downgrade a slab or replace a photo
        // the owner attached manually. Card-only scans remain available below.
        if(previous?.kind==='owner-photo'||(entry.grader==='TAG'&&previous?.kind==='slab-photo'&&kind==='plain-scan')){protectedSides++;continue;}
        const filename=entry.grader.replaceAll(' ','')+'_'+entry.cert+'_'+(kind==='slab-photo'?'SLAB_':'')+side.toUpperCase()+'.jpg',destination=asset('images',filename);
        const originalFile=asset('originals',filename);
        const keepOriginal=['TAG','CGC','Arena Club'].includes(entry.grader);
        if(card.imageSources[side]?.url===url&&existsSync(destination)&&(!keepOriginal||existsSync(originalFile)))continue;
        if(requestDelayMs>0)await new Promise(resolve=>setTimeout(resolve,requestDelayMs));
        const response=await fetchImage(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
        if(!response.ok){serviceBlocked=[403,429].includes(response.status);throw new Error(`Image request returned ${response.status}`);}
        if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Source did not return an image');
        const input=Buffer.from(await response.arrayBuffer());if(input.length>35*1024*1024)throw new Error('Unexpectedly large scan');
        const metadata=await sharp(input).metadata();if(!metadata.width||!metadata.height)throw new Error('Invalid image dimensions');
        if(keepOriginal){await mkdir(asset('originals'),{recursive:true});await writeFile(originalFile+'.tmp',input);await rename(originalFile+'.tmp',originalFile);}
        const master=await sharp(input).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
        await writeFile(destination+'.tmp',master);await rename(destination+'.tmp',destination);
        await sharp(master).resize({width:760,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:87}).toFile(asset('medium',filename));
        await sharp(master).resize({height:320,withoutEnlargement:true}).jpeg({quality:80}).toFile(asset('wall',filename));
        if(kind==='slab-photo'&&previous?.kind==='plain-scan'&&card.images[side]){
          card.cardScans??={images:{},imageSources:{}};
          card.cardScans.images[side]=card.images[side];card.cardScans.imageSources[side]=previous;
        }
        card.images[side]=filename;card.imageSources[side]={url,pageUrl:entry.pageUrl,side,kind,discoveredAt:entry.discoveredAt||manifest.discoveredAt,retrievedAt:new Date().toISOString(),sideBasis:kind==='slab-photo'?'TAG rendered cert page: Slabbed image captures, Front / Back labels and cert-matching Slabbed_FRONT / Slabbed_BACK files':{'Arena Club':'Arena Club rendered card viewer: Front and Back controls and matching slab_front/slab_back files',PSA:'PSA cert viewer: image 1 front, image 2 reverse',TAG:'TAG rendered card page: explicit FRONT_MAIN / BACK_MAIN suffix',CGC:card.cgc?.scanOrientation?.basis||'CGC Cards rendered cert viewer: Obverse / Reverse labels and cert-matching OBV / REV files'}[entry.grader],...(entry.grader==='CGC'?{sourceSide:/_OBV\.jpg$/.test(url)?'Obverse':'Reverse',visuallyReversed:entry.orientation==='reversed'}:{}),originalWidth:metadata.width,originalHeight:metadata.height,sha256:createHash('sha256').update(master).digest('hex'),...(keepOriginal?{originalFile:originalFile.replaceAll('\\','/'),originalSha256:createHash('sha256').update(input).digest('hex')}: {})};downloaded++;
      }
      card.scanStatus=card.images.front&&card.images.back?'complete':'partial';
    }catch(error){card.scanStatus='retry-needed';errors.push({cert:card.cert,error:error.message});}
    // Retain the first-class scan slots introduced by the earlier TAG importer.
    for(const side of ['front','back'])if(card.cardScans?.images[side]){
      const slot=side==='front'?'scanFront':'scanBack';
      card.images[slot]=card.cardScans.images[side];card.imageSources[slot]=card.cardScans.imageSources[side];
    }
    // Save after each pair so a network interruption does not discard verified work.
    await writeFile(containerFile+'.tmp',JSON.stringify(container,null,2)+'\n');await rename(containerFile+'.tmp',containerFile);
    if(serviceBlocked)break; // Leave later records untouched; resume after the service recovers.
  }
  await writeFile(containerFile+'.tmp',JSON.stringify(container,null,2)+'\n');await rename(containerFile+'.tmp',containerFile);
  return {downloaded,complete:container.cards.filter(c=>c.scanStatus==='complete').length,missing,protectedSides,errors};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)importCardImages(process.argv[2],process.argv[3]).then(r=>{console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
