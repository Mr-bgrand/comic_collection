import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { assemblePrintPack, isPrintPdf, PRINT_PACKS } from './print-packs.js';
import { renderCollectionMaster } from './templates/labPrint.js';

async function pages(count, size) {
  const doc = await PDFDocument.create();
  for (let i=0;i<count;i++) doc.addPage(size);
  return doc.save();
}
test('combined labels retain 4x6 geometry and page ranges without duplex blanks', async () => {
  const entries = [{id:'01',copies:23,bytes:await pages(1,[288,432])},{id:'case-03',copies:94,bytes:await pages(4,[288,432])}];
  const pack = await assemblePrintPack(entries);
  const pdf = await PDFDocument.load(pack.bytes);
  assert.equal(pdf.getPageCount(),5);
  assert.deepEqual(pack.ranges.map(r=>[r.firstPage,r.lastPage,r.blankPage]),[[1,1,null],[2,5,null]]);
  for(const page of pdf.getPages()) assert.deepEqual(page.getSize(),{width:288,height:432});
});
test('duplex masters start each case on a fresh physical sheet', async () => {
  const entries = [{id:'wall',bytes:await pages(1,[612,792])},{id:'case-02',bytes:await pages(5,[612,792])},{id:'bin-12',bytes:await pages(8,[612,792])}];
  const pack = await assemblePrintPack(entries,{duplex:true});
  const pdf = await PDFDocument.load(pack.bytes);
  assert.equal(pdf.getPageCount(),16);
  assert.deepEqual(pack.ranges.map(r=>[r.firstPage,r.lastPage,r.blankPage]),[[1,1,2],[3,7,8],[9,16,null]]);
  for(const page of pdf.getPages()) assert.deepEqual(page.getSize(),{width:612,height:792});
});
test('only named packs and per-container print PDFs are exposed', () => {
  for(const name of [...PRINT_PACKS,'bin-comic-bin-15-sheet.pdf']) assert.equal(isPrintPdf(name),true);
  for(const name of ['../all-case-labels-4x6.pdf','private.pdf','manifest.json','bin-01-sheet.pdf/../secret.pdf']) assert.equal(isPrintPdf(name),false);
});
test('master list identifies owner scans honestly and uses current physical case names', () => {
  const html = renderCollectionMaster({bins:[],cards:[],comics:[{data:{id:'comic-bin-15',title:'Desk favorites',location:'Office',physical:true,comics:[{id:'raw:15-001',kind:'comic',grading:{status:'raw'},grade:null,cert:null}]}}]});
  assert.match(html,/Owner scan raw:15-001/);assert.doesNotMatch(html,/CGC/);
  assert.match(html,/Desk favorites/);assert.match(html,/Office/);assert.match(html,/Not yet valued/);
});
