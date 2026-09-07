import test from 'node:test';
import assert from 'node:assert/strict';
import {displayTitle,gradeLabel,certUrl} from './model.js';
test('graded cards use their real identity and issuer-specific cert links',()=>{
 const card={kind:'card',year:'2025',brand:'TOPPS',cardNumber:'1',subject:'SHOHEI OHTANI',variety:'BLUE',grader:'PSA',grade:'10',cert:'0012345'};
 assert.equal(displayTitle(card),'2025 TOPPS #1 SHOHEI OHTANI : BLUE');assert.equal(gradeLabel(card),'PSA 10');assert.equal(certUrl(card),'https://www.psacard.com/cert/0012345/psa');
 assert.equal(certUrl({...card,grader:'TAG',cert:'D1216494'}),'https://my.taggrading.com/card/D1216494');
 assert.equal(certUrl({...card,grader:'CGC',cert:'1401019289294',grade:'9'}),'https://www.cgccards.com/certlookup/1401019289294/9_0/');
 assert.equal(certUrl({...card,grader:'CGC',cert:'1401031230023',grade:'8.5'}),'https://www.cgccards.com/certlookup/1401031230023/8_5/');
 assert.equal(certUrl({...card,grader:'CGC',grade:null}),null);
 assert.equal(certUrl({...card,grader:'CGC',grade:'unverified'}),null);
 assert.equal(certUrl({grader:'CGC',cert:'4395549004',grade:'9.8'}),'https://www.cgccomics.com/certlookup/4395549004/');
});
