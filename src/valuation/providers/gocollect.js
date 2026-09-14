import {isDeepStrictEqual} from 'node:util';
import {parseFmvCard} from '../../gocollect.js';
import {copyId,identityOf,validateObservation,validDate} from '../observations.js';
/** Saved visible-page capture with explicit owner review of edition and slab label. */
export function goCollectObservation(record,capture) {
 const text=String(capture.text||'');
 if(/log in|sign in/i.test(text)&&!text.includes('GoCollect FMV'))return {status:'login-required'};
 if(/not found|not listed|no results/i.test(text)&&!text.includes('GoCollect FMV'))return {status:'not-listed'};
 const reviewed=typeof capture.reviewedBy==='string'&&capture.reviewedBy.trim()&&validDate(capture.reviewedAt)&&Date.parse(capture.reviewedAt)<=Date.now();
 if(record.kind==='card'||!record.cert||String(capture.cert)!==String(record.cert)||capture.grader!=='CGC'||(record.grader||'CGC')!=='CGC'||Number(capture.grade)!==Number(record.grade)||!isDeepStrictEqual(capture.identity,identityOf(record))||capture.labelType!==(record.labelType??null)||!reviewed)return {status:'review-required',reason:'Reviewed matching cert, exact edition, grade and label required'};
 let url;try{url=new URL(capture.url);}catch{return {status:'review-required',reason:'GoCollect source URL required'};}
 if(!['gocollect.com','www.gocollect.com'].includes(url.hostname)||url.search||url.hash)return {status:'review-required',reason:'Official GoCollect product URL required'};
 if(!text.includes('GoCollect FMV'))return {status:'unknown',reason:'No visible guide result'};
 const fmv=parseFmvCard(text,capture.url,capture.retrievedAt);
 if(fmv.value===null)return {status:'no-sales'};
 const observation={id:capture.id,copyId:copyId(record),basis:'guide',value:fmv.value,currency:'USD',source:{name:'GoCollect',url:capture.url,asOf:capture.asOf,retrievedAt:capture.retrievedAt},match:{identity:identityOf(record),grade:record.grade,grader:'CGC',condition:record.condition??null,status:'exact'},reviewStatus:'pending',stats:{avg30:fmv.avg30,avg90:fmv.avg90,avg365:fmv.avg365,sold365:fmv.sold365},verification:{cert:capture.cert,reviewedBy:capture.reviewedBy,reviewedAt:capture.reviewedAt}};
 return {status:'captured',observation:validateObservation(record,observation)};
}
