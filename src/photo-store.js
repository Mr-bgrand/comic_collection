/** Owner photographs: exact-copy lookup, reviewed replacement, preserved history. */
import { readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readCollection, revisionOf } from './lab-admin.js';
import { displayTitle, gradeLabel } from './model.js';

export const PHOTO_LIMIT = 20 * 1024 * 1024;
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const photoId = c => `${c.provider || c.grader || 'CGC'}:${c.cert}`;
async function entries(root) {
  const data = await readCollection(root);
  return [...data.bins, ...data.cards, ...data.comics].flatMap(container => (container.data.cards || container.data.comics || []).map(card => ({ container, card })));
}
function describe({ container, card }) {
  const b = container.data;
  return { id: photoId(card), cert: card.cert, title: displayTitle(card), grade: gradeLabel(card), kind: card.kind || 'comic',
    location: card.location || b.location || b.title || (b.bin ? `Bin ${b.bin}` : 'Location not recorded'), revision: container.revision,
    images: { front: !!card.images?.front, back: !!card.images?.back } };
}
export async function searchPhotoRecords(root, query = '') {
  const q = String(query).trim().normalize('NFKC').toLowerCase();
  if (q.length < 2) return [];
  if (q.length > 120) throw failure('Keep the search under 120 characters.');
  return (await entries(root)).map(describe).filter(c => `${c.cert} ${c.title} ${c.grade} ${c.location}`.normalize('NFKC').toLowerCase().includes(q))
    .sort((a,b) => Number(b.cert.toLowerCase() === q) - Number(a.cert.toLowerCase() === q) || a.title.localeCompare(b.title)).slice(0,30);
}
async function locate(root, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+:[A-Za-z0-9]+$/.test(id)) throw failure('Choose an existing collection record.');
  const matches = (await entries(root)).filter(e => photoId(e.card) === id);
  if (matches.length !== 1) throw failure(matches.length ? 'This cert has duplicate records. Reconcile them before adding a photo.' : 'Record not found.', matches.length ? 409 : 404);
  return matches[0];
}
export async function getPhotoRecord(root, id) { return describe(await locate(root, id)); }
export async function readPhotoImage(root, id, side) {
  if (!['front','back'].includes(side)) throw failure('Choose front or back.');
  const { card } = await locate(root,id), name = card.images?.[side];
  if (!name || path.basename(name) !== name) throw failure('No photo saved for this side.',404);
  for (const folder of ['data/medium','data/images']) {
    try {
      const dir = await realpath(path.join(root,folder)), file = await realpath(path.join(dir,name));
      if (!file.startsWith(dir+path.sep)) throw failure('Invalid image path.');
      return await readFile(file);
    } catch (error) { if(error.code !== 'ENOENT') throw error; }
  }
  throw failure('Photo file is unavailable.',404);
}

export async function savePhoto(root, { id, side, revision, input, source = 'owner-upload' }) {
  if (!['front','back'].includes(side)) throw failure('Choose front or back.');
  if (!Buffer.isBuffer(input) || !input.length || input.length > PHOTO_LIMIT) throw failure('Choose a photo smaller than 20 MB.',413);
  const entry = await locate(root,id), { card, container } = entry;
  if (revision !== container.revision) throw failure('The record changed. Reload it and review your photo again.',409);
  let original, metadata;
  try {
    const image = sharp(input,{limitInputPixels:64000000,failOn:'error'});
    metadata = await image.metadata();
    if (!['jpeg','png','webp','heif'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw Error('Unsupported image');
    if (metadata.width < 150 || metadata.height < 150) throw Error('Too small');
    // Sharp removes metadata by default; the retained original is orientation-
    // corrected and sanitized, so GPS/camera metadata is never kept or published.
    original = await image.rotate().jpeg({quality:95}).toBuffer();
  } catch { throw failure('This photo could not be read. Try a clear JPG, PNG or WebP photo at least 150 pixels wide and high.'); }
  const hash = createHash('sha256').update(original).digest('hex');
  if (card.imageSources?.[side]?.kind === 'owner-photo' && card.imageSources[side].originalSha256 === hash) return { record: describe(entry), unchanged: true };
  const stem = id.replace(':','_')+'_'+side.toUpperCase()+'_PHOTO_'+hash.slice(0,16), filename = stem+'.jpg';
  const master = await sharp(original).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
  const variants = [
    ['data/originals',original],['data/images',master],
    ['data/medium',await sharp(master).resize({width:760,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:87}).toBuffer()],
    ['data/wall',await sharp(master).resize({height:320,withoutEnlargement:true}).jpeg({quality:80}).toBuffer()],
    ['data/thumbs',await sharp(master).resize({width:120,withoutEnlargement:true}).jpeg({quality:80}).toBuffer()]
  ];
  for (const [folder,bytes] of variants) {
    const dir = path.join(root,folder); await mkdir(dir,{recursive:true});
    const file = path.join(dir,filename); await writeFile(file+'.tmp',bytes); await rename(file+'.tmp',file);
  }
  const now = new Date().toISOString();
  const backups = path.join(root,'data/backups/photos'); await mkdir(backups,{recursive:true});
  const backup = path.join(backups,path.basename(container.filename,'.json')+'-'+container.revision+'.json');
  await writeFile(backup,container.raw,{flag:'wx'}).catch(e => {if(e.code!=='EEXIST')throw e;});
  // Do not overwrite an import or manual edit that happened during image processing.
  if (revisionOf(await readFile(container.filename,'utf8')) !== container.revision) throw failure('The record changed during upload. Reload and try again.',409);
  if (card.images?.[side]) {
    card.imageHistory ??= []; card.imageHistory.push({side,file:card.images[side],source:card.imageSources?.[side] || null,replacedAt:now});
  }
  card.images ??= {}; card.imageSources ??= {}; card.images[side] = filename;
  const dimensions = await sharp(original).metadata();
  card.imageSources[side] = {kind:'owner-photo',source:source === 'phone-upload' ? source : 'owner-upload',side,retrievedAt:now,
    originalFile:'data/originals/'+filename,originalSha256:hash,sha256:createHash('sha256').update(master).digest('hex'),
    originalWidth:dimensions.width,originalHeight:dimensions.height,metadataRemoved:true,sideBasis:'Owner selected this side and reviewed the photograph before saving.'};
  card.scanStatus = card.images.front && card.images.back ? 'complete' : 'partial';
  const raw = JSON.stringify(container.data,null,2)+'\n';
  await writeFile(container.filename+'.tmp',raw); await rename(container.filename+'.tmp',container.filename);
  entry.container.revision = revisionOf(raw);
  return {record:describe(entry),unchanged:false};
}
