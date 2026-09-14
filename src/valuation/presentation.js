import {resolveValuation,provisionalReference} from './resolution.js';
import {buildQueue} from './queue.js';
import {marketValueLabel} from '../card-valuation.js';

export const valuationMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
const label=(record,current)=>current.basis==='owner'?'Owner estimate'+(current.source&&current.source!=='Owner estimate'?' · '+current.source:''):marketValueLabel(record)||current.source;
export function publicValuation(record,options={}) {
 const current=resolveValuation(record),reference=provisionalReference(record);
 return {value:current?.value??null,source:current?label(record,current):null,date:current?.asOf?.slice(0,10)||null,evidence:current?.url||null,basis:current?.basis??null,
  valuationFlags:buildQueue([{record}],options)[0].flags,
  provisional:reference?{value:reference.value,source:reference.source.name,date:reference.source.asOf,url:reference.source.url,basis:'raw-reference'}:null};
}
export function valuationSourceText(record) {
 const current=resolveValuation(record);
 return current?[label(record,current),current.asOf?'Source as of '+current.asOf.slice(0,10):'Source undated'].join(' · '):'';
}
