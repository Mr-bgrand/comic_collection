import {isDeepStrictEqual} from 'node:util';
import {copyId,identityOf,validateObservation,validDate,isRaw} from '../observations.js';
const review=reason=>({status:'review-required',reason});
function verified(record,m) {
 return m && typeof m.verifiedBy==='string' && m.verifiedBy.trim() && validDate(m.verifiedAt) && Date.parse(m.verifiedAt)<=Date.now() && isDeepStrictEqual(m.identity,identityOf(record)) && /^\d+$/.test(String(m.productId)) && m.productName && m.consoleName && m.category===(record.kind==='card'?'card':'comic');
}
export function priceChartingObservation(record,capture) {
 const {product,mapping:m}=capture;
 if(!verified(record,m))return review('Owner-reviewed exact catalog mapping required');
 if(String(product?.id)!==String(m.productId)||product['product-name']!==m.productName||product['console-name']!==m.consoleName)return review('Catalog identity changed');
 let url;try {url=new URL(m.url);}catch{return review('Official product URL required');}
 if(!['www.pricecharting.com','www.sportscardspro.com'].includes(url.hostname)||url.search||url.hash)return review('Official product URL required');
 const grader=capture.grader||record.grader||'CGC';
 if(isRaw(record)||(grader!==(record.grader||'CGC')&&!(record.grader==='TAG'&&grader==='PSA')))return review('Exact grader required; only TAG may use a PSA comparison');
 // Comic fields combine graders/labels; half grades are not rounded to another grade.
 if(m.category!=='card'||Number(record.grade)!==10)return review('Exact grade/grader field unsupported; capture reviewed sold evidence instead');
 let field;
 if (grader === 'CGC') {
  const label = String(record.labelType ?? '').trim().toLowerCase();
  if (!['', 'gem mint', 'pristine'].includes(label)) return review('Unsupported CGC label designation; exact guide field unavailable');
  field = label === 'pristine' ? 'condition-19-price' : 'condition-17-price';
 } else {
  field = grader === 'PSA' ? 'manual-only-price' : grader === 'TAG' ? 'condition-21-price' : null;
 }
 if(!field)return review('Unsupported grader');
 const cents=product[field];
 if(!Number.isInteger(cents)||cents<=0)return {status:'missing',reason:'No positive API guide value for exact grade'};
 const observation={id:capture.id,copyId:copyId(record),basis:grader==='PSA'&&record.grader==='TAG'?'psa-comparison':'guide',evidenceKind:'guide',value:cents/100,currency:'USD',source:{name:url.hostname.includes('sportscardspro')?'SportsCardsPro':'PriceCharting',url:m.url,asOf:capture.asOf,retrievedAt:capture.retrievedAt},match:{identity:identityOf(record),grade:record.grade,grader,condition:record.condition??null,status:'exact'},reviewStatus:'pending',providerMapping:structuredClone(m),catalog:{id:String(product.id),field,verifiedBy:m.verifiedBy,verifiedAt:m.verifiedAt}};
 return {status:'captured',observation:validateObservation(record,observation)};
}
export function createPriceChartingClient({env=process.env,provider='pricecharting',fetch:fetcher=globalThis.fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),clock=Date.now}={}) {
 if(!['pricecharting','sportscardspro'].includes(provider))throw Error('Unsupported API provider');
 const token=env[provider==='pricecharting'?'PRICECHARTING_API_TOKEN':'SPORTSCARDSPRO_API_TOKEN'];
 let last=-Infinity,tail=Promise.resolve();
 const request=(endpoint,params)=>{
  const job=tail.then(async()=>{
   if(!token)throw Error('Optional API token is not configured');
   for(let attempt=0;attempt<3;attempt++) {
    await sleep(Math.max(0,1000-(clock()-last)));last=clock();
    const url=new URL(`https://www.${provider}.com/api/${endpoint}`);url.search=new URLSearchParams({...params,t:token});
    let response;
    try {response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});}catch {throw Error('Provider request failed; credentials and request URL redacted');}
    if(response.status===429&&attempt<2) {
     const header=response.headers.get('retry-after');
     const delay=/^\d+(?:\.\d+)?$/.test(header||'')?Number(header)*1000:Math.max(0,Date.parse(header)-clock());
     if(Number.isFinite(delay)&&delay>60000)throw Error('Provider rate limited; retry later');
     await sleep(Number.isFinite(delay)?Math.max(1000,delay):1000);continue;
    }
    if(!response.ok)throw Error(`Provider HTTP ${response.status}; request details redacted`);
    let data;try {data=await response.json();}catch {throw Error('Invalid provider response');}
    if(data.status!=='success')throw Error('Provider did not return success; check API entitlement');
    return JSON.parse(JSON.stringify(data).replaceAll(token,'[redacted]'));
   }
  });tail=job.catch(()=>{});return job;
 };
 return {
  configured:Boolean(token),
  async search(query){const data=await request('products',{q:String(query)});return {status:'candidates',products:(data.products||[]).map(p=>({id:p.id,name:p['product-name'],category:p['console-name']}))};},
  async capture(record,mapping,{id,grader,asOf=null,retrievedAt=new Date().toISOString()}={}) {
   if(!verified(record,mapping))return review('Owner-reviewed exact catalog mapping required');
   let host;try{host=new URL(mapping.url).hostname;}catch{return review('Official product URL required');}
   if(host!=="www."+provider+".com")return review('Catalog belongs to another provider');
   const product=await request('product',{id:String(mapping.productId)});
   return priceChartingObservation(record,{product,mapping,id,grader,asOf,retrievedAt});
  }
 };
}
