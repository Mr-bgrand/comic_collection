/** Pure estimator. Observed IQR uses nearest-rank Q1/Q3, never interpolated sale prices. */
export function estimateSoldComps(target, entries) {
 const seen=new Set(),transactions=[];
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const equal=(a,b)=>a&&b&&JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const identity=target.identity;
 if(!identity||!(identity.title&&identity.issue!=null||identity.brand&&identity.subject&&identity.cardNumber))return {value:null,range:null,saleCount:0,status:'missing',transactions:[]};
 for(const e of entries){
  if(typeof e.transactionId!=='string'||!e.transactionId.trim()||seen.has(e.transactionId)||e.sold!==true||e.askingOnly===true||e.bestOffer===true&&e.acceptedPriceKnown!==true||e.currency!=='USD'||typeof e.value!=='number'||!Number.isFinite(e.value)||e.value<0||!equal(e.identity,target.identity)||String(e.grade??'')!==String(target.grade??'')||e.grader!==target.grader||JSON.stringify(e.condition??null)!==JSON.stringify(target.condition??null))continue;
  seen.add(e.transactionId);transactions.push(structuredClone(e));
 }
 const values=transactions.map(e=>e.value).sort((a,b)=>a-b),n=values.length;
 if(n<3)return {value:null,range:null,saleCount:n,status:n?'review':'missing',transactions};
 const value=n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2;
 const range=n<5?{low:values[0],high:values[n-1],method:'min-max'}:{low:values[Math.ceil(n*.25)-1],high:values[Math.ceil(n*.75)-1],method:'observed-iqr'};
 return {value,range,saleCount:n,status:'eligible',transactions};
}
