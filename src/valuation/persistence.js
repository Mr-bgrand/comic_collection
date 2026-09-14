import {readFile,writeFile,mkdir,rename,unlink,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readCollection,revisionOf} from '../lab-admin.js';
import {copyId,addObservation,acceptObservation} from './observations.js';
import {reviewMetadata,rejectObservation} from './review.js';
/** Flatten real stored copies with container context and optimistic file revision. No filename is exposed. */
export function collectionRecords(collection) {
 return [...collection.bins,...collection.cards,...collection.comics].flatMap(({data,revision})=>(data.comics||data.cards||[]).map(record=>({record:structuredClone(record),copyId:copyId(record),container:{id:data.id||data.bin,title:data.title||`Bin ${data.bin??data.id}`},revision})));
}
export async function loadValuations(root=process.cwd()){return collectionRecords(await readCollection(root));}
/** Batch [{copyId,revision,observations?:[],accept?:{observationId,locked?,automatic?}}].
 * Validate everything before writing. Source files come solely from readCollection.
 * Revisions are SHA256 of original file bytes. Replace each file atomically and keep originals.
 */
export async function applyValuationBatch(root,batch,options={}) {
 if(!Array.isArray(batch))throw new Error('Valuation batch must be an array');
 const lockfile=path.join(root,'data','.valuation-write.lock');let lock;
 try{lock=await open(lockfile,'wx');}catch(error){if(error.code==='EEXIST')throw new Error('Another valuation write is active');throw error;}
 const staged=[],committed=[];
 try{
  const collection=await readCollection(root),files=[...collection.bins,...collection.cards,...collection.comics],copies=new Map();
  for(const file of files){file.next=structuredClone(file.data);for(const record of file.next.comics||file.next.cards||[]){const id=copyId(record);if(copies.has(id))throw new Error(`Duplicate stored copy ID ${id}`);copies.set(id,{file,record});}}
  for(const edit of batch){
   if(!edit||Object.keys(edit).some(k=>!['copyId','revision','observations','accept','review','reject'].includes(k)))throw new Error('Unsupported batch field; paths are not accepted');
   const found=copies.get(edit.copyId);if(!found)throw new Error(`Unknown copy ID ${edit.copyId}`);
   const {file}=found;if(edit.revision!==file.revision)throw new Error('Revision conflict: collection changed');
   if(edit.observations!==undefined&&!Array.isArray(edit.observations))throw new Error('Observations must be an array');
   let record=found.record;
   if(edit.review)record=reviewMetadata(record,edit.review,options);
   for(const observation of edit.observations||[])record=addObservation(record,observation,options);
   if(edit.reject)record=rejectObservation(record,edit.reject,options);
   if(edit.accept){if(typeof edit.accept.observationId!=='string')throw new Error('Acceptance observation ID required');record=acceptObservation(record,edit.accept.observationId,{...options,...edit.accept});}
   const list=file.next.comics||file.next.cards;list[list.indexOf(found.record)]=record;found.record=record;
  }
  const changed=files.filter(f=>JSON.stringify(f.next)!==JSON.stringify(f.data));
  const backupDir=path.join(root,'data/backups/valuation');if(changed.length)await mkdir(backupDir,{recursive:true});
  for(const file of changed){
   const backup=path.join(backupDir,`${revisionOf(path.relative(root,file.filename)).slice(0,12)}-${file.revision}.json`);
   try{await writeFile(backup,file.raw,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
   const temp=file.filename+`.${randomUUID()}.tmp`,raw=JSON.stringify(file.next,null,2)+'\n';await writeFile(temp,raw,{flag:'wx'});staged.push({...file,temp,output:raw});
  }
  // Check all revisions after staging, before replacing any inventory file.
  for(const file of staged)if(revisionOf(await readFile(file.filename,'utf8'))!==file.revision)throw new Error('Revision conflict: collection changed during save');
  for(const file of staged){await rename(file.temp,file.filename);committed.push(file);}
  return {changed:staged.length,records:batch.map(e=>({copyId:e.copyId,revision:revisionOf(staged.find(f=>f.filename===copies.get(e.copyId).file.filename)?.output||copies.get(e.copyId).file.raw)}))};
 }catch(error){
  // Best-effort rollback for I/O failure, preserving a concurrent outsider's write.
  for(const file of committed.reverse()){if(revisionOf(await readFile(file.filename,'utf8'))===revisionOf(file.output)){const temp=file.filename+`.${randomUUID()}.tmp`;await writeFile(temp,file.raw);await rename(temp,file.filename);}}
  throw error;
 }finally{
  for(const file of staged)await unlink(file.temp).catch(e=>{if(e.code!=='ENOENT')throw e;});
  await lock.close();await unlink(lockfile);
 }
}
