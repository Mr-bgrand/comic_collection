import test from 'node:test';
import assert from 'node:assert/strict';
import {identityOf} from '../observations.js';
import {priceChartingObservation,createPriceChartingClient} from './pricecharting.js';
import {goCollectObservation} from './gocollect.js';
const now='2026-09-13T12:00:00Z';
const card={id:'TAG:a',kind:'card',grader:'TAG',grade:'10',year:2023,brand:'Pokemon',subject:'Pikachu',cardNumber:'1'};
const product={id:'123','product-name':'Pikachu #1','console-name':'Pokemon Test','manual-only-price':12345,'graded-price':500,'condition-21-price':22222,'condition-17-price':33333,'condition-19-price':44444};
function mapping(r=card){return {verifiedBy:'Owner',verifiedAt:now,identity:identityOf(r),productId:'123',productName:'Pikachu #1',consoleName:'Pokemon Test',category:'card',url:'https://www.pricecharting.com/game/pokemon-test/pikachu-1'};}
test('card provider exact fields use cents and preserve PSA fallback provenance',()=>{
 for(const [grader,labelType,value] of [['TAG',undefined,222.22],['PSA',undefined,123.45],['CGC',undefined,333.33],['CGC','Pristine',444.44]]) {
  const r={...card,grader,labelType};const result=priceChartingObservation(r,{id:'x',product,mapping:mapping(r),retrievedAt:now,asOf:null});
  assert.equal(result.observation?.value,value);assert.equal(result.observation?.match.grader,grader);
 }
 const r=priceChartingObservation(card,{id:'x',product,mapping:mapping(),grader:'PSA',retrievedAt:now,asOf:null});assert.equal(r.observation?.basis,'psa-comparison');assert.equal(r.observation?.value,123.45);
});
test('unsupported half grades, changed catalogs and unreviewed mappings never produce exact values',()=>{
 const r={...card,grade:'8.5'};
 assert.equal(priceChartingObservation(r,{product,mapping:mapping(r)}).status,'review-required');
 assert.equal(priceChartingObservation(card,{product:{...product,'product-name':'Other'},mapping:mapping()}).status,'review-required');
 assert.equal(priceChartingObservation(card,{product,mapping:{...mapping(),verifiedBy:''}}).status,'review-required');
 const comic={id:'CGC:1',title:'Venom',issue:'1',grade:'9.8'};
 assert.equal(priceChartingObservation(comic,{product,mapping:{...mapping(comic),category:'comic'}}).status,'review-required');
});
test('API serializes requests, bounds 429 retries and redacts transport errors',async()=>{
 let clock=0;const starts=[];let count=0;
 const client=createPriceChartingClient({env:{PRICECHARTING_API_TOKEN:'secret'},clock:()=>clock,sleep:async ms=>{clock+=ms;},fetch:async url=>{starts.push(clock);assert.equal(new URL(url).searchParams.get('t'),'secret');count++;return count===1?new Response('',{status:429,headers:{'Retry-After':'2'}}):Response.json({status:'success',products:[product]});}});
 const results=await Promise.all([client.search('Pikachu'),client.search('Pikachu')]);
 assert.equal(results[0].status,'candidates');assert.equal(results[0].products.length,1);assert.ok(starts[1]-starts[0]>=2000);assert.ok(starts[2]-starts[1]>=1000);
 const bad=createPriceChartingClient({env:{PRICECHARTING_API_TOKEN:'secret'},fetch:async()=>{throw Error('https://host/?t=secret');}});
 await assert.rejects(bad.search('x'),e=>!e.message.includes('secret'));
 const missing=createPriceChartingClient({env:{}});await assert.rejects(missing.search('x'),/configured/i);
});
test('GoCollect requires reviewed cert edition grade label and retains guide stats separately',()=>{
 const r={id:'CGC:123',cert:'123',title:'Venom',issue:'1',grade:'9.8',labelType:'Universal'};
 const capture={id:'gc',text:'Venom #1\nGoCollect FMV\n$60\n30 Day Avg\n--\n90 Day Avg\n--\n365 Day Avg\n$60\n(1 Sold)',url:'https://gocollect.com/app/comic/venom-1',cert:'123',grade:'9.8',grader:'CGC',labelType:'Universal',identity:identityOf(r),reviewedBy:'Owner',reviewedAt:now,retrievedAt:now,asOf:null};
 const result=goCollectObservation(r,capture);assert.equal(result.observation?.value,60);assert.equal(result.observation?.stats.sold365,1);assert.equal(result.observation?.saleCount,undefined);
 assert.equal(goCollectObservation(r,{...capture,cert:'999'}).status,'review-required');
 assert.equal(goCollectObservation(r,{...capture,reviewedBy:undefined}).status,'review-required');
 assert.equal(goCollectObservation(r,{...capture,text:'Log in to continue'}).status,'login-required');
 assert.equal(goCollectObservation(r,{...capture,text:capture.text.replaceAll('$60','--')}).status,'no-sales');
});

test('API refuses unverified mapping before requests and terminates persistent rate limiting',async()=>{
 let requests=0;const client=createPriceChartingClient({env:{PRICECHARTING_API_TOKEN:'secret'},sleep:async()=>{},fetch:async()=>{requests++;return new Response('',{status:429});}});
 assert.equal((await client.capture(card,{...mapping(),verifiedBy:null})).status,'review-required');assert.equal(requests,0);
 await assert.rejects(client.search('x'),/429/);assert.equal(requests,3);
});

test('captured guide retains reviewed mapping for safe future refresh and denies cross-provider catalog reuse',async()=>{
 const captured=priceChartingObservation(card,{id:'x',product,mapping:mapping(),retrievedAt:now,asOf:null});assert.deepEqual(captured.observation.providerMapping,mapping());
 let requests=0;const client=createPriceChartingClient({env:{SPORTSCARDSPRO_API_TOKEN:'secret'},provider:'sportscardspro',fetch:async()=>{requests++;return Response.json({...product,status:'success'});}});
 assert.equal((await client.capture(card,mapping(),{id:'x'})).status,'review-required');assert.equal(requests,0);
});

test('provider does not claim exact grader match for a different grader or a raw record',()=>{
 const record={...card,grader:'PSA'};
 assert.equal(priceChartingObservation(record,{id:'x',asOf:null,retrievedAt:now,product,mapping:mapping(record),grader:'TAG'}).status,'review-required');
 const raw={...card,grading:{status:'raw'}};
 assert.equal(priceChartingObservation(raw,{id:'x',asOf:null,retrievedAt:now,product,mapping:mapping(raw)}).status,'review-required');
});
