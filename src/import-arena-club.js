/** Reviewed Arena Club card details and viewer scans, with issuer identity intact. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {acceptedCardCertPage,acceptedCardImage} from './card-images.js';

export function parseArenaClub(capture,{sourceFile,now=new Date().toISOString()}={}){
  const c=capture;
  if(!acceptedCardCertPage('Arena Club',c.pageUrl,c.cert))throw Error('Arena Club cert/page mismatch');
  if(!c.subject||!/^\d{4}$/.test(c.year)||!c.set||!c.cardNumber)throw Error('Missing Arena Club card identity');
  const validGrade=g=>Number.isFinite(Number(g))&&Number(g)>=1&&Number(g)<=10&&Number(g)*2%1===0;
  if(!validGrade(c.grade)||!c.gradeDescription||['centering','edges','corners','surface'].some(k=>!validGrade(c.subgrades?.[k])))throw Error('Missing Arena Club grade or subgrades');
  if(c.scans?.length!==2||new Set(c.scans.map(s=>s.side)).size!==2||c.scans.some(s=>!acceptedCardImage('Arena Club',s.url,s.side)))throw Error('Unverified Arena Club scan pair');
  if(new Set(c.scans.map(s=>new URL(s.url).pathname.replace(/slab_(front|back)\.png$/,''))).size!==1)throw Error('Arena Club scans belong to different cards');
  if(c.centering&&(c.centering.left+c.centering.right!==100||c.centering.top+c.centering.bottom!==100))throw Error('Invalid Arena Club centering');
  return {id:`ArenaClub:${c.cert}`,kind:'card',provider:'ArenaClub',grader:'Arena Club',cert:c.cert,certUrl:c.pageUrl,subject:c.subject,year:c.year,brand:c.set,series:c.series,cardNumber:c.cardNumber,variety:[c.parallel,c.rarity].filter(Boolean).join(' · '),grade:c.grade,gradeDescription:c.gradeDescription,gradeDate:null,holder:'slab',population:null,valuation:null,images:{},scanStatus:'not-fetched',
    arenaClub:{subgrades:c.subgrades,centering:c.centering,populationUrl:c.populationUrl,sourceUrl:c.pageUrl,capturedAt:c.capturedAt||now},
    importSource:{file:sourceFile,pageUrl:c.pageUrl,capturedAt:c.capturedAt||now,importedAt:now}};
}
export async function importArenaClub(file,{directory='data/cards',now=new Date().toISOString()}={}){
  const capture=JSON.parse(await fs.readFile(file,'utf8')),container=capture.container,card=parseArenaClub(capture,{sourceFile:file,now});
  if(!container||!/^[a-z0-9-]{1,40}$/.test(container.id)||!container.title||!container.location||container.physical!==true||container.virtual!==false)throw Error('Arena Club import requires a physical container');
  await fs.mkdir(directory,{recursive:true});const filename=container.id+'.json';let prior={...container,cards:[]};
  const key=c=>(c.provider||c.grader)+':'+c.cert;
  for(const name of (await fs.readdir(directory)).filter(n=>n.endsWith('.json'))){const box=JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));
    if(name===filename){if(box.id!==container.id||box.virtual||box.physical===false)throw Error('Container identity conflict');prior=box;}
    else if(box.cards?.some(c=>key(c)===key(card)))throw Error('Arena Club copy exists in another container');}
  const previous=prior.cards.find(c=>key(c)===key(card));
  if(previous){for(const field of ['images','imageSources','scanStatus','location','valuation','fmv','manual','notes','acquisition'])if(Object.hasOwn(previous,field))card[field]=previous[field];card.importSource.importedAt=previous.importSource?.importedAt||now;}
  const cards=previous?prior.cards.map(c=>key(c)===key(card)?{...c,...card}:c):[...prior.cards,card];
  const destination=path.join(directory,filename);await fs.writeFile(destination+'.tmp',JSON.stringify({...prior,cards},null,2)+'\n');await fs.rename(destination+'.tmp',destination);
  return {destination,added:previous?0:1,records:cards.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)importArenaClub(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
