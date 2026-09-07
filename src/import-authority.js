/** Import a reviewed DOM capture; authentication remains in the user's browser. */
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { normalizeAuthority, mergeAuthority } from './authority.js';

export async function importAuthority(captureFile, containerFile = 'data/comics/soft-sleeves.json') {
  const capture = JSON.parse(await readFile(captureFile, 'utf8'));
  const comic = normalizeAuthority(capture);
  const directory=path.dirname(containerFile);
  if(existsSync(directory))for(const file of (await readdir(directory)).filter(f=>f.endsWith('.json'))){
    const other=path.join(directory,file);if(path.resolve(other)===path.resolve(containerFile))continue;
    const box=JSON.parse(await readFile(other,'utf8'));
    if(box.comics?.some(c=>c.provider==='Authority'&&c.providerId===comic.providerId))throw new Error('Authority copy already exists in another container; reconcile location first');
  }
  const container = existsSync(containerFile) ? JSON.parse(await readFile(containerFile, 'utf8')) :
    { id: 'soft-sleeves', title: 'Soft sleeves', physical: false, location: null, comics: [] };
  const prepared = [];
  // Fetch both sides and validate before changing the inventory or image files.
  for (const scan of capture.scans) {
    let response = await fetch(scan.url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    let resolvedUrl = scan.url;
    if ([301, 302, 307, 308].includes(response.status)) {
      const resolved = new URL(response.headers.get('location'), scan.url);
      const internalId = new URL(scan.url).pathname.split('/').at(-1);
      const suffix = `/${internalId}/${scan.side === 'front' ? 'Default' : 'Back'}.jpg`;
      if (resolved.origin !== new URL(scan.url).origin || !resolved.pathname.startsWith('/files/C4E/Containers/Comics/') || !resolved.pathname.endsWith(suffix)) throw new Error('Unexpected scan redirect');
      resolvedUrl = resolved.href;
      response = await fetch(resolvedUrl, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    }
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Scan fetch failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 35 * 1024 * 1024) throw new Error('Unexpected scan size');
    const meta = await sharp(bytes).metadata();
    if (meta.format !== 'jpeg' || !meta.width || !meta.height) throw new Error('Expected a valid original JPEG scan');
    const filename = `Authority_${comic.providerId}_${scan.side.toUpperCase()}.jpg`;
    comic.images[scan.side] = filename;
    comic.imageSources[scan.side] = {
      url: scan.url, resolvedUrl, pageUrl: capture.pageUrl, side: scan.side, kind: 'original-scan',
      sideBasis: 'Authority examine viewer: .front/.back and explicit Type parameter',
      discoveredAt: capture.capturedAt, retrievedAt: new Date().toISOString(),
      originalWidth: meta.width, originalHeight: meta.height,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    prepared.push({ filename, bytes });
  }
  for (const directory of ['data/images', 'data/medium', 'data/wall', 'data/comics']) await mkdir(directory, { recursive: true });
  for (const { filename, bytes } of prepared) {
    await writeFile('data/images/' + filename, bytes);
    await writeFile('data/medium/' + filename, bytes);
    await sharp(bytes).resize({ height: 320, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile('data/wall/' + filename);
  }
  comic.scanStatus = 'complete';
  comic.importSource.captureFile = captureFile.replaceAll('\\', '/');
  container.comics = mergeAuthority(container.comics, comic);
  await writeFile(containerFile + '.tmp', JSON.stringify(container, null, 2) + '\n');
  await rename(containerFile + '.tmp', containerFile);
  return { id: comic.id, title: comic.title, status: comic.authentication.label, scans: prepared.length, records: container.comics.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importAuthority(process.argv[2], process.argv[3]).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
