/** Refresh only separate comparison values; preserve grader values, scans and identity. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { comparisonForTag, marketValuation } from './card-valuation.js';

export async function refreshTagValues(root = process.cwd()) {
  const directory = path.join(root, 'data/cards');
  let names;
  try { names = (await fs.readdir(directory)).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if (error.code === 'ENOENT') return { matched: [], pending: [], direct: [], changed: 0 }; throw error; }
  const boxes = await Promise.all(names.map(async name => ({ name, data: JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')) })));
  const psa = boxes.flatMap(box => box.data.cards || []).filter(card => card.grader === 'PSA');
  const report = { matched: [], pending: [], direct: [], changed: 0 };
  for (const box of boxes) {
    let changed = false;
    for (const card of box.data.cards || []) {
      if (card.grader !== 'TAG') continue;
      const comparison = comparisonForTag(card, psa);
      const before = JSON.stringify(card.psaComparison ?? null);
      if (comparison) card.psaComparison = comparison;
      else delete card.psaComparison;
      if (before !== JSON.stringify(card.psaComparison ?? null)) { changed = true; report.changed++; }
      const selected = marketValuation(card);
      if (selected?.source === 'psa-grade-comparison') report.matched.push({ cert: card.cert, subject: card.subject, grade: card.grade, value: selected.value, psaCert: selected.comparison.cert, url: selected.url });
      else if (selected || Number.isFinite(card.manual?.value)) report.direct.push(card.cert);
      else report.pending.push({ cert: card.cert, subject: card.subject, year: card.year, set: card.brand, cardNumber: card.cardNumber, variety: card.variety, requiredPsaGrade: card.grade, reason: 'No unambiguous same-card, same-grade PSA value in the imported records' });
    }
    if (changed) { const target = path.join(directory, box.name); await fs.writeFile(target + '.tmp', JSON.stringify(box.data, null, 2) + '\n'); await fs.rename(target + '.tmp', target); }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await refreshTagValues();
  await fs.mkdir('data/incoming', { recursive: true });
  await fs.writeFile('data/incoming/tag-value-comparison-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.matched.length} TAG values use PSA comparisons; ${report.direct.length} have direct values; ${report.pending.length} need a matching PSA value.`);
}
