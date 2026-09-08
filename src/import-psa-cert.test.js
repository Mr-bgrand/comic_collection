import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePsaCert} from './import-psa-cert.js';
const fixture=JSON.parse(readFileSync(new URL('../data/incoming/psa-office-wall-captures.json',import.meta.url))).records[0];
test('owner-held PSA cert imports carry dated estimates without asserting vault custody',()=>{
 const c=parsePsaCert(fixture);assert.equal(c.grade,'8');assert.equal(c.fmv.value,15);assert.equal(c.fmv.source,'psa-cert-page');assert.equal(c.fmv.asOf,'2026-09-07');assert.equal(c.vault,undefined);assert.equal(c.population.higher,974);
 assert.equal(parsePsaCert({...fixture,estimate:null}).fmv,null);
});
test('PSA cert metadata cannot use eBay photos, mismatched IDs or unlabeled prices',()=>{
 const bad=structuredClone(fixture);bad.scans[0].url='https://i.ebayimg.com/images/largest.jpg';assert.throws(()=>parsePsaCert(bad),/scans/);
 assert.throws(()=>parsePsaCert({...fixture,cert:'12345678'}),/mismatch/);
 assert.throws(()=>parsePsaCert({...fixture,estimate:{...fixture.estimate,label:'Asking price'}}),/estimate/);
 const mixed=structuredClone(fixture);mixed.scans[1].url=mixed.scans[1].url.replace('174948246','174948247');assert.throws(()=>parsePsaCert(mixed),/different internal IDs/);
});
test('missing PSA scans require a scrolled and repeated cert-page review',()=>{
 const c={...fixture,scans:[],scanStatus:'no-scans-on-cert-page'};
 assert.throws(()=>parsePsaCert(c),/scans/);
 assert.throws(()=>parsePsaCert({...c,scanReview:{scrolled:true,rechecked:false}}),/scans/);
 const parsed=parsePsaCert({...c,scanReview:{scrolled:true,rechecked:true}});
 assert.equal(parsed.scanStatus,'no-scans-on-cert-page');
 assert.equal(parsed.subject,fixture.fields.Subject);
 assert.deepEqual(parsed.images,{});
 assert.equal(parsed.scanCheckedAt,fixture.capturedAt);
});
test('PSA Variety/Pedigree is retained from the current certificate layout',()=>{
 const c={...fixture,fields:{...fixture.fields,'Variety/Pedigree':'CROWN ZENITH'}};
 assert.equal(parsePsaCert(c).variety,'CROWN ZENITH');
});
test('interrupted scan reviews retain verified identity without asserting no photos exist',()=>{
 const c={...fixture,scans:[],reviewStatus:'pending-scan-recheck'};
 assert.equal(parsePsaCert(c).scanStatus,'not-fetched');
 assert.equal(parsePsaCert(c).subject,fixture.fields.Subject);
 assert.throws(()=>parsePsaCert({...c,scanStatus:'no-scans-on-cert-page'}),/scans/);
});
