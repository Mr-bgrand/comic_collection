import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMetadata} from './review.js';
import {identityOf} from './observations.js';

test('reviewed signer metadata becomes part of the match and preserves the owned copy',()=>{
 const record={cert:'123',title:'Final Boss',issue:'1',grade:'9.8',labelCategory:'Signature Series',images:{front:'owned.jpg'}};
 const now='2026-09-15T12:00:00Z', evidence={url:'https://gocollect.com/app/comics/cert-lookup',notes:'Exact owned certificate identifies signer and signing date.',reviewedBy:'Owner-authorized research',reviewedAt:now};
 const signatures=[{name:'Tyler Kirkham',date:'2022-07-22',witnessed:true}];
 const updated=reviewMetadata(record,{identity:{signatures},evidence},{now});
 assert.deepEqual(identityOf(updated).signatures,signatures);assert.deepEqual(updated.images,record.images);assert.equal(updated.grade,record.grade);
 assert.equal(updated.valuation.metadataReviews[0].before.identity.signatures,'');
 for(const invalid of ['Tyler Kirkham',[{name:''}],[{name:'A',date:'tomorrow'}],[{name:'A',witnessed:'true'}],[{name:'A',grade:10}]])assert.throws(()=>reviewMetadata(record,{identity:{signatures:invalid},evidence},{now}),/signature/i);
});
