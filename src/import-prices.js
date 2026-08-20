/**
 * Read priced results back from the lookup tool.
 *
 *   npm run prices -- path/to/returned.csv
 *
 * This closes the loop: `npm run export` hands out a CSV and the cover scans,
 * the other tool fills in marketplace columns, and this merges them home.
 *
 * The two repositories stay separate and are coupled only by this file format.
 * They have different jobs, different credentials and different lifecycles;
 * sharing a database or a package would tie their releases together for no gain,
 * and a CSV is inspectable when something looks wrong.
 *
 * Results land under `market`, never in `fmv`. GoCollect's figure is derived from
 * completed sales; a marketplace scrape is a different kind of evidence with a
 * different confidence attached. Merging them would destroy the ability to say
 * where a number came from — which is the one thing an appraisal needs.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BIN_DIR = path.join('data', 'bins');

/** RFC 4180 enough for the files this exchanges. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number.parseFloat(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Turn one returned row into a stored record.
 *
 * Refuses anything the tool did not stand behind. A row with no confidence, or
 * one marked `none`, contributes nothing: an unmatched listing is not a price,
 * and storing it would put a number on the dashboard that no one vouched for.
 */
export function toMarket(row, now) {
  const confidence = String(row.match_confidence ?? '').toLowerCase();
  if (!confidence || confidence === 'none') return null;

  const sold = {
    low: num(row.sold_low),
    median: num(row.sold_median),
    high: num(row.sold_high),
    count: num(row.sold_count),
    lastDate: row.sold_last_date || null,
  };
  const active = {
    low: num(row.active_low),
    high: num(row.active_high),
    count: num(row.active_count),
  };

  // Sold data is the point. Asking prices alone are not a valuation.
  if (sold.median === null && sold.low === null && sold.high === null) return null;

  return {
    value: sold.median ?? sold.low ?? sold.high,
    basis: 'sold',
    sold,
    active,
    confidence,
    notes: row.match_notes || null,
    url: row.listing_url || null,
    source: 'marketplace',
    fetchedAt: now,
  };
}

export async function importPrices(csvPath) {
  if (!csvPath || !existsSync(csvPath)) {
    console.error('Usage: npm run prices -- path/to/returned.csv');
    return { updated: 0 };
  }

  const rows = parseCsv(await readFile(csvPath, 'utf8'));
  if (!rows.length) {
    console.log('No rows in that file.');
    return { updated: 0 };
  }
  if (!('cert' in rows[0])) {
    console.error('That file has no `cert` column — is it the returned export?');
    return { updated: 0 };
  }

  const byCert = new Map(rows.map((r) => [String(r.cert).trim(), r]));
  const now = new Date().toISOString();

  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  let updated = 0;
  let skipped = 0;
  let unmatched = 0;
  const lowConfidence = [];

  for (const file of files) {
    const full = path.join(BIN_DIR, file);
    const data = JSON.parse(await readFile(full, 'utf8'));
    let changed = false;

    for (const comic of data.comics ?? []) {
      const row = byCert.get(comic.cert);
      if (!row) continue;
      byCert.delete(comic.cert);

      const market = toMarket(row, now);
      if (!market) { skipped += 1; continue; }

      comic.market = market;
      changed = true;
      updated += 1;
      if (market.confidence === 'low') lowConfidence.push(`${comic.cert} ${comic.title} #${comic.issue}`);
    }

    if (changed) await writeFile(full, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  unmatched = byCert.size;

  console.log(`Stored ${updated} marketplace price(s).`);
  if (skipped) console.log(`${skipped} row(s) had no confident sold data and were ignored.`);
  if (unmatched) {
    console.warn(`\n${unmatched} returned cert(s) are not in any bin:`);
    for (const cert of [...byCert.keys()].slice(0, 8)) console.warn(`  ${cert}`);
  }
  if (lowConfidence.length) {
    console.warn(`\n${lowConfidence.length} matched only at LOW confidence — worth checking by eye:`);
    for (const l of lowConfidence.slice(0, 10)) console.warn(`  ${l}`);
  }
  if (updated) console.log('\nNext: npm run build && npm run print');

  return { updated, skipped, unmatched, lowConfidence: lowConfidence.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importPrices(process.argv[2]).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
