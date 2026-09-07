/** Local inventory operations shared by the Lab server and its tests. */
import { readdir, readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {physicalContainers,containerId} from './physical-containers.js';

export const revisionOf = text => createHash('sha256').update(text).digest('hex');
export async function readCollection(root = process.cwd()) {
  async function readGroup(folder) {
    const dir = path.join(root, 'data', folder);
    if (!existsSync(dir)) return [];
    return Promise.all((await readdir(dir)).filter(file => file.endsWith('.json')).sort().map(async file => {
      const filename = path.join(dir, file), raw = await readFile(filename, 'utf8');
      return { filename, raw, revision: revisionOf(raw), data: JSON.parse(raw) };
    }));
  }
  return { bins: await readGroup('bins'), cards: await readGroup('cards'), comics: await readGroup('comics'),
    config: JSON.parse(await readFile(path.join(root, 'data/config.json'), 'utf8')) };
}

export function adminState(collection) {
  const bins = physicalContainers(collection).map(({ data: b, revision }) => ({ id: containerId(b), title: b.title || `Bin ${b.bin}`, location: b.location || '', count: (b.comics||b.cards||[]).length, revision }));
  const all = [...collection.bins, ...collection.cards, ...collection.comics].flatMap(({ data }) => data.comics || data.cards || []);
  return { bins, summary: { total: all.length, comics: all.filter(c => c.kind !== 'card').length, cards: all.filter(c => c.kind === 'card').length,
    missingScans: all.filter(c => !c.images?.front).length, unassigned: [...collection.comics,...collection.cards.filter(({data})=>data.physical===false&&!data.virtual)].flatMap(({ data }) => (data.comics || data.cards || []).filter(c => !c.location && !data.location)).length },
    collectionName: collection.config.collectionName };
}

export function validateBinEdit(body) {
  if (!body || typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(body.id)) throw new Error('Choose an existing bin');
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 60 || /[\x00-\x1f]/.test(body.title)) throw new Error('Use a bin name of 1–60 characters');
  if (typeof body.location !== 'string' || body.location.trim().length > 100 || /[\x00-\x1f]/.test(body.location)) throw new Error('Use a location of up to 100 characters');
  if (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) throw new Error('Reload the bin before saving');
  return { id: body.id, title: body.title.trim(), location: body.location.trim(), revision: body.revision };
}

export async function saveBinMetadata(root, body) {
  const edit = validateBinEdit(body), collection = await readCollection(root);
  const entry = physicalContainers(collection).find(({ data }) => containerId(data) === edit.id);
  if (!entry) throw Object.assign(new Error('Bin not found'), { status: 404 });
  if (edit.revision !== entry.revision) throw Object.assign(new Error('This bin changed since you opened Admin. Reload to keep those edits.'), { status: 409 });
  const data = { ...entry.data, title: edit.title, location: edit.location, updated: new Date().toISOString().slice(0, 10) };
  const backupDir = path.join(root, 'data/backups/bins');
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `${edit.id}-${entry.revision}.json`);
  if (!existsSync(backup)) await writeFile(backup, entry.raw, { flag: 'wx' });
  // Recheck after backup I/O, including edits from outside the application.
  if (revisionOf(await readFile(entry.filename, 'utf8')) !== entry.revision) throw Object.assign(new Error('The bin changed during save. Reload and try again.'), { status: 409 });
  const raw = JSON.stringify(data, null, 2) + '\n';
  await writeFile(entry.filename + '.tmp', raw);
  await rename(entry.filename + '.tmp', entry.filename);
  return { id: containerId(data), title: data.title, location: data.location, count: (data.comics||data.cards||[]).length, revision: revisionOf(raw) };
}
