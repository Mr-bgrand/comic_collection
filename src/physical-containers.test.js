import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalContainers,printContainer,containerUrl} from './physical-containers.js';
import {renderLabel} from './templates/label.js';
import {renderSheet} from './templates/sheet.js';
test('physical card and softslab cases are printable while external vaults stay separate',()=>{
 const cases=physicalContainers({bins:[{data:{bin:'01'}}],cards:[{data:{id:'case-01',physical:true,cards:[]}},{data:{id:'vault',virtual:true,physical:true}}],comics:[{data:{id:'comic-case-12',physical:true,comics:[]}}]});
 assert.equal(cases.length,3);const b=printContainer(cases[1].data);assert.equal(b.bin,'case-01');assert.deepEqual(b.comics,[]);
 assert.equal(containerUrl('https://example.test/collection/',b),'https://example.test/collection/review/?case=case-01');
});
test('111 softslabs paginate into four readable case labels and eight Letter sides',()=>{
 const comics=Array.from({length:111},(_,i)=>({title:'Harley Quinn',issue:String(i+1),provider:'Authority',providerId:String(i).padStart(10,'0'),grading:{status:'raw'},authentication:{label:'RAW Authentic'}}));
 const bin=printContainer({id:'comic-case-12',title:'Comic Case #12 (Softslabs)',physical:true,comics});
 const label=renderLabel({bin,qrSvg:'',url:'https://example.test/review/?case=comic-case-12'});
 assert.equal((label.match(/class="label-page"/g)||[]).length,4);assert.equal((label.match(/<li>/g)||[]).length,111);assert.doesNotMatch(label,/CGC graded/);assert.match(label,/85–111 of 111/);
 const sheet=renderSheet({bin,url:'https://example.test/review/?case=comic-case-12'});
 assert.equal((sheet.match(/class="side"/g)||[]).length,8);assert.equal((sheet.match(/class="entry"/g)||[]).length,111);assert.doesNotMatch(sheet,/graded comics|Bin comic-case-12/);
});
