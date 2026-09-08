/** Download only scan URLs discovered in a grader's actual rendered cert viewer. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {acceptedCardImage,acceptedCardCertPage,acceptedTagSlabPhoto} from './card-images.js';

export async function importCardImages(manifestFile,containerFile='data/cards/psa-vault.json',{fetchImpl=fetch}={}) {
  const manifest=JSON.parse(await readFile(manifestFile,'utf8')),container=JSON.parse(await readFile(containerFile,'utf8'));
  await mkdir('data/images',{recursive:true});await mkdir('data/medium',{recursive:true});await mkdir('data/wall',{recursive:true});
  const records=new Map(container.cards.map(c=>[c.grader+':'+c.cert,c])),errors=[];let downloaded=0,missing=0;
  // Validate the entire manifest before changing any stored record.
  for(const entry of manifest.records){
    if(!records.has(entry.grader+':'+entry.cert))throw new Error('Unknown card in image manifest: '+entry.cert);
    if(!/^[a-zA-Z0-9]+$/.test(entry.cert))throw new Error('Invalid certification identifier');
    if(!acceptedCardCertPage(entry.grader,entry.pageUrl,entry.cert))throw new Error('Cert page does not match '+entry.cert);
    const reversed=entry.grader==='CGC'&&entry.orientation==='reversed';
    if(entry.grader==='CGC'&&reversed!==!!records.get('CGC:'+entry.cert).cgc?.scanOrientation?.reversed)throw new Error('CGC orientation does not match reviewed record');
    for(const side of ['front','back'])if(entry[side]&&!acceptedCardImage(entry.grader,entry[side],side,entry.cert,reversed))throw new Error('Rejected scan source for '+entry.cert+' '+side);
    for(const key of ['slabFront','slabBack'])if(entry[key]){
      if(entry.grader!=='TAG')throw new Error('Slab photos are only defined for TAG cert pages: '+entry.cert);
      if(!acceptedTagSlabPhoto(entry[key],key==='slabFront'?'front':'back'))throw new Error('Rejected slab photo source for '+entry.cert+' '+key);
    }
    if(entry.grader==='CGC'&&entry.front&&entry.back&&entry.front.replace(/_(OBV|REV)\.jpg$/,'')!==entry.back.replace(/_(OBV|REV)\.jpg$/,''))throw new Error('CGC scans refer to different image IDs');
    if(entry.grader==='Arena Club'&&entry.front&&entry.back&&new URL(entry.front).pathname.replace(/slab_front\.png$/,'')!==new URL(entry.back).pathname.replace(/slab_back\.png$/,''))throw new Error('Arena Club scans refer to different image IDs');
  }
  for(const entry of manifest.records){
    const card=records.get(entry.grader+':'+entry.cert);card.images??={};card.imageSources??={};
    if(!entry.front&&!entry.back&&!entry.slabFront&&!entry.slabBack){card.scanStatus=entry.status==='no-scans-on-cert-page'?'no-scans-on-cert-page':'not-fetched';card.scanCheckedAt=manifest.discoveredAt;missing++;continue;}
    try{
      // Each side yields up to two assets. When the manifest carries a slab
      // photo (the GRADED IMAGES photograph of the encapsulated card), that is
      // what the copy looks like, so it becomes the display image; the MAIN
      // scan stays first-class under scanFront/scanBack. The scan job runs
      // first so an already-downloaded display scan is re-slotted, not
      // refetched.
      const jobs=[];
      for(const side of ['front','back']){
        const slabUrl=entry[side==='front'?'slabFront':'slabBack'];
        if(entry[side])jobs.push({url:entry[side],slot:slabUrl?(side==='front'?'scanFront':'scanBack'):side,side,suffix:side.toUpperCase(),kind:'plain-scan'});
        if(slabUrl)jobs.push({url:slabUrl,slot:side,side,suffix:side.toUpperCase()+'_SLAB',kind:'slab-photo'});
      }
      for(const job of jobs){
        const {url,slot,side}=job;
        const filename=entry.grader.replaceAll(' ','')+'_'+entry.cert+'_'+job.suffix+'.jpg',destination='data/images/'+filename;
        const originalFile='data/originals/'+filename;
        const keepOriginal=['TAG','CGC','Arena Club'].includes(entry.grader);
        const settled=source=>source?.url===url&&existsSync(destination)&&(!keepOriginal||existsSync(originalFile));
        if(settled(card.imageSources[slot])){if(card.images[slot]!==filename)card.images[slot]=filename;continue;}
        if(slot!==side&&settled(card.imageSources[side])){
          // The scan this card already displays is stepping aside for the slab
          // photo: carry its verified record over instead of fetching again.
          card.imageSources[slot]=card.imageSources[side];card.images[slot]=filename;continue;
        }
        const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error(`Image request returned ${response.status}`);
        if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Source did not return an image');
        const input=Buffer.from(await response.arrayBuffer());if(input.length>35*1024*1024)throw new Error('Unexpectedly large scan');
        const metadata=await sharp(input).metadata();if(!metadata.width||!metadata.height)throw new Error('Invalid image dimensions');
        if(keepOriginal){await mkdir('data/originals',{recursive:true});await writeFile(originalFile+'.tmp',input);await rename(originalFile+'.tmp',originalFile);}
        const master=await sharp(input).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
        await writeFile(destination+'.tmp',master);await rename(destination+'.tmp',destination);
        await sharp(master).resize({width:760,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:87}).toFile('data/medium/'+filename);
        await sharp(master).resize({height:320,withoutEnlargement:true}).jpeg({quality:80}).toFile('data/wall/'+filename);
        const prior=card.images[slot];
        if(job.kind==='slab-photo'&&prior&&prior!==filename&&card.images[side==='front'?'scanFront':'scanBack']!==prior){
          // Same shape a replacement takes in the photo lab: nothing leaves
          // the record silently when the display image changes hands.
          card.imageHistory??=[];card.imageHistory.push({side,file:prior,source:card.imageSources?.[slot]||null,replacedAt:new Date().toISOString()});
        }
        card.images[slot]=filename;card.imageSources[slot]={url,pageUrl:entry.pageUrl,side,kind:job.kind,discoveredAt:entry.discoveredAt||manifest.discoveredAt,retrievedAt:new Date().toISOString(),sideBasis:job.kind==='slab-photo'?'TAG rendered card page: GRADED IMAGES section FRONT / BACK labels':{'Arena Club':'Arena Club rendered card viewer: Front and Back controls and matching slab_front/slab_back files',PSA:'PSA cert viewer: image 1 front, image 2 reverse',TAG:'TAG rendered card page: explicit FRONT_MAIN / BACK_MAIN suffix',CGC:card.cgc?.scanOrientation?.basis||'CGC Cards rendered cert viewer: Obverse / Reverse labels and cert-matching OBV / REV files'}[entry.grader],...(entry.grader==='CGC'?{sourceSide:/_OBV\.jpg$/.test(url)?'Obverse':'Reverse',visuallyReversed:entry.orientation==='reversed'}:{}),originalWidth:metadata.width,originalHeight:metadata.height,sha256:createHash('sha256').update(master).digest('hex'),...(keepOriginal?{originalFile,originalSha256:createHash('sha256').update(input).digest('hex')}: {})};downloaded++;
      }
      card.scanStatus=card.images.front&&card.images.back?'complete':'partial';
    }catch(error){card.scanStatus='retry-needed';errors.push({cert:card.cert,error:error.message});}
    // Save after each pair so a network interruption does not discard verified work.
    await writeFile(containerFile+'.tmp',JSON.stringify(container,null,2)+'\n');await rename(containerFile+'.tmp',containerFile);
  }
  await writeFile(containerFile+'.tmp',JSON.stringify(container,null,2)+'\n');await rename(containerFile+'.tmp',containerFile);
  return {downloaded,complete:container.cards.filter(c=>c.scanStatus==='complete').length,missing,errors};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)importCardImages(process.argv[2],process.argv[3]).then(r=>{console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
