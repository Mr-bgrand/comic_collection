/**
 * A live view of the scan you just took.
 *
 * The scanner is across the room and the terminal only says "saved". Whether a
 * scan is any good is a question about pixels, and it was being answered by
 * stopping, opening a file, and looking — which is exactly the walk this whole
 * mode exists to remove.
 *
 * So: a page that swaps in each new scan as it lands, with the book it belongs
 * to, and the mean brightness beside it. When a scan replaces an existing cover
 * it shows both, because a rescan is always a comparison — and because a number
 * that rose from 22 to 64 can still be a failure if what brightened was the mat
 * rather than the cover.
 *
 * Local only, bound to loopback, and it lives and dies with the scan session.
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';

/** Mean brightness 0-255, or null. Cheap enough to run on every scan. */
async function meanBrightness(buffer) {
  try {
    const { default: sharp } = await import('sharp');
    const { channels } = await sharp(buffer).stats();
    return Math.round(channels.reduce((sum, c) => sum + c.mean, 0) / channels.length);
  } catch {
    return null;
  }
}

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Scan preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0d0d12; color:#e8e8f0;
         font:14px/1.5 ui-sans-serif,system-ui,sans-serif; }
  header { padding:14px 20px; border-bottom:1px solid #23232e; }
  h1 { margin:0; font-size:15px; font-weight:600; letter-spacing:.01em; }
  .sub { color:#8b8b9e; font-size:12.5px; margin-top:2px; }
  main { display:flex; gap:18px; padding:18px 20px; align-items:flex-start;
         flex-wrap:wrap; }
  figure { margin:0; flex:1 1 320px; min-width:260px; }
  figcaption { display:flex; justify-content:space-between; align-items:baseline;
               margin-bottom:7px; font-size:12.5px; color:#8b8b9e; }
  img { width:100%; height:auto; border-radius:7px; display:block;
        background:#16161f; border:1px solid #23232e; }
  .n { font-variant-numeric:tabular-nums; font-weight:600; }
  .dark { color:#ff9b57; }
  .ok { color:#6fd08c; }
  .idle { padding:40px 20px; color:#6a6a7c; }
  .flag { margin:0 20px 4px; padding:9px 12px; border-radius:7px;
          background:#2a1f14; color:#ffbe8a; font-size:12.5px; display:none; }
</style>
<header>
  <h1 id="title">Waiting for the first scan…</h1>
  <div class="sub" id="sub"></div>
</header>
<div class="flag" id="flag"></div>
<main id="main"><div class="idle">Nothing scanned yet.</div></main>
<script>
  let seen = -1;
  const fmt = (b) => b === null ? '—' : b;
  const cls = (b) => b === null ? '' : (b < 45 ? 'dark' : 'ok');

  async function poll() {
    try {
      const r = await fetch('/latest.json', { cache: 'no-store' });
      const d = await r.json();
      if (d.seq && d.seq !== seen) { seen = d.seq; render(d); }
    } catch (e) { /* the session ended; keep the last frame on screen */ }
    setTimeout(poll, 700);
  }

  function render(d) {
    document.getElementById('title').textContent = d.title || 'Scan';
    document.getElementById('sub').textContent =
      [d.bin && ('bin ' + d.bin), d.cert, d.side && d.side.toUpperCase(),
       d.mode === 'bright' ? 'bright mode' : null].filter(Boolean).join('  ·  ');

    const flag = document.getElementById('flag');
    if (d.brightness !== null && d.brightness < 45) {
      flag.style.display = 'block';
      flag.textContent = 'Very dark (' + d.brightness + '). A foil or metal cover can '
        + 'reflect the lamp away from the lens — say "shiny", or tilt the slab slightly.';
    } else { flag.style.display = 'none'; }

    const main = document.getElementById('main');
    main.innerHTML = '';
    if (d.previous) main.appendChild(fig('Before', d.previousUrl, d.previousBrightness, d.seq));
    main.appendChild(fig(d.previous ? 'After' : 'Latest scan', d.url, d.brightness, d.seq));
  }

  function fig(label, url, brightness, seq) {
    const f = document.createElement('figure');
    const cap = document.createElement('figcaption');
    const l = document.createElement('span'); l.textContent = label;
    const b = document.createElement('span');
    b.className = 'n ' + cls(brightness);
    b.textContent = 'brightness ' + fmt(brightness);
    cap.append(l, b);
    const img = document.createElement('img');
    img.src = url + '?v=' + seq;   // defeat the cache; the path is reused
    img.alt = label;
    f.append(cap, img);
    return f;
  }
  poll();
</script>
`;

/**
 * Start the preview server.
 * @returns {{show: Function, stop: Function, url: string} | null} null if it
 *   could not bind, which must never stop a scan session.
 */
export async function startPreview({ open = true } = {}) {
  // One slot, replaced each scan: this shows the newest scan, not a gallery.
  let latest = { seq: 0 };
  let current = null; // { buffer }
  let previous = null;

  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];

    if (url === '/latest.json') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(latest));
      return;
    }
    if (url === '/current.jpg' && current) {
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
      res.end(current);
      return;
    }
    if (url === '/previous.jpg' && previous) {
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
      res.end(previous);
      return;
    }
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    res.writeHead(404).end();
  });

  const port = await new Promise((resolve) => {
    server.on('error', () => resolve(null));
    server.listen(0, HOST, () => resolve(server.address().port));
  });
  if (!port) return null;

  const address = `http://${HOST}:${port}/`;
  if (open) {
    // Windows: `start` needs an empty title argument before a URL.
    spawn('cmd', ['/c', 'start', '', address], { stdio: 'ignore', detached: true }).unref();
  }

  return {
    url: address,
    /**
     * Show a freshly scanned image.
     * @param buffer the JPEG as saved
     * @param info   { title, cert, side, bin, mode, before } - `before` is the
     *               previous version of this same image, when replacing one
     */
    async show(buffer, info = {}) {
      previous = info.before ?? null;
      current = buffer;
      latest = {
        seq: latest.seq + 1,
        title: info.title ?? '',
        cert: info.cert ?? '',
        side: info.side ?? '',
        bin: info.bin ?? '',
        mode: info.mode ?? 'normal',
        url: '/current.jpg',
        brightness: await meanBrightness(buffer),
        previous: Boolean(previous),
        previousUrl: '/previous.jpg',
        previousBrightness: previous ? await meanBrightness(previous) : null,
      };
    },
    stop() {
      server.close();
    },
  };
}
