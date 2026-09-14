import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {loadValuations,applyValuationBatch} from './valuation/persistence.js';
import {addObservation} from './valuation/observations.js';
import {buildQueue,selectPilot} from './valuation/queue.js';
import {goCollectObservation} from './valuation/providers/gocollect.js';
import {priceChartingObservation,createPriceChartingClient} from './valuation/providers/pricecharting.js';
const defaultClients=new Map();
export function providerStatus(env=process.env) {
 return {gocollect:{mode:'saved-visible-capture',configured:true},pricecharting:{mode:'optional-official-api',configured:Boolean(env.PRICECHARTING_API_TOKEN)},sportscardspro:{mode:'optional-official-api',configured:Boolean(env.SPORTSCARDSPRO_API_TOKEN)},json:{mode:'import-and-explicit-accept',configured:true}};
}
export async function valuationReport(root,{pilot=false,...options}={}) {
 const queue=buildQueue(await loadValuations(root),options);
 return {status:'queued',retrievedValues:0,providers:providerStatus(),...(pilot?selectPilot(queue):{items:queue})};
}
export async function importValuationDocument(root,document,{dryRun=false}={}) {
 if(document?.schemaVersion!==1||!Array.isArray(document.edits))throw Error('Expected schemaVersion 1 and edits array');
 const rows=await loadValuations(root),byId=new Map(rows.map(r=>[r.copyId,r]));
 const edits=[],seen=new Set();
 for(const edit of document.edits) {
  if(!edit||Object.keys(edit).some(k=>!['copyId','revision','observations'].includes(k)))throw Error('Import accepts only copyId, revision, observations; accept is a separate action');
  if(seen.has(edit.copyId))throw Error('Duplicate copy ID');seen.add(edit.copyId);
  const row=byId.get(edit.copyId);if(!row)throw Error('Unknown copy ID');
  if(typeof edit.revision!=='string'||!Array.isArray(edit.observations)||!edit.observations.length)throw Error('Revision and nonempty observations required');
  let next=row.record;for(const observation of edit.observations)next=addObservation(next,observation);
  // A byte-equivalent replay is safe even with its original revision. Any new evidence requires current revision.
  if(isDeepStrictEqual(next,row.record))continue;
  if(edit.revision!==row.revision)throw Error('Stale revision; collection changed');
  edits.push(edit);
 }
 if(dryRun)return {status:'reviewed',copies:edits.length,changed:0};
 if(!edits.length)return {status:'imported',changed:0,records:[]};
 return {status:'imported',...await applyValuationBatch(root,edits)};
}
export async function acceptValuation(root,copyId,observationId,{revision}={}) {
 if(!revision)throw Error('Current revision required for acceptance');
 return applyValuationBatch(root,[{copyId,revision,observations:[],accept:{observationId,locked:true}}]);
}
export async function captureValuation(root,input,{persist=false,client}={}) {
 const row=(await loadValuations(root)).find(r=>r.copyId===input.copyId);
 if(!row)throw Error('Unknown copy ID');
 if(input.revision!==row.revision)throw Error('Stale revision; collection changed');
 let result;
 if(input.provider==='gocollect')result=goCollectObservation(row.record,input.capture);
 else if(['pricecharting','sportscardspro'].includes(input.provider))result=priceChartingObservation(row.record,input.capture);
 else if(['pricecharting-api','sportscardspro-api'].includes(input.provider)) {
  const provider=input.provider.replace('-api','');
  if(!client&&!defaultClients.has(provider))defaultClients.set(provider,createPriceChartingClient({provider}));
  const api=client||defaultClients.get(provider);
  result=await api.capture(row.record,input.capture.mapping,input.capture);
 } else throw Error('Unsupported capture provider');
 if(!result.observation)return result;
 const document={schemaVersion:1,edits:[{copyId:row.copyId,revision:row.revision,observations:[result.observation]}]};
 if(persist)return {...result,persistence:await importValuationDocument(root,document)};
 return {...result,document};
}
const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));
export async function runValues(args,{root=process.cwd()}={}) {
 const [command,...rest]=args;
 if(['queue','pilot'].includes(command)) {
  const result=await valuationReport(root,{pilot:command==='pilot',filters:rest.filter(x=>!x.startsWith('--'))});
  const directory=path.join(root,'data/valuation');await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,`${command}.json`),JSON.stringify(result,null,2)+'\n');return result;
 }
 if(command==='status')return providerStatus();
 if(command==='import')return importValuationDocument(root,await readJson(path.resolve(root,rest[0])),{dryRun:rest.includes('--dry-run')});
 if(command==='accept') {
  const row=(await loadValuations(root)).find(r=>r.copyId===rest[0]);if(!row)throw Error('Unknown copy ID');
  return acceptValuation(root,rest[0],rest[1],{revision:row.revision});
 }
 if(command==='capture')return captureValuation(root,await readJson(path.resolve(root,rest[0])),{persist:rest.includes('--import')});
 if(command==='search')return createPriceChartingClient({provider:rest[0]}).search(rest.slice(1).join(' '));
 throw Error('Usage: npm run values -- queue|pilot [missing stale undated review] | status | import <json> [--dry-run] | accept <copy-id> <observation-id> | capture <json> [--import] | search <pricecharting|sportscardspro> <query>');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 runValues(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
