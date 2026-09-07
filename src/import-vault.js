/** Offline PSA Vault import. Preserve exact copies, unknown values, and enrichment on reimport. */
import {readFile,writeFile,readdir,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseCsv} from './import-prices.js';

const clean=v=>{const s=String(v??'').trim();return !s||s==='-'?null:s;};
export function vaultNumber(value) {
  const s=clean(value);if(s===null)return null;
  const normalized=s.replace(/[$,]/g,'');
  if(!/^\d+(?:\.\d+)?$/.test(normalized))throw new Error(`Invalid vault amount: ${s}`);
  return Number(normalized);
}
export function parseVaultRow(row,{importedAt,sourceFile}={}) {
  const cert=clean(row['Cert Number']),grader=clean(row['Grade Issuer'])?.toUpperCase();
  if(!cert||!/^\d+$/.test(cert)||grader!=='PSA')throw new Error('Vault rows require a PSA issuer and a numeric certification string');
  for(const field of ['Grade','Year','Set','Subject'])if(!clean(row[field]))throw new Error(`PSA ${cert}: missing ${field}`);
  const value=vaultNumber(row['PSA Estimate']);
  return {
    kind:'card',cert,grader,grade:clean(row.Grade),year:clean(row.Year),brand:clean(row.Set),subject:clean(row.Subject),
    cardNumber:clean(row['Card Number']),variety:clean(row.Variety),serial:clean(row.Serial),category:clean(row.Category),
    certUrl:`https://www.psacard.com/cert/${cert}/psa`,
    fmv:{value,source:'psa-vault-export',currency:'USD',asOf:null,importedAt,url:`https://www.psacard.com/cert/${cert}/psa`,status:value===null?'not-provided':'recorded'},
    vault:{itemStatus:clean(row['Item Status']),status:clean(row['Vault Status']),vaultedDate:clean(row['Vaulted Date']),daysVaulted:clean(row['Days Vaulted']),inLatestExport:true},
    acquisition:{cost:vaultNumber(row['My Cost']),date:clean(row['Date Acquired']),source:clean(row.Source),notes:clean(row['My Notes'])},
    importSource:{file:sourceFile,importedAt},images:{},scanStatus:'not-fetched',
  };
}
export async function importVault(csvPath,{directory='data/cards',now=new Date().toISOString()}={}) {
  if(!csvPath)throw new Error('Usage: npm run vault -- "data/incoming/My Collection CSV - 49.csv"');
  const input=await readFile(csvPath,'utf8'),rows=parseCsv(input.replace(/^\uFEFF/,''));
  if(!rows.length)throw new Error('The vault export has no rows');
  const sourceFile=path.basename(csvPath),incoming=rows.map(row=>parseVaultRow(row,{importedAt:now,sourceFile}));
  const seen=new Set();for(const c of incoming){if(seen.has(c.cert))throw new Error(`Duplicate PSA cert in export: ${c.cert}`);seen.add(c.cert);}
  await mkdir(directory,{recursive:true});
  let prior={cards:[]};
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.json'))) {
    const container=JSON.parse(await readFile(path.join(directory,file),'utf8'));
    if(file==='psa-vault.json'){prior=container;continue;}
    const conflict=(container.cards||[]).find(c=>c.grader==='PSA'&&seen.has(c.cert));
    if(conflict)throw new Error(`PSA ${conflict.cert} already belongs to ${file}; reconcile its location before importing`);
  }
  const old=new Map((prior.cards||[]).map(c=>[c.grader+':'+c.cert,c]));
  const cards=incoming.map(c=>{
    const previous=old.get(c.grader+':'+c.cert);if(!previous)return c;
    return {...previous,...c,images:previous.images||{},scanStatus:previous.scanStatus||'not-fetched',
      ...(previous.imageSources?{imageSources:previous.imageSources}:{}),
      // Keep a separately captured current cert-page estimate; CSV estimates retain their own date/basis.
      ...(previous.fmv?.source==='psa-cert-page'?{fmv:previous.fmv,vaultEstimate:c.fmv}:{})};
  });
  for(const c of prior.cards||[])if(!seen.has(c.cert)||c.grader!=='PSA')cards.push({...c,vault:{...c.vault,inLatestExport:false}});
  const result={...prior,id:'psa-vault',kind:'card',title:'PSA Vault',virtual:true,location:'Stored at PSA',
    importSource:{file:sourceFile,sha256:createHash('sha256').update(input).digest('hex'),importedAt:now,rows:rows.length},cards};
  const destination=path.join(directory,'psa-vault.json'),temporary=destination+'.tmp';
  await writeFile(temporary,JSON.stringify(result,null,2)+'\n');await rename(temporary,destination);
  const added=incoming.filter(c=>!old.has(c.grader+':'+c.cert)).length;
  return {destination,imported:incoming.length,added,updated:incoming.length-added,retained:cards.length-incoming.length,estimated:incoming.filter(c=>c.fmv.value!==null).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)importVault(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
