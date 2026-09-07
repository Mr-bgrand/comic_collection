import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseVaultRow,importVault} from './import-vault.js';
import {acceptedCardImage} from './card-images.js';
const row={'Cert Number':'0012345','Grade Issuer':'PSA',Grade:'10',Year:'2025',Set:'TOPPS',Subject:'TEST CARD','PSA Estimate':'-'};
test('vault identity preserves leading zeros; missing estimate is unknown and import is not a valuation date',()=>{
  const c=parseVaultRow(row,{importedAt:'2026-09-06T00:00:00Z'});assert.equal(c.cert,'0012345');assert.equal(c.fmv.value,null);assert.equal(c.fmv.asOf,null);
  assert.equal(parseVaultRow({...row,'PSA Estimate':'$1,234.50'}).fmv.value,1234.5);
  assert.throws(()=>parseVaultRow({...row,'PSA Estimate':'23oops'}));
});
test('only exact grader scan hosts and TAG plain sides are accepted',()=>{
  assert.equal(acceptedCardImage('PSA','https://d1htnxwo4o0jhw.cloudfront.net/cert/142480771/small/image.jpg','front'),true);
  for(const url of ['https://i.ebayimg.com/image.jpg','https://d1htnxwo4o0jhw.cloudfront.net.evil.test/cert/1/a.jpg','https://d1htnxwo4o0jhw.cloudfront.net/similar/image.jpg'])assert.equal(acceptedCardImage('PSA',url,'front'),false);
  assert.equal(acceptedCardImage('TAG','https://d39lwrz0lm7c9r.cloudfront.net/card-images/uuid_FRONT_MAIN.jpg','front'),true);
  for(const suffix of ['BACK_MAIN','FRONT_SFX','FRONT_SURFACE_DEFECT_1'])assert.equal(acceptedCardImage('TAG',`https://d39lwrz0lm7c9r.cloudfront.net/card-images/uuid_${suffix}.jpg`,'front'),false);
});
test('actual 49-row export imports once, preserves enrichment, and refuses cross-container duplicates',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'collection-vault-'));
  try{
    const source='data/incoming/My Collection CSV - 49.csv';const first=await importVault(source,{directory});assert.equal(first.added,49);assert.equal(first.estimated,45);
    const container=JSON.parse(await readFile(first.destination,'utf8'));assert.equal(container.virtual,true);container.cards[0].images.front='verified.jpg';container.cards[0].imageSources={front:{url:'https://example.test/retained'}};
    await writeFile(first.destination,JSON.stringify(container));const second=await importVault(source,{directory});assert.equal(second.added,0);assert.equal(second.updated,49);
    const again=JSON.parse(await readFile(first.destination,'utf8'));assert.equal(again.cards.length,49);assert.equal(again.cards[0].images.front,'verified.jpg');assert.deepEqual(again.cards[0].imageSources,container.cards[0].imageSources);
    await writeFile(path.join(directory,'box-01.json'),JSON.stringify({cards:[{cert:again.cards[0].cert,grader:'PSA'}]}));await assert.rejects(importVault(source,{directory}),/reconcile its location/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
