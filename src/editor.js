/**
 * Local value editor.
 *
 *   npm run edit    then open http://127.0.0.1:4173
 *
 * Why local rather than part of the published dashboard: the site is a static
 * public page with no backend, and anyone who scans a bin QR can open it. An
 * editable public page would be both impossible (nothing to write to) and wrong
 * (anyone could rewrite your appraisal). So this runs on your machine, writes
 * straight to data/bins/*.json, and you commit the result.
 *
 * Bound to 127.0.0.1 explicitly so it is never reachable from the network.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { renderEditorPage } from './templates/editorPage.js';

const HOST = '127.0.0.1';
const PORT = 4173;
const BIN_DIR = path.join('data', 'bins');

async function loadBins() {
  if (!existsSync(BIN_DIR)) return [];
  const files = (await readdir(BIN_DIR)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => ({
      file: path.join(BIN_DIR, f),
      data: JSON.parse(await readFile(path.join(BIN_DIR, f), 'utf8')),
    })),
  );
}

/**
 * Apply one edit. Returns what changed, or throws if the cert is unknown.
 *
 * A blank or non-numeric value clears the estimate rather than storing zero — a
 * book worth nothing and a book you have not valued are different facts.
 */
export function applyEdit(bins, { cert, value, note }) {
  for (const { file, data } of bins) {
    const comic = (data.comics ?? []).find((c) => c.cert === String(cert));
    if (!comic) continue;

    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
    const clear = value === '' || value === null || !Number.isFinite(parsed);

    if (clear && !String(note ?? '').trim()) {
      delete comic.manual;
    } else {
      comic.manual = {
        ...(clear ? {} : { value: parsed }),
        ...(String(note ?? '').trim() ? { note: String(note).trim() } : {}),
        setAt: new Date().toISOString(),
      };
    }
    return { file, data, comic };
  }
  throw new Error(`unknown cert ${cert}`);
}

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    // A local tool still should not be trivially memory-bombed.
    if (chunks.reduce((n, c) => n + c.length, 0) > 64 * 1024) throw new Error('body too large');
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export async function serve({ port = PORT } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${HOST}`);

      if (req.method === 'GET' && url.pathname === '/') {
        const bins = await loadBins();
        const html = renderEditorPage({ bins: bins.map((b) => b.data) });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }

      if (req.method === 'POST' && url.pathname === '/api/value') {
        const body = await readBody(req);
        const bins = await loadBins();
        const { file, data, comic } = applyEdit(bins, body);
        data.updated = new Date().toISOString().slice(0, 10);
        await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
        console.log(
          `  saved ${comic.cert} ${comic.title} #${comic.issue} -> ` +
            (comic.manual?.value != null ? `$${comic.manual.value}` : 'cleared'),
        );
        return json(res, 200, { ok: true, cert: comic.cert, manual: comic.manual ?? null });
      }

      json(res, 404, { error: 'not found' });
    } catch (err) {
      json(res, 400, { error: err.message });
    }
  });

  await new Promise((resolve) => server.listen(PORT, HOST, resolve));
  console.log(`Value editor on http://${HOST}:${port}`);
  console.log('Edits save straight to data/bins/*.json. Ctrl-C when done, then:');
  console.log('  npm run build && npm run print\n');
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  serve().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
