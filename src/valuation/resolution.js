import { marketValuation } from '../card-valuation.js';
import { selectedObservation,isRaw,assessedCondition,validateObservation,exactMatch } from './observations.js';
/** Full provenance for selected evidence or legacy direct/manual/TAG comparison. */
export function resolveValuation(record) {
 const o=selectedObservation(record);
 if(o)return {value:o.value,currency:o.currency,basis:o.basis,source:o.source.name,url:o.source.url,asOf:o.source.asOf,retrievedAt:o.source.retrievedAt,observationId:o.id,locked:!!record.valuation.selection.locked,provisional:false,legacy:false};
 if(record.valuation?.legacyInvalidatedAt)return null;
 if(isRaw(record)&&!assessedCondition(record))return null;
 const market=marketValuation(record);if(market)return {...market,basis:market.source==='psa-grade-comparison'?'psa-comparison':'guide',asOf:market.asOf||null,legacy:true};
 if(typeof record.manual?.value==='number'&&Number.isFinite(record.manual.value)&&record.manual.value>=0)return {...record.manual,basis:'owner',source:record.manual.source||'Owner estimate',asOf:record.manual.asOf||null,legacy:true};
 return null;
}
/** At most one current contextual reference per unvalued raw copy, never an accepted amount. */
export function provisionalReference(record) {
 if(!isRaw(record)||resolveValuation(record))return null;
 const candidates=(record.valuation?.observations||[]).filter(o=>{
  try{return o.basis==='raw-reference'&&o.reviewStatus!=='rejected'&&!!validateObservation(record,o)&&exactMatch(record,o);}catch{return false;}
 }).sort((a,b)=>b.source.retrievedAt.localeCompare(a.source.retrievedAt)||b.id.localeCompare(a.id));
 return candidates[0]??null;
}
