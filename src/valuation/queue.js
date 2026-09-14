import {copyId,identified,isRaw,assessedCondition,validDate} from './observations.js';
import {resolveValuation} from './resolution.js';
import {displayTitle} from '../model.js';
const special=/exclusive|virgin|metal|foil|signed|signature/i;
/** Normalized inputs: {record,container:{id,title},revision?}. Filters are ORed. */
export function buildQueue(records,{now=new Date().toISOString(),staleDays=90,filters=[]}={}) {
 if(!validDate(now)||!Number.isFinite(staleDays)||staleDays<0)throw new Error('Invalid queue date or stale days');
 const supported=['missing','stale','undated','review','condition','identity'];if(filters.some(f=>!supported.includes(f)))throw new Error('Unknown queue filter');
 const seen=new Set();
 return records.map(({record:r,container,revision})=>{
  const id=copyId(r);if(seen.has(id))throw new Error(`Duplicate copy ID: ${id}`);seen.add(id);
  const current=resolveValuation(r),flags=[],reasons=[];
  const flag=(name,reason)=>{flags.push(name);reasons.push(reason);};
  if(!current)flag('missing','No accepted or legacy effective value');
  if(current&&!validDate(current.asOf))flag('undated','Value has no source-as-of date');
  if(current&&validDate(current.asOf)&&(Date.parse(now)-Date.parse(current.asOf))/86400000>staleDays)flag('stale',`Source value is older than ${staleDays} days`);
  if(r.valuation?.observations?.some(o=>o.reviewStatus==='pending'))flag('review','Evidence awaits owner review');
  if(isRaw(r)&&!assessedCondition(r))flag('condition','Raw condition is unrecorded');
  if(!identified(r))flag('identity','Edition identity is unconfirmed');
  const grader=isRaw(r)?null:r.grader||'CGC', title=displayTitle(r);
  const query=[title,grader,r.grade].filter(Boolean).join(' ');
  const category=r.provider==='Authority'?'Authority':isRaw(r)&&!identified(r)?'raw':grader;
  const guideSource = grader === 'TAG' ? 'PSA same-grade comparison'
    : grader === 'CGC' && r.kind !== 'card' ? 'GoCollect' : 'market';
  const tagWorldExclusive = grader === 'TAG'
    && /\bTAG WORLD SCARIES\b/i.test([r.brand, r.series].filter(Boolean).join(' '));
  return {
    copyId: id, title, kind: r.kind || 'comic', grader, grade: r.grade ?? null,
    provider: r.provider ?? null, container: structuredClone(container ?? null),
    revision, current, flags, reasons,
    priority: flags.reduce((total, flag) => total + ({missing:100,identity:50,condition:40,review:30,stale:20,undated:10}[flag] || 0), 0),
    sourceQueries: [
      { source: guideSource, query: grader === 'TAG' ? [title, 'PSA', r.grade].filter(Boolean).join(' ') : query },
      { source: 'eBay sold', query }
    ],
    pilotCategory: category, legacyStatus: r.fmv?.status || 'new',
    special: tagWorldExclusive || special.test([r.variant,r.variety,r.labelCategory,r.keyComments].filter(Boolean).join(' ')),
    halfGrade: Number(r.grade) % 1 === .5,
    candidateIdentity: structuredClone(r.identification?.candidates ?? null)
  };
 }).filter(r=>!filters.length||filters.some(f=>r.flags.includes(f))).sort((a,b)=>b.priority-a.priority||a.copyId.localeCompare(b.copyId));
}
/** Distinct deterministic quotas. Prefer known owner research cases when present. */
export function selectPilot(queue) {
 const items=[],shortfalls={},quotas={CGC:10,TAG:10,Authority:5,raw:5};
 const preferred={TAG:['L3302729','E3314397','M9505930','U5165558','G7325430','C5407435','H1870819','R4092198','H9812622','S2994291'],Authority:['5356989824','7721743138','3297623591','6741967651','2896359526'],raw:['15-001','15-002','15-003','15-004','15-005']};
 for(const [group,quota] of Object.entries(quotas)){
  const pool = queue.filter(row => row.pilotCategory === group
    && (group !== 'CGC' || row.kind === 'comic' && row.flags.includes('missing')))
    .sort((a, b) => a.copyId.localeCompare(b.copyId));
  const selected = [];
  const take = row => {
    if (row && !selected.some(item => item.copyId === row.copyId) && selected.length < quota) {
      selected.push(row);
    }
  };
  const preferredRows = (preferred[group] || []).map(id =>
    pool.find(row => row.copyId === id || row.copyId.endsWith(':' + id))).filter(Boolean);
  // Preferences break ties within required coverage; they cannot consume its reserved slots.
  const ranked = [...preferredRows, ...pool.filter(row => !preferredRows.includes(row))];
  if (group === 'CGC') {
    for (const status of ['new', 'not-listed', 'no-sales']) take(ranked.find(row => row.legacyStatus === status));
    take(ranked.find(row => row.special));
  }
  if (group === 'TAG') {
    take(ranked.find(row => row.halfGrade));
    take(selected.find(row => row.special) || ranked.find(row => row.special));
  }
  ranked.forEach(take);
  items.push(...selected);
  if (selected.length < quota) shortfalls[group] = quota - selected.length;
 }
 return {items,quotas,shortfalls};
}
