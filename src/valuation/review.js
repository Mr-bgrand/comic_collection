/** Owner-reviewed metadata changes are deliberately narrower than inventory edits. */
import {identityOf,identified,assessedCondition,isRaw,safeSourceUrl,validDate} from './observations.js';

const comicFields=['title','issue','issueYear','publisher','variant','upc','barcode','supplement','coverCode','volume','printing','edition','language'];
const cardFields=['year','brand','series','subject','cardNumber','variety','language','edition'];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const only=(value,fields)=>object(value)&&Object.keys(value).every(key=>fields.includes(key));
const text=value=>typeof value==='string'&&value.trim().length>0;

export function reviewMetadata(record,review,{now=new Date().toISOString()}={}) {
  if(!only(review,['identity','condition','evidence'])||!Object.hasOwn(review,'identity')&&!Object.hasOwn(review,'condition'))throw Error('Identity or condition review required');
  const evidence=review.evidence;
  if(!only(evidence,['url','notes','reviewedBy','reviewedAt'])||!safeSourceUrl(evidence.url)||!text(evidence.notes)||evidence.notes.length>4000||!text(evidence.reviewedBy)||evidence.reviewedBy.length>100||!validDate(evidence.reviewedAt)||!validDate(now)||Date.parse(evidence.reviewedAt)>Date.parse(now))throw Error('A source URL, review notes, reviewer and nonfuture review date are required');
  const next=structuredClone(record);
  if(Object.hasOwn(review,'identity')) {
    const fields=record.kind==='card'?cardFields:comicFields;
    if(!only(review.identity,fields)||!Object.keys(review.identity).length)throw Error('Unsupported identity field; copy IDs, grades, scans and locations cannot be edited here');
    for(const [key,value] of Object.entries(review.identity)) {
      if(!(typeof value==='string'||typeof value==='number'&&Number.isFinite(value))||String(value).length>300)throw Error('Identity fields must be short text or finite numbers');
      next[key]=typeof value==='string'?value.trim():value;
    }
    next.identification={...(next.identification||{}),status:identified(next)?'confirmed':'unidentified',reviewedAt:evidence.reviewedAt,sourceUrl:evidence.url};
  }
  if(Object.hasOwn(review,'condition')) {
    if(!isRaw(record)||typeof review.condition!=='string'||review.condition.length>300||!assessedCondition({condition:review.condition}))throw Error('An assessed raw condition band is required');
    next.condition=review.condition.trim();
  }
  const snapshot=r=>({identity:identityOf(r),condition:r.condition??null});
  const before=snapshot(record),after=snapshot(next);
  next.valuation={...(next.valuation||{}),metadataReviews:[...(next.valuation?.metadataReviews||[]),{before,after,evidence:structuredClone(evidence)}]};
  // Retain legacy fields for audit, but they no longer establish this edited identity/condition.
  if(JSON.stringify(before)!==JSON.stringify(after))next.valuation.legacyInvalidatedAt=now;
  return next;
}

export function rejectObservation(record,rejection,{now=new Date().toISOString()}={}) {
  if(!only(rejection,['observationId','reason'])||!text(rejection.reason)||rejection.reason.length>1000)throw Error('Observation ID and rejection reason required');
  const observation=record.valuation?.observations?.find(o=>o.id===rejection.observationId);
  if(!observation)throw Error('Unknown observation');
  if(observation.reviewStatus==='accepted')throw Error('Accepted evidence is retained for audit and cannot be dismissed');
  if(observation.reviewStatus==='rejected')return structuredClone(record);
  const next=structuredClone(record);
  next.valuation.observations.find(o=>o.id===observation.id).reviewStatus='rejected';
  next.valuation.reviews=[...(next.valuation.reviews||[]),{observationId:observation.id,status:'rejected',reason:rejection.reason.trim(),reviewedAt:now}];
  return next;
}
