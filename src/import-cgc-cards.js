/** Import reviewed CGC Cards DOM captures, preserving copy identity and owner data. */
import { readFile, writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { acceptedCardImage, acceptedCardCertPage } from './card-images.js';

export function parseCgcCardCapture(entry, { sourceFile, importedAt } = {}) {
  const fields = Object.fromEntries(entry.pairs || []), cert = fields['Cert #'];
  if (typeof cert !== 'string' || !acceptedCardCertPage('CGC', entry.pageUrl, cert)) throw new Error('CGC card cert/page identity mismatch');
  for (const label of ['Card Name', 'Game', 'Year', 'Language', 'Card Set', 'Grade']) {
    if (typeof fields[label] !== 'string' || !fields[label].trim()) throw new Error(`CGC ${cert}: missing ${label}`);
  }
  const match = fields.Grade.match(/^(?:(.+) )?(10|[1-9](?:\.5)?)$/);
  if (!match) throw new Error(`CGC ${cert}: unsupported grade`);
  const grade = match[2], gradeDescription = match[1] || null;
  if (!entry.capturedAt || !Number.isFinite(Date.parse(entry.capturedAt))) throw new Error('Missing capture timestamp');
  if (fields['Grade Date'] && (!/^\d{4}-\d{2}-\d{2}$/.test(fields['Grade Date']) || new Date(fields['Grade Date']).toISOString().slice(0,10) !== fields['Grade Date'])) throw new Error('Invalid CGC grading date');
  // Scanless records are valid; malformed or mixed-copy scan evidence is not.
  const scans = entry.scans || [];
  const sides = new Set();
  for (const scan of scans) {
    const side = { Obverse: 'front', Reverse: 'back' }[scan.label];
    if (!side || sides.has(side) || !acceptedCardImage('CGC', scan.url, side, cert)) throw new Error('CGC requires cert-matching, labeled scan sides');
    sides.add(side);
  }
  if (scans.length === 2 && scans[0].url.replace(/_(OBV|REV)\.jpg$/, '') !== scans[1].url.replace(/_(OBV|REV)\.jpg$/, '')) throw new Error('CGC scans refer to different image IDs');
  let population = null;
  const census = (entry.population || []).filter(p => p.text.includes('In Higher Grades:'));
  if (census.length > 1) throw new Error('Ambiguous CGC population');
  if (census.length) {
    const p = census[0], m = p.text.match(/^Total Graded by CGC\s+In (.+) Grade: ([\d,]+)\s+In Higher Grades: ([\d,]+)$/);
    const url = new URL(p.url);
    if (!m || m[1] !== fields.Grade || url.origin !== 'https://www.cgccards.com' || !url.pathname.startsWith('/population-report/')) throw new Error('CGC population does not match reported grade');
    population = { atGrade: Number(m[2].replaceAll(',', '')), higher: Number(m[3].replaceAll(',', '')), asOf: entry.capturedAt.slice(0,10), source: 'CGC Cards', url: p.url };
  }
  const lookupGrade = new URL(entry.pageUrl).pathname.split('/').at(-2).replace('_', '.');
  if (entry.scanOrientation && (typeof entry.scanOrientation.reversed !== 'boolean' || !entry.scanOrientation.basis)) throw new Error('CGC scan orientation requires review evidence');
  return { kind: 'card', grader: 'CGC', cert, subject: fields['Card Name'], year: fields.Year, brand: fields['Card Set'], category: fields.Game,
    language: fields.Language, cardNumber: fields['Card Number'] || null, variety: [fields['Variant 1'], fields['Variant 2']].filter(Boolean).join(' · ') || null,
    grade, gradeDescription, gradeDate: fields['Grade Date'] || null, holder: 'slab', certUrl: entry.pageUrl, population, valuation: null,
    cgc: { gradeText: fields.Grade, lookupGrade, gradeChangedFromLookup: Number(lookupGrade) !== Number(grade), fields, sourceUrl: entry.pageUrl, capturedAt: entry.capturedAt,
      scanOrientation: entry.scanOrientation || { reversed: false, basis: 'CGC Cards viewer labels: Obverse / Reverse' }, ...(entry.slabLabel ? {slabLabel:entry.slabLabel} : {}) },
    images: {}, scanStatus: scans.length ? 'not-fetched' : 'no-scans-on-cert-page', importSource: { file: sourceFile, importedAt, capturedAt: entry.capturedAt, pageUrl: entry.pageUrl } };
}

export async function importCgcCards(file, { directory = 'data/cards', now = new Date().toISOString() } = {}) {
  if (!file) throw new Error('Usage: npm run cgc:cards -- data/incoming/cgc-card-captures.json');
  const capture = JSON.parse(await readFile(file, 'utf8')), container = capture.container;
  if (!container || !/^[a-z0-9-]{1,40}$/.test(container.id) || !container.title || !container.location || container.physical !== true || container.virtual !== false) throw new Error('CGC card import requires an owner-assigned physical container');
  const incoming = capture.records.map(entry => parseCgcCardCapture(entry, { sourceFile: file, importedAt: now }));
  const seen = new Set();
  for (const card of incoming) { if (seen.has(card.cert)) throw new Error(`Duplicate CGC cert: ${card.cert}`); seen.add(card.cert); }
  await mkdir(directory, { recursive: true });
  const filename = container.id + '.json'; let prior = { cards: [] };
  for (const name of (await readdir(directory)).filter(f => f.endsWith('.json'))) {
    const box = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    if (name === filename) { if (box.id !== container.id || box.virtual || box.physical === false) throw new Error('Container identity conflict'); prior = box; continue; }
    if (box.cards?.some(c => c.grader === 'CGC' && seen.has(c.cert))) throw new Error('CGC copy already exists in another container; reconcile location first');
  }
  const key = c => c.grader + ':' + c.cert, old = new Map(prior.cards.map(c => [key(c), c]));
  const cards = incoming.map(card => {
    const previous = old.get(key(card)); if (!previous) return card;
    const merged = { ...previous, ...card };
    for (const k of ['images', 'imageSources', 'scanStatus', 'location', 'valuation', 'fmv', 'manual', 'notes', 'acquisition']) if (Object.hasOwn(previous, k)) merged[k] = previous[k];
    merged.importSource.importedAt = previous.importSource?.importedAt || now;
    return merged;
  });
  cards.push(...prior.cards.filter(c => c.grader !== 'CGC' || !seen.has(c.cert)));
  const result = { ...container, ...prior, id: container.id, kind: 'card', physical: true, virtual: false, cards };
  const destination = path.join(directory, filename);
  await writeFile(destination + '.tmp', JSON.stringify(result, null, 2) + '\n'); await rename(destination + '.tmp', destination);
  return { destination, imported: incoming.length, added: incoming.filter(c => !old.has(key(c))).length, retained: cards.length - incoming.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) importCgcCards(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
