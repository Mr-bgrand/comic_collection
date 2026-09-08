/** Local Collection / Lab server. Inventory writes are loopback-only and same-origin. */
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { readCollection, adminState, saveBinMetadata } from './lab-admin.js';
import { renderLabel } from './templates/label.js';
import { renderSheet } from './templates/sheet.js';
import { renderCollectionMaster, withPrintControls } from './templates/labPrint.js';
import { isPrintPdf } from './print-packs.js';
import { mediaRange } from './http-range.js';
import { binUrl } from './model.js';
import {physicalContainers,printContainer,containerId,containerUrl} from './physical-containers.js';
import { createPrintJobs } from './lab-jobs.js';
import { readValueHistory } from './value-history.js';
import { savePhoto } from './photo-store.js';
import { createPhotoBridge, photoRoute, photoBody } from './photo-bridge.js';

const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
export function localRequest(req) {
  try {
    const base = new URL(`http://${req.headers.host}`);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) &&
      (!req.headers.origin || req.headers.origin === base.origin) &&
      !['cross-site'].includes(req.headers['sec-fetch-site']);
  } catch { return false; }
}

export async function serveLab({ root = process.cwd(), port = 4175, photoPort = 4176, refreshPhotos = true } = {}) {
  let writes = Promise.resolve();
  const jobs = createPrintJobs(root);
  const persistPhoto = (body,authorize=()=>{}) => {
    const result=writes.then(async()=>{
      authorize();
      if((await jobs.snapshot()).status==='running')throw Object.assign(new Error('A build is running. Try saving the photo again when it finishes.'),{status:409});
      const saved=await savePhoto(root,body);
      if(refreshPhotos&&!saved.unchanged){jobs.start('review');await jobs.wait();const job=await jobs.snapshot();saved.previewReady=job.status==='complete';if(!saved.previewReady)saved.previewError='Photo saved. The preview rebuild failed; use Build only in Print Studio to retry.';}
      return saved;
    });writes=result.catch(()=>{});return result;
  };
  const photoBridge=createPhotoBridge({root,port:photoPort,save:persistPhoto});
  const server = createServer(async (req, res) => {
    try {
      if (!localRequest(req)) return json(res, 403, { error: 'Open Admin from the local Collection / Lab.' });
      const url = new URL(req.url, 'http://localhost'), route = decodeURIComponent(url.pathname);
      if(route==='/api/admin/photos/pair'&&req.method==='POST') {
        const body=JSON.parse((await photoBody(req,2048)).toString());return json(res,200,await photoBridge.pair(body.id));
      }
      if(route==='/api/admin/photos/pair-status'&&req.method==='GET')return json(res,200,photoBridge.status(url.searchParams.get('pairingId')));
      if(route==='/api/admin/photos/unpair'&&req.method==='POST') {const body=JSON.parse((await photoBody(req,2048)).toString());photoBridge.revoke(body.pairingId);return json(res,200,{closed:true});}
      if(route.startsWith('/api/admin/photos/'))return await photoRoute(req,res,url,{root,save:persistPhoto});
      if (req.method === 'GET' && route === '/api/admin/state') return json(res, 200, adminState(await readCollection(root)));
      if (req.method === 'GET' && route === '/api/admin/job') return json(res, 200, await jobs.snapshot());
      if (req.method === 'POST' && route === '/api/admin/job') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'JSON required' });
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1024) throw new Error('Request too large'); }
        await writes;
        return json(res, 202, jobs.start(JSON.parse(raw).action));
      }
      if (req.method === 'POST' && route === '/api/admin/bin') {
        if ((await jobs.snapshot()).status === 'running') return json(res, 409, { error: 'Let the current build finish before editing bins.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'JSON required' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) throw new Error('Request too large'); }
        const body = JSON.parse(raw);
        const result = writes.then(() => saveBinMetadata(root, body));
        writes = result.catch(() => {});
        return json(res, 200, { bin: await result });
      }
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not supported' });
      if (route === '/api/admin/export') {
        const collection = await readCollection(root), valueHistory = await readValueHistory(root);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="collection-backup.json"', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ exportedAt: new Date().toISOString(), config: collection.config,
          bins: collection.bins.map(c => c.data), cards: collection.cards.map(c => c.data), comics: collection.comics.map(c => c.data), valueHistory }, null, 2));
      }
      const print = route.match(/^\/admin\/print\/bin\/([a-zA-Z0-9_-]+)\/(label|sheet)$/);
      if (print || route === '/admin/print/master') {
        const collection = await readCollection(root);
        let html, size, title;
        if (print) {
          const stored = physicalContainers(collection).find(({ data }) => containerId(data) === print[1])?.data;
          if (!stored) return json(res, 404, { error: 'Bin not found' });
          const bin=printContainer(stored);
          const destination = containerUrl(collection.config.baseUrl,bin), qrSvg = await QRCode.toString(destination, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
          const label = print[2] === 'label';
          html = label ? renderLabel({ bin, qrSvg, url: destination, config: collection.config }) : renderSheet({ bin, qrSvg, url: destination, imagePrefix: '/medium/' });
          size = label ? '4 × 6 inches' : 'Letter · 8.5 × 11 inches'; title = `${bin.title || 'Bin ' + bin.bin} · ${label ? 'Case label' : 'Master sheet'}`;
        } else { html = renderCollectionMaster(collection); size = 'Letter landscape'; title = 'Collection master list'; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(withPrintControls(html, { size, title }));
      }
      // Serve only the built app and scan derivatives, with traversal/symlink confinement.
      const imageRoute = route.startsWith('/medium/'), printRoute = route.startsWith('/print/') && isPrintPdf(route.slice('/print/'.length));
      const dir = path.resolve(root, imageRoute ? 'data/medium' : printRoute ? 'print' : 'dist');
      const relative = imageRoute ? route.slice('/medium/'.length) : printRoute ? route.slice('/print/'.length) : route === '/' ? 'review/index.html' : route.slice(1) + (route.endsWith('/') ? 'index.html' : '');
      const file = path.resolve(dir, relative), inside = value => value.startsWith(dir + path.sep);
      if (!inside(file)) return json(res, 404, { error: 'Not found' });
      const resolved = await realpath(file);
      if (!inside(resolved)) return json(res, 404, { error: 'Not found' });
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
      const bytes = await readFile(resolved), headers = { 'Content-Type': mime, 'Cache-Control': 'no-store', 'Content-Length': bytes.length };
      if (mime === 'audio/mpeg') {
        headers['Accept-Ranges'] = 'bytes';
        if (req.headers.range) {
          const range = mediaRange(req.headers.range, bytes.length);
          if (!range) { res.writeHead(416, { 'Content-Range': `bytes */${bytes.length}`, 'Content-Length': 0 }); return res.end(); }
          headers['Content-Range'] = `bytes ${range.start}-${range.end}/${bytes.length}`;
          headers['Content-Length'] = range.end - range.start + 1;
          res.writeHead(206, headers); return res.end(bytes.subarray(range.start, range.end + 1));
        }
      }
      res.writeHead(200, headers); res.end(bytes);
    } catch (error) { json(res, error.status || (error.code === 'ENOENT' ? 404 : 400), { error: error.code === 'ENOENT' ? 'Not found' : error.message }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  server.on('close',()=>{photoBridge.close().catch(()=>{});});
  console.log(`Collection / Lab + Admin: http://localhost:${server.address().port}/review/`);
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serveLab().catch(error => { console.error(error.message); process.exitCode = 1; });
