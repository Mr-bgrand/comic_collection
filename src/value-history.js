/** Recorded inventory totals, with coverage and observation dates kept explicit. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { effectiveValue, fmvValue, graderOf } from './model.js';
import { readCollection } from './lab-admin.js';

const historyPath=root=>path.join(root,'data/value-history.json');
const emptyTotals=()=>({total:0,count:0,valued:0,unvalued:0,marketTotal:0,ownerTotal:0,undated:0});
const round=value=>Math.round(value*100)/100;
const dayOf=(at,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone:timeZone||'UTC'}).format(new Date(at));
export function valueSnapshot(records,{observedAt=new Date().toISOString(),source='build',revision=null}={}) {
  if(!Number.isFinite(Date.parse(observedAt)))throw Error('Invalid snapshot observation date.');
  const totals=emptyTotals(),comics=emptyTotals(),cards=emptyTotals(),identities=new Set(),fingerprints=[];
  for(const record of records){
    const id=record.id||`${record.provider||graderOf(record)||'CGC'}:${record.cert}`;
    if(identities.has(id))throw Error(`Duplicate copy in value history: ${id}`);identities.add(id);
    const value=effectiveValue(record),market=fmvValue(record)!==null,entry=market?record.fmv:record.manual;
    if(value!==null&&entry?.currency&&entry.currency!=='USD')throw Error(`Value for ${id} is not in USD.`);
    const date=value!==null?(market?record.fmv?.asOf||record.fmv?.fetchedAt:record.manual?.setAt)||null:null;
    const kind=record.kind==='card'?'card':'comic';
    fingerprints.push([id,kind,value,market?'market':'owner',date,market?record.fmv?.source||null:null]);
    for(const group of [totals,kind==='card'?cards:comics]){
      group.count++;if(value===null){group.unvalued++;continue;}
      group.valued++;group.total+=round(value);group[market?'marketTotal':'ownerTotal']+=round(value);if(!date)group.undated++;
    }
  }
  for(const group of [totals,comics,cards])for(const key of ['total','marketTotal','ownerTotal'])group[key]=round(group[key]);
  fingerprints.sort((a,b)=>a[0].localeCompare(b[0]));
  return {observedAt:new Date(observedAt).toISOString(),source,...(revision?{revision}:{}),fingerprint:createHash('sha256').update(JSON.stringify(fingerprints)).digest('hex'),...totals,comics,cards};
}
export async function readValueHistory(root) {
  try{const history=JSON.parse(await fs.readFile(historyPath(root),'utf8'));
    if(history.schemaVersion!==1||history.currency!=='USD'||!Array.isArray(history.snapshots))throw Error('Unsupported value history format.');
    for(const s of history.snapshots)if(!Number.isFinite(Date.parse(s.observedAt))||![s.total,s.count,s.valued,s.unvalued].every(Number.isFinite)||s.valued+s.unvalued!==s.count)throw Error('Invalid value history snapshot.');
    return history;
  }catch(error){if(error.code!=='ENOENT')throw error;return {schemaVersion:1,currency:'USD',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,snapshots:[]};}
}
export function appendSnapshot(history,snapshot) {
  const last=history.snapshots.at(-1);
  // Photos and repeated builds do not create spurious valuation changes.
  if(last?.fingerprint===snapshot.fingerprint&&dayOf(last.observedAt,history.timeZone)===dayOf(snapshot.observedAt,history.timeZone))return history;
  if(last&&Date.parse(snapshot.observedAt)<Date.parse(last.observedAt))throw Error('A new value observation cannot predate the latest snapshot.');
  return {...history,snapshots:[...history.snapshots,snapshot]};
}
async function writeHistory(root,history) {
  const target=historyPath(root),temp=target+'.'+randomUUID()+'.tmp';
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(temp,JSON.stringify(history,null,2)+'\n');await fs.rename(temp,target);
}
export async function captureValueHistory(root,records,options={}) {
  const history=await readValueHistory(root),current=valueSnapshot(records,options),updated=appendSnapshot(history,current);
  if(updated!==history)await writeHistory(root,updated);
  return {...updated,current};
}
/** Seed only complete saved repository states, never price-fetch dates. */
export async function seedGitValueHistory(root) {
  const existing=await readValueHistory(root);
  if(existing.snapshots.length)return {history:existing,added:0};
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024}).trim();
  const lines=git(['log','--reverse','--format=%H\t%cI','--','data/bins','data/cards','data/comics']).split('\n').filter(Boolean);
  const days=new Map();
  for(const line of lines){const [revision,at]=line.split('\t');if(!/^[a-f0-9]{40}$/.test(revision)||!Number.isFinite(Date.parse(at)))throw Error('Invalid inventory revision.');
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:existing.timeZone}).format(new Date(at));days.set(day,{revision,at});}
  let history=existing;
  for(const {revision,at} of [...days.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
    const files=git(['ls-tree','-r','--name-only',revision,'--','data/bins','data/cards','data/comics']).split('\n').filter(file=>/^data\/(bins|cards|comics)\/[\w-]+\.json$/.test(file));
    const records=files.flatMap(file=>{const data=JSON.parse(git(['show',`${revision}:${file}`]));return data.comics||data.cards||[];});
    if(records.length)history=appendSnapshot(history,valueSnapshot(records,{observedAt:at,source:'saved-inventory',revision}));
  }
  if(history.snapshots.length)await writeHistory(root,history);
  return {history,added:history.snapshots.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const root=process.cwd();
  if(process.argv.includes('--seed-git')){const result=await seedGitValueHistory(root);console.log(`Recovered ${result.added} dated inventory snapshots.`);}
  const collection=await readCollection(root),records=[...collection.bins,...collection.cards,...collection.comics].flatMap(({data})=>data.comics||data.cards||[]);
  const result=await captureValueHistory(root,records);
  console.log(`${result.current.valued}/${result.current.count} valued · $${result.current.total.toLocaleString('en-US')} recorded · ${result.snapshots.length} observations.`);
}
