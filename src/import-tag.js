/** Import reviewed rendered TAG captures. No encrypted API or guessed image IDs. */
import { readFile, writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { acceptedCardImage } from './card-images.js';

function sourceDate(value) {
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error('Expected TAG month/day/year date');
  const [, month, day, year] = match;
  const result = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (new Date(result).toISOString().slice(0, 10) !== result) throw new Error('Invalid TAG date');
  return result;
}

export function parseTagCapture(entry, { sourceFile, importedAt } = {}) {
  const cert = entry.cert;
  if (!/^[A-Z]\d{7}$/.test(cert) || entry.renderedCert !== cert || entry.pageUrl !== `https://my.taggrading.com/card/${cert}`) throw new Error('TAG cert/page identity mismatch');
  const [subject, productLine, setName, variety] = entry.identity || [];
  const product = productLine?.match(/^(\d{4}) (.+) #([\w/.-]+)$/);
  if (!subject || !product || [setName, variety].some(v => v != null && typeof v !== 'string')) throw new Error(`TAG ${cert}: incomplete card identity`);
  const [grade, gradeDescription] = entry.grade || [];
  if (!/^(?:10|[1-9](?:\.5)?)$/.test(grade) || !gradeDescription) throw new Error(`TAG ${cert}: missing grade`);
  if (entry.score != null && (!Number.isInteger(entry.score) || entry.score < 1 || entry.score > 1000 || entry.scoreLabel !== 'TAG SCORE')) throw new Error('TAG score requires an explicitly labeled 1–1000 score');
  if (entry.scans?.length !== 2 || new Set(entry.scans.map(s => s.side)).size !== 2 || entry.scans.some(s => !acceptedCardImage('TAG', s.url, s.side))) throw new Error('TAG requires verified front/back MAIN scans');
  const imageIds = entry.scans.map(s => new URL(s.url).pathname.replace(/_(FRONT|BACK)_MAIN\.[a-z]+$/i, ''));
  if (imageIds[0] !== imageIds[1]) throw new Error('TAG front/back refer to different image IDs');
  const { atGrade, total, asOf } = entry.population || {};
  if (![atGrade, total].every(n => Number.isInteger(n) && n >= 0) || atGrade > total) throw new Error('Invalid TAG population counts');
  const ratios = Object.values(entry.centering || {});
  if (ratios.length !== 2 || ratios.some(value => { const m = value.match(/^(\d+)L\/(\d+)R (\d+)T\/(\d+)B$/);return !m || +m[1] + +m[2] !== 100 || +m[3] + +m[4] !== 100; })) throw new Error('Invalid TAG centering ratios');
  const pokemon = /POKÉMON/.test(product[2]);
  return { kind: 'card', cert, grader: 'TAG', grade, gradeDescription, year: product[1], brand: pokemon ? setName || product[2] : product[2], series: product[2],
    subject, displaySubject: subject.match(/[A-Z][A-Z0-9' &.-]+$/)?.[0] || subject, cardNumber: product[3], variety: (pokemon ? variety : [setName,variety].filter(Boolean).join(' · ')) || null, language: /JAPANESE/.test(product[2]) ? 'Japanese' : null,
    category: /POKÉMON/.test(product[2]) ? 'Pokémon' : null, holder: 'slab', certUrl: entry.pageUrl,
    gradeDate: sourceDate(entry.chronology.graded), location: null, valuation: null,
    population: { atGrade, total, higher: null, asOf: sourceDate(asOf), source: 'TAG', url: entry.pageUrl },
    tag: { score: entry.score ?? null, scoreStatus: entry.score != null ? 'reported' : 'not-exposed', rank: entry.rank, chronology: entry.chronology, dings: entry.dings,
      centering: entry.centering, dimensions: entry.dimensions, identityLines: entry.identity, sourceUrl: entry.pageUrl, capturedAt: entry.capturedAt },
    images: {}, scanStatus: 'not-fetched', importSource: { file: sourceFile, importedAt, capturedAt: entry.capturedAt, pageUrl: entry.pageUrl } };
}

export async function importTag(file, { directory = 'data/cards', now = new Date().toISOString() } = {}) {
  if (!file) throw new Error('Usage: npm run tag -- data/incoming/tag-card-captures.json');
  const capture = JSON.parse(await readFile(file, 'utf8'));
  const container = capture.container;
  if (container && (!/^[a-z0-9-]{1,40}$/.test(container.id) || !container.title || !container.location || container.physical !== true || container.virtual !== false)) throw new Error('TAG case import requires an owner-assigned physical container');
  const containerId = container?.id || 'tag-collection', targetName = containerId + '.json';
  const incoming = capture.records.map(entry => parseTagCapture(entry, { sourceFile: file, importedAt: now }));
  const seen = new Set();for (const card of incoming) { if (seen.has(card.cert)) throw new Error(`Duplicate TAG cert: ${card.cert}`);seen.add(card.cert); }
  await mkdir(directory, { recursive: true });
  let prior = { cards: [] };
  for (const filename of (await readdir(directory)).filter(f => f.endsWith('.json'))) {
    const box = JSON.parse(await readFile(path.join(directory, filename), 'utf8'));
    if (filename === targetName) {
      if (box.id && box.id !== containerId || container && (box.virtual || box.physical === false)) throw new Error('Container identity conflict');
      prior = box;continue;
    }
    if (box.cards?.some(c => c.grader === 'TAG' && seen.has(c.cert))) throw new Error('TAG copy already exists in another container; reconcile location first');
  }
  const key = c => c.grader + ':' + c.cert, old = new Map(prior.cards.map(c => [key(c), c]));
  const cards = incoming.map(card => {
    const previous = old.get(key(card));if (!previous) return card;
    const merged = { ...previous, ...card };
    for (const key of ['images', 'imageSources', 'scanStatus', 'location', 'valuation', 'fmv', 'manual', 'notes', 'acquisition']) if (Object.hasOwn(previous, key)) merged[key] = previous[key];
    merged.importSource.importedAt = previous.importSource?.importedAt || now;
    return merged;
  });
  cards.push(...prior.cards.filter(c => c.grader !== 'TAG' || !seen.has(c.cert)));
  const result = container ? { ...container, ...prior, id: containerId, kind: 'card', physical: true, virtual: false, cards }
    : { ...prior, id: containerId, kind: 'card', title: prior.title || 'TAG Collection', physical: false, virtual: false, location: prior.location || null, cards };
  const destination = path.join(directory, targetName);
  await writeFile(destination + '.tmp', JSON.stringify(result, null, 2) + '\n');await rename(destination + '.tmp', destination);
  return { destination, imported: incoming.length, added: incoming.filter(c => !old.has(key(c))).length, pending: capture.pending?.length || 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) importTag(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message);process.exitCode = 1; });
