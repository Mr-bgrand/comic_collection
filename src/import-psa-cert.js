/** Reviewed public PSA cert data for owner-held cards, independent of vault custody. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {acceptedCardImage,acceptedCardCertPage} from './card-images.js';

export function parsePsaCert(c,{sourceFile,now=new Date().toISOString()}={}){
 const f=c.fields||{},grade=f['Item Grade']?.match(/^(.*) (10|[1-9](?:\.5)?)$/);
 if(!acceptedCardCertPage('PSA',c.pageUrl,c.cert)||f['Cert Number']!==c.cert)throw Error('PSA certificate mismatch');
 if(!grade||!/^\d{4}$/.test(f.Year)||!f.Subject||!f['Brand/Title'])throw Error('Incomplete PSA identity');
 if(!c.capturedAt||!Number.isFinite(Date.parse(c.capturedAt)))throw Error('Missing PSA capture date');
 const noScans=c.scans?.length===0&&c.scanStatus==='no-scans-on-cert-page'&&c.scanReview?.scrolled===true&&c.scanReview?.rechecked===true;
 const pendingScans=c.scans?.length===0&&c.reviewStatus==='pending-scan-recheck'&&!c.scanStatus;
 if(!noScans&&!pendingScans&&(c.scans?.length!==2||new Set(c.scans.map(s=>s.side)).size!==2||c.scans.some(s=>!acceptedCardImage('PSA',s.url,s.side)||s.alt!==`Cert image ${s.side==='front'?1:2}`)))throw Error('Unverified PSA cert scans');
 if(!noScans&&!pendingScans&&new Set(c.scans.map(s=>new URL(s.url).pathname.split('/')[2])).size!==1)throw Error('PSA scans belong to different internal IDs');
 if(c.estimate&&(c.estimate.label!=='PSA ESTIMATE'||c.estimate.currency!=='USD'||!Number.isFinite(c.estimate.value)||c.estimate.value<0))throw Error('Unverified PSA estimate');
 if(c.population&&['atGrade','higher'].some(k=>!Number.isInteger(c.population[k])||c.population[k]<0))throw Error('Invalid PSA population');
 const asOf=c.capturedAt.slice(0,10);
 return {kind:'card',grader:'PSA',cert:c.cert,certUrl:c.pageUrl,subject:f.Subject,year:f.Year,brand:f['Brand/Title'],cardNumber:f['Card Number']||null,variety:f.Variety||f['Variety/Pedigree']||null,category:f.Category||null,grade:grade[2],gradeDescription:grade[1],holder:'slab',location:null,valuation:null,
  fmv:c.estimate?{value:c.estimate.value,source:'psa-cert-page',currency:'USD',asOf,url:c.pageUrl,status:'recorded'}:null,
  population:c.population?{...c.population,total:null,asOf,source:'PSA',url:c.pageUrl}:null,
  images:{},scanStatus:noScans?'no-scans-on-cert-page':'not-fetched',...(noScans?{scanCheckedAt:c.scanReview.checkedAt||c.capturedAt,scanReview:c.scanReview}:{}),importSource:{file:sourceFile,pageUrl:c.pageUrl,capturedAt:c.capturedAt,importedAt:now}};
}
export async function importPsaCert(file,{directory='data/cards',now=new Date().toISOString()}={}){
 const capture=JSON.parse(await fs.readFile(file,'utf8')),container=capture.container;
 if(!container||!/^[a-z0-9-]{1,40}$/.test(container.id)||!container.title||!container.location||container.physical!==true||container.virtual!==false)throw Error('PSA cert import requires an owner-assigned physical container');
 const incoming=capture.records.map(c=>parsePsaCert(c,{sourceFile:file,now})),certs=new Set(incoming.map(c=>c.cert));if(certs.size!==incoming.length)throw Error('Duplicate PSA cert');
 await fs.mkdir(directory,{recursive:true});const filename=container.id+'.json';let prior={...container,cards:[]};
 for(const name of (await fs.readdir(directory)).filter(n=>n.endsWith('.json'))){const box=JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));
  if(name===filename){if(box.id!==container.id||box.virtual||box.physical===false)throw Error('Container identity conflict');prior=box;}
  else if(box.cards?.some(c=>c.grader==='PSA'&&certs.has(c.cert)))throw Error('PSA copy already exists in another container');}
 const old=new Map(prior.cards.filter(c=>c.grader==='PSA').map(c=>[c.cert,c]));
 const cards=incoming.map(c=>{const previous=old.get(c.cert);if(!previous)return c;const merged={...previous,...c};
  for(const key of ['images','imageSources','scanStatus','location','valuation','manual','notes','acquisition'])if(Object.hasOwn(previous,key))merged[key]=previous[key];
  merged.importSource.importedAt=previous.importSource?.importedAt||now;return merged;});
 cards.push(...prior.cards.filter(c=>c.grader!=='PSA'||!certs.has(c.cert)));
 const destination=path.join(directory,filename);await fs.writeFile(destination+'.tmp',JSON.stringify({...prior,cards},null,2)+'\n');await fs.rename(destination+'.tmp',destination);
 return {destination,added:incoming.filter(c=>!old.has(c.cert)).length,records:cards.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)importPsaCert(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
