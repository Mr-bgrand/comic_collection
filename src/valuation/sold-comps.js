import { assessedCondition } from './observations.js';

const canonical = value => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    : value;
const equal = (a, b) => a && b && JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function hasRequiredCondition(target) {
  // Null grader and grade denote a raw comparison; both being absent is not an assessment.
  if (target.grader == null && target.grade == null) return assessedCondition(target);
  const grade = target.grade;
  const knownGrade = (typeof grade === 'number' || typeof grade === 'string')
    && String(grade).trim() !== '' && Number.isFinite(Number(grade))
    && Number(grade) > 0 && Number(grade) <= 10;
  const knownGrader = typeof target.grader === 'string' && target.grader.trim() !== ''
    && !/^(unknown|unassigned|raw|ungraded)$/i.test(target.grader.trim());
  return knownGrade && knownGrader;
}

/** Pure estimator. Observed IQR uses nearest-rank Q1/Q3, never interpolated sale prices. */
export function estimateSoldComps(target, entries) {
  const seen = new Set();
  const transactions = [];
  const identity = target.identity;
  if (!identity || !(identity.title && identity.issue != null || identity.brand && identity.subject && identity.cardNumber)) {
    return { value: null, range: null, saleCount: 0, status: 'missing', transactions: [] };
  }
  for (const entry of entries) {
    const incompatible = !equal(entry.identity, target.identity)
      || String(entry.grade ?? '') !== String(target.grade ?? '')
      || entry.grader !== target.grader
      || JSON.stringify(canonical(entry.condition ?? null)) !== JSON.stringify(canonical(target.condition ?? null));
    const unverifiedPrice = entry.sold !== true || entry.askingOnly === true
      || entry.bestOffer === true && entry.acceptedPriceKnown !== true
      || entry.currency !== 'USD' || typeof entry.value !== 'number'
      || !Number.isFinite(entry.value) || entry.value < 0;
    if (typeof entry.transactionId !== 'string' || !entry.transactionId.trim()
      || seen.has(entry.transactionId) || incompatible || unverifiedPrice) continue;
    seen.add(entry.transactionId);
    transactions.push(structuredClone(entry));
  }
  const values = transactions.map(entry => entry.value).sort((a, b) => a - b);
  const count = values.length;
  // Retain matching references for review, but absent grade/condition never establishes eligibility.
  if (count && !hasRequiredCondition(target)) {
    return { value: null, range: null, saleCount: count, status: 'review', transactions, provisional: true };
  }
  if (!count) return { value: null, range: null, saleCount: 0, status: 'missing', transactions };
  const value = count % 2 ? values[(count - 1) / 2] : (values[count / 2 - 1] + values[count / 2]) / 2;
  const range = count < 5
    ? { low: values[0], high: values[count - 1], method: 'min-max' }
    : { low: values[Math.ceil(count * .25) - 1], high: values[Math.ceil(count * .75) - 1], method: 'observed-iqr' };
  return { value, range, saleCount: count, status: count < 3 ? 'review' : 'eligible', transactions,
    ...(count < 3 ? {provisional:true,provisionalReason:`Limited history: ${count} matching completed ${count===1?'sale':'sales'}`} : {}) };
}
