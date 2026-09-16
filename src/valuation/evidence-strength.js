/** A star describes price evidence, never permission to relax the identity match. */
export function historyCaution(entry) {
  if (!entry) return null;
  if (entry.provisional === true && entry.provisionalReason) return entry.provisionalReason;
  if (entry.basis === 'owner') return 'Owner estimate; market sales history not established';
  const count = entry.saleCount ?? entry.stats?.sold365 ?? entry.sold365;
  if (!Number.isInteger(count) || count < 0) return 'Supporting sales history not documented';
  if (count < 5) return count === 0 ? 'No recent supporting sales recorded' : `Limited history: ${count} matching ${count === 1 ? 'sale' : 'sales'}`;
  return null;
}

export const ESTIMATE_NOTE = '* Estimate based on limited or undocumented sales history.';
